/**
 * Recording integration tests — tests the full flow:
 * 1. MediaMTX API connectivity
 * 2. Recording webhook → DB insert
 * 3. List recordings → returns data
 * 4. VOD session → returns signed URL
 * 5. Schedule enforcement
 * 6. Event trigger
 *
 * Mocks DB but uses real recording logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("../db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
    query: {
      cameras: { findFirst: vi.fn().mockResolvedValue(null) },
      recordings: { findFirst: vi.fn().mockResolvedValue(null) },
      recordingConfigs: { findFirst: vi.fn().mockResolvedValue(null) },
    },
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        execute: vi.fn(),
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        offset: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        query: {
          cameras: { findFirst: vi.fn().mockResolvedValue(null) },
          recordings: { findFirst: vi.fn().mockResolvedValue(null) },
          recordingConfigs: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };
      return fn(tx);
    }),
  },
  withTenantContext: vi.fn().mockImplementation(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      offset: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      query: {
        cameras: {
          findFirst: vi.fn().mockResolvedValue({
            id: "cam-1",
            tenantId: "tenant-1",
            tags: [],
            name: "Test Camera",
          }),
        },
        recordings: {
          findFirst: vi.fn().mockResolvedValue({
            id: "rec-1",
            cameraId: "cam-1",
            tenantId: "tenant-1",
            filePath: "tenant-1/cam-1/2026-03-28.fmp4",
            fileFormat: "fmp4",
            startTime: new Date("2026-03-28T10:00:00Z"),
            endTime: new Date("2026-03-28T12:00:00Z"),
            sizeBytes: 1024000,
            storageType: "local",
            s3Bucket: null,
            s3Key: null,
          }),
        },
        recordingConfigs: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    };
    return fn(tx);
  }),
}));

vi.mock("../services/audit", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("../routes/health", () => ({
  recordLicenseActivation: vi.fn(),
  setLicenseMetrics: vi.fn(),
  recordHeartbeat: vi.fn(),
}));

import {
  enableRecording,
  disableRecording,
  handleRecordingEvent,
  createVodSession,
} from "../services/recordings";
import { isWithinSchedule } from "../lib/recording-schedule";
import { LocalStorageProvider } from "../lib/recording-storage";

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Recording Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. MediaMTX API connectivity", () => {
    it("should connect to MediaMTX API and list paths", async () => {
      const res = await fetch("http://localhost:9997/v3/paths/list", {
        headers: { Authorization: "Basic " + btoa("admin:admin") },
      });
      expect(res.ok).toBe(true);
      const data = await res.json() as { itemCount: number; items: unknown[] };
      expect(data).toHaveProperty("itemCount");
      expect(data).toHaveProperty("items");
    });

    it("should get MediaMTX config", async () => {
      const res = await fetch("http://localhost:9997/v3/config/global/get", {
        headers: { Authorization: "Basic " + btoa("admin:admin") },
      });
      expect(res.ok).toBe(true);
      const config = await res.json() as Record<string, unknown>;
      expect(config).toHaveProperty("hls");
      expect(config).toHaveProperty("rtsp");
    });
  });

  describe("2. Enable/Disable recording", () => {
    it("should enable recording on a camera", async () => {
      const result = await enableRecording("cam-1", "tenant-1", 30, "local");
      expect(result.recording_enabled).toBe(true);
      expect(result.retention_days).toBe(30);
      expect(result.storage_type).toBe("local");
    });

    it("should disable recording on a camera", async () => {
      const result = await disableRecording("cam-1", "tenant-1");
      expect(result.recording_enabled).toBe(false);
    });
  });

  describe("3. Recording webhook → DB", () => {
    it("should handle recording_start event", async () => {
      await expect(
        handleRecordingEvent({
          type: "recording_start",
          path: "tenant-1/cam-1",
          file_path: "tenant-1/cam-1/2026-03-28_10-00-00.fmp4",
          start_time: "2026-03-28T10:00:00Z",
          format: "fmp4",
        }),
      ).resolves.not.toThrow();
    });

    it("should handle recording_end event", async () => {
      await expect(
        handleRecordingEvent({
          type: "recording_end",
          path: "tenant-1/cam-1",
          file_path: "tenant-1/cam-1/2026-03-28_10-00-00.fmp4",
          start_time: "2026-03-28T10:00:00Z",
          end_time: "2026-03-28T12:00:00Z",
          file_size: 1024000,
        }),
      ).resolves.not.toThrow();
    });

    it("should skip invalid path format", async () => {
      await expect(
        handleRecordingEvent({
          type: "recording_start",
          path: "invalid-path",
          file_path: "test.fmp4",
          start_time: "2026-03-28T10:00:00Z",
        }),
      ).resolves.not.toThrow();
    });
  });

  describe("4. VOD session → signed URL", () => {
    it("should create VOD session with signed URL", async () => {
      const session = await createVodSession("rec-1", "tenant-1");
      expect(session.session_id).toBeTruthy();
      expect(session.playback_url).toContain("/vod/");
      expect(session.format).toBe("fmp4");
      expect(session.duration_ms).toBe(2 * 60 * 60 * 1000); // 2 hours
      expect(session.file_size).toBe(1024000);
      expect(session.expires_at).toBeTruthy();
    });
  });

  describe("5. Schedule enforcement", () => {
    it("should allow recording during scheduled window", () => {
      const schedule = [
        { days: ["mon", "tue", "wed", "thu", "fri"], from: "09:00", to: "17:00" },
      ];
      // Wednesday 12:00
      expect(isWithinSchedule(schedule, new Date("2026-03-25T12:00:00"))).toBe(true);
    });

    it("should block recording outside scheduled window", () => {
      const schedule = [
        { days: ["mon", "tue", "wed", "thu", "fri"], from: "09:00", to: "17:00" },
      ];
      // Wednesday 22:00
      expect(isWithinSchedule(schedule, new Date("2026-03-25T22:00:00"))).toBe(false);
    });

    it("should handle overnight schedule correctly", () => {
      const schedule = [
        { days: ["mon", "tue", "wed", "thu", "fri"], from: "18:00", to: "06:00" },
      ];
      // 22:00 = within
      expect(isWithinSchedule(schedule, new Date("2026-03-25T22:00:00"))).toBe(true);
      // 03:00 = within
      expect(isWithinSchedule(schedule, new Date("2026-03-25T03:00:00"))).toBe(true);
      // 12:00 = outside
      expect(isWithinSchedule(schedule, new Date("2026-03-25T12:00:00"))).toBe(false);
    });
  });

  describe("6. Storage provider (local)", () => {
    it("should generate correct signed URL", async () => {
      const storage = new LocalStorageProvider("./recordings");
      const url = await storage.getSignedUrl("cam-1/test.fmp4", 3600);
      expect(url).toContain("/vod/cam-1/test.fmp4");
    });
  });
});
