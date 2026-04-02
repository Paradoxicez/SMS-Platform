import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock services
const mockEnableRecording = vi.fn();
const mockDisableRecording = vi.fn();
const mockListRecordings = vi.fn();
const mockCreateVodSession = vi.fn();

vi.mock("../../services/recordings", () => ({
  enableRecording: (...args: unknown[]) => mockEnableRecording(...args),
  disableRecording: (...args: unknown[]) => mockDisableRecording(...args),
  listRecordings: (...args: unknown[]) => mockListRecordings(...args),
  createVodSession: (...args: unknown[]) => mockCreateVodSession(...args),
  deleteRecording: vi.fn().mockResolvedValue(undefined),
  syncConfigToMediaMTX: vi.fn().mockResolvedValue({ synced: 0 }),
}));

const mockResolveConfig = vi.fn().mockResolvedValue({ mode: "continuous", enabled: true, inheritedFrom: "default" });
const mockUpsertConfig = vi.fn().mockResolvedValue({ id: "config-1", mode: "continuous" });
const mockDeleteConfig = vi.fn().mockResolvedValue(true);
const mockGetStorageUsage = vi.fn().mockResolvedValue({
  total_bytes: 5000000,
  total_count: 10,
  top_cameras: [{ camera_id: "cam-1", total_bytes: 3000000, recording_count: 7 }],
});

vi.mock("../../services/recording-config", () => ({
  resolveEffectiveConfig: (...args: unknown[]) => mockResolveConfig(...args),
  upsertConfig: (...args: unknown[]) => mockUpsertConfig(...args),
  deleteConfig: (...args: unknown[]) => mockDeleteConfig(...args),
  getStorageUsage: (...args: unknown[]) => mockGetStorageUsage(...args),
}));

// Mock feature gate to always allow
vi.mock("../../middleware/feature-gate", () => ({
  requireFeature: () => async (_c: unknown, next: () => Promise<void>) => next(),
  requireCameraSlot: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

// Mock RBAC to always allow
vi.mock("../../middleware/rbac", () => ({
  requireRole: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

import { recordingsRouter } from "../recordings";

function createApp() {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("tenantId" as never, "tenant-123" as never);
    c.set("userId" as never, "user-123" as never);
    c.set("userRole" as never, "admin" as never);
    await next();
  });
  app.route("/", recordingsRouter);
  return app;
}

describe("recording routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  describe("POST /cameras/:id/recording/enable", () => {
    it("should enable recording with valid params", async () => {
      mockEnableRecording.mockResolvedValue({
        camera_id: "cam-1",
        recording_enabled: true,
        retention_days: 30,
        storage_type: "local",
      });

      const res = await app.request("/cameras/cam-1/recording/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retention_days: 30, storage_type: "local" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { data: { recording_enabled: boolean } };
      expect(body.data.recording_enabled).toBe(true);
      expect(mockEnableRecording).toHaveBeenCalledWith("cam-1", "tenant-123", 30, "local");
    });

    it("should reject invalid retention_days", async () => {
      const res = await app.request("/cameras/cam-1/recording/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retention_days: 999 }),
      });

      expect(res.status).toBe(400);
    });

    it("should reject invalid storage_type", async () => {
      const res = await app.request("/cameras/cam-1/recording/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storage_type: "invalid" }),
      });

      expect(res.status).toBe(400);
    });

    it("should use defaults when no body provided", async () => {
      mockEnableRecording.mockResolvedValue({
        camera_id: "cam-1",
        recording_enabled: true,
        retention_days: 30,
        storage_type: "local",
      });

      const res = await app.request("/cameras/cam-1/recording/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      expect(mockEnableRecording).toHaveBeenCalledWith("cam-1", "tenant-123", 30, "local");
    });
  });

  describe("POST /cameras/:id/recording/disable", () => {
    it("should disable recording", async () => {
      mockDisableRecording.mockResolvedValue({
        camera_id: "cam-1",
        recording_enabled: false,
      });

      const res = await app.request("/cameras/cam-1/recording/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { data: { recording_enabled: boolean } };
      expect(body.data.recording_enabled).toBe(false);
    });

    it("should return 404 when camera not found", async () => {
      mockDisableRecording.mockRejectedValue(new Error("Camera not found"));

      const res = await app.request("/cameras/bad-id/recording/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /cameras/:id/recordings", () => {
    it("should list recordings with pagination", async () => {
      mockListRecordings.mockResolvedValue({
        items: [
          { id: "rec-1", cameraId: "cam-1", startTime: "2026-03-28T10:00:00Z", endTime: "2026-03-28T12:00:00Z", sizeBytes: 1024000 },
        ],
        total: 1,
      });

      const res = await app.request("/cameras/cam-1/recordings?page=1&per_page=20");
      expect(res.status).toBe(200);
      const body = await res.json() as { data: unknown[]; meta: { total: number; total_pages: number } };
      expect(body.data).toHaveLength(1);
      expect(body.meta.total).toBe(1);
      expect(body.meta.total_pages).toBe(1);
    });

    it("should pass date filters to service", async () => {
      mockListRecordings.mockResolvedValue({ items: [], total: 0 });

      await app.request("/cameras/cam-1/recordings?from=2026-03-01T00:00:00Z&to=2026-03-28T23:59:59Z");

      expect(mockListRecordings).toHaveBeenCalledWith(
        "cam-1",
        "tenant-123",
        expect.any(Date),
        expect.any(Date),
        1,
        20,
      );
    });

    it("should cap per_page at 100", async () => {
      mockListRecordings.mockResolvedValue({ items: [], total: 0 });

      await app.request("/cameras/cam-1/recordings?per_page=999");

      expect(mockListRecordings).toHaveBeenCalledWith(
        "cam-1",
        "tenant-123",
        undefined,
        undefined,
        1,
        100,
      );
    });
  });

  describe("POST /recordings/:id/playback", () => {
    it("should create VOD session", async () => {
      mockCreateVodSession.mockResolvedValue({
        session_id: "session-1",
        recording_id: "rec-1",
        playback_url: "http://localhost:8888/vod/test.fmp4?session=session-1",
        expires_at: "2026-03-28T14:00:00Z",
      });

      const res = await app.request("/recordings/rec-1/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { data: { playback_url: string } };
      expect(body.data.playback_url).toContain("/vod/");
    });

    it("should return 404 for missing recording", async () => {
      mockCreateVodSession.mockRejectedValue(new Error("Recording not found"));

      const res = await app.request("/recordings/bad-id/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("Recording Config API", () => {
    it("GET /recording-config/global should return effective config", async () => {
      const res = await app.request("/recording-config/global");
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { mode: string; inheritedFrom: string } };
      expect(body.data.mode).toBe("continuous");
      expect(body.data.inheritedFrom).toBe("default");
    });

    it("PUT /recording-config/global should upsert global config", async () => {
      const res = await app.request("/recording-config/global", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays: 90, mode: "scheduled" }),
      });
      expect(res.status).toBe(200);
      expect(mockUpsertConfig).toHaveBeenCalledWith(
        "tenant-123",
        "global",
        undefined,
        expect.objectContaining({ retentionDays: 90, mode: "scheduled" }),
      );
    });

    it("PUT /recording-config/site/site-1 should upsert site override", async () => {
      const res = await app.request("/recording-config/site/site-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays: 60 }),
      });
      expect(res.status).toBe(200);
      expect(mockUpsertConfig).toHaveBeenCalledWith(
        "tenant-123",
        "site",
        "site-1",
        expect.objectContaining({ retentionDays: 60 }),
      );
    });

    it("PUT /recording-config/camera/cam-1 should upsert camera override", async () => {
      const res = await app.request("/recording-config/camera/cam-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "scheduled", retentionDays: 7 }),
      });
      expect(res.status).toBe(200);
      expect(mockUpsertConfig).toHaveBeenCalledWith(
        "tenant-123",
        "camera",
        "cam-1",
        expect.objectContaining({ mode: "scheduled", retentionDays: 7 }),
      );
    });

    it("DELETE /recording-config/camera/cam-1 should remove override", async () => {
      const res = await app.request("/recording-config/camera/cam-1", {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { deleted: boolean } };
      expect(body.data.deleted).toBe(true);
      expect(mockDeleteConfig).toHaveBeenCalledWith("tenant-123", "camera", "cam-1");
    });

    it("GET /recording-config/storage-usage should return usage summary", async () => {
      const res = await app.request("/recording-config/storage-usage");
      expect(res.status).toBe(200);
      const body = await res.json() as {
        data: { total_bytes: number; total_count: number; top_cameras: unknown[] };
      };
      expect(body.data.total_bytes).toBe(5000000);
      expect(body.data.total_count).toBe(10);
      expect(body.data.top_cameras).toHaveLength(1);
    });
  });
});
