/**
 * Tests for recording-config service — scope inheritance logic.
 * API route tests are in routes/__tests__/recordings.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Track findFirst calls to simulate different scope lookups
let findFirstCallCount = 0;
let findFirstResponses: (unknown | null)[] = [];

vi.mock("../../db/client", () => ({
  withTenantContext: vi.fn().mockImplementation(
    async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        query: {
          recordingConfigs: {
            findFirst: vi.fn().mockImplementation(() => {
              const response = findFirstResponses[findFirstCallCount] ?? null;
              findFirstCallCount++;
              return response;
            }),
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "new-1" }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "updated-1" }]),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(
              Promise.resolve([{ totalBytes: 5000000, totalCount: 10 }]),
            ),
          }),
        }),
      };
      return fn(tx);
    },
  ),
}));

import {
  resolveEffectiveConfig,
  upsertConfig,
  deleteConfig,
} from "../recording-config";

const MOCK_GLOBAL_CONFIG = {
  id: "global-1",
  tenantId: "tenant-1",
  scopeType: "global",
  scopeId: null,
  mode: "scheduled",
  schedule: [{ days: ["mon", "fri"], from: "09:00", to: "17:00" }],
  retentionDays: 60,
  autoPurge: true,
  storageType: "s3",
  storagePath: null,
  s3Config: { bucket: "recordings" },
  format: "fmp4",
  resolution: "720p",
  maxSegmentSizeMb: 512,
  enabled: true,
};

const MOCK_SITE_CONFIG = {
  ...MOCK_GLOBAL_CONFIG,
  id: "site-1",
  scopeType: "site",
  scopeId: "site-uuid",
  retentionDays: 90,
};

const MOCK_CAMERA_CONFIG = {
  ...MOCK_GLOBAL_CONFIG,
  id: "cam-config-1",
  scopeType: "camera",
  scopeId: "cam-uuid",
  mode: "scheduled",
  retentionDays: 7,
  format: "mkv",
  resolution: "480p",
};

describe("recording-config service", () => {
  beforeEach(() => {
    findFirstCallCount = 0;
    findFirstResponses = [];
    vi.clearAllMocks();
  });

  describe("resolveEffectiveConfig — inheritance", () => {
    it("should return default when no configs exist at any scope", async () => {
      // All lookups return null: camera(null) → global(null) → default
      findFirstResponses = [null, null];

      const config = await resolveEffectiveConfig("tenant-1", "cam-1");
      expect(config.inheritedFrom).toBe("default");
      expect(config.mode).toBe("continuous");
      expect(config.retentionDays).toBe(30);
      expect(config.format).toBe("fmp4");
      expect(config.resolution).toBe("original");
    });

    it("should return global config when only global exists", async () => {
      // camera(null) → global(config)
      findFirstResponses = [null, MOCK_GLOBAL_CONFIG];

      const config = await resolveEffectiveConfig("tenant-1", "cam-1");
      expect(config.inheritedFrom).toBe("global");
      expect(config.mode).toBe("scheduled");
      expect(config.retentionDays).toBe(60);
      expect(config.storageType).toBe("s3");
    });

    it("should return site config when site override exists", async () => {
      // camera(null) → project(not checked, no projectId) → site(not checked, no siteId) → global(null)
      // With siteId: camera(null) → site(config)
      findFirstResponses = [null, MOCK_SITE_CONFIG];

      const config = await resolveEffectiveConfig("tenant-1", "cam-1", undefined, "site-uuid");
      expect(config.inheritedFrom).toBe("site");
      expect(config.retentionDays).toBe(90);
    });

    it("should return camera config when camera override exists (closest wins)", async () => {
      // camera(config) → done
      findFirstResponses = [MOCK_CAMERA_CONFIG];

      const config = await resolveEffectiveConfig("tenant-1", "cam-uuid");
      expect(config.inheritedFrom).toBe("camera");
      expect(config.mode).toBe("scheduled");
      expect(config.retentionDays).toBe(7);
      expect(config.format).toBe("mkv");
    });

    it("camera override should win over global", async () => {
      // camera(config) → never checks global
      findFirstResponses = [MOCK_CAMERA_CONFIG, MOCK_GLOBAL_CONFIG];

      const config = await resolveEffectiveConfig("tenant-1", "cam-uuid");
      expect(config.inheritedFrom).toBe("camera");
      expect(config.retentionDays).toBe(7); // camera = 7, not global = 60
    });
  });

  describe("upsertConfig", () => {
    it("should create new config when none exists", async () => {
      // getConfigForScope returns null → insert
      findFirstResponses = [null];

      const result = await upsertConfig("tenant-1", "global", undefined, {
        retentionDays: 90,
      });
      expect(result).toBeTruthy();
    });

    it("should update existing config", async () => {
      // getConfigForScope returns existing → update
      findFirstResponses = [MOCK_GLOBAL_CONFIG];

      const result = await upsertConfig("tenant-1", "global", undefined, {
        retentionDays: 14,
      });
      expect(result).toBeTruthy();
    });
  });

  describe("deleteConfig", () => {
    it("should return true when config exists", async () => {
      findFirstResponses = [MOCK_SITE_CONFIG];

      const result = await deleteConfig("tenant-1", "site", "site-uuid");
      expect(result).toBe(true);
    });

    it("should return false when no config exists", async () => {
      findFirstResponses = [null];

      const result = await deleteConfig("tenant-1", "site", "nonexistent");
      expect(result).toBe(false);
    });
  });
});
