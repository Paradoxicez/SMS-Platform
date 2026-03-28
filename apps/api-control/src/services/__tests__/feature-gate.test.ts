import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
vi.mock("../../db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    query: {
      tenants: { findFirst: vi.fn().mockResolvedValue(null) },
      subscriptionPlans: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  },
}));

// Mock the license service to control on-prem behavior
const mockGetEffectiveLimits = vi.fn();
const mockGetEffectiveFeatures = vi.fn();
const mockLicenseHasFeature = vi.fn();
const mockGetCachedLicenseStatus = vi.fn();

vi.mock("../license", () => ({
  isOnPrem: () => process.env["DEPLOYMENT_MODE"] === "onprem",
  getEffectiveLimits: () => mockGetEffectiveLimits(),
  getEffectiveFeatures: () => mockGetEffectiveFeatures(),
  hasFeature: (f: string) => mockLicenseHasFeature(f),
  getCachedLicenseStatus: () => mockGetCachedLicenseStatus(),
}));

import { getPlanLimits, checkFeatureFlag, isOnPremDeployment } from "../feature-gate";

describe("feature-gate service", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("isOnPremDeployment", () => {
    it("should return true when DEPLOYMENT_MODE=onprem", () => {
      vi.stubEnv("DEPLOYMENT_MODE", "onprem");
      expect(isOnPremDeployment()).toBe(true);
    });

    it("should return false when DEPLOYMENT_MODE is not set", () => {
      vi.stubEnv("DEPLOYMENT_MODE", "");
      expect(isOnPremDeployment()).toBe(false);
    });
  });

  describe("getPlanLimits (on-prem)", () => {
    it("should use license-based limits in on-prem mode", async () => {
      vi.stubEnv("DEPLOYMENT_MODE", "onprem");

      mockGetEffectiveLimits.mockReturnValue({
        cameras: 100,
        projects: 5,
        users: 10,
        sites: 10,
        apiKeys: 5,
        viewerHours: 5000,
        retentionDays: 30,
      });

      mockGetEffectiveFeatures.mockReturnValue([
        "hls",
        "webrtc",
        "embed",
        "recording",
      ]);

      const limits = await getPlanLimits("tenant-123");
      expect(limits.maxCameras).toBe(100);
      expect(limits.maxProjects).toBe(5);
      expect(limits.maxUsers).toBe(10);
      expect(limits.viewerHoursQuota).toBe(5000);
      expect(limits.features["webrtc"]).toBe(true);
      expect(limits.features["recording"]).toBe(true);
      expect(limits.features["sso"]).toBe(false);
    });
  });

  describe("checkFeatureFlag (on-prem)", () => {
    it("should use license-based features in on-prem mode", async () => {
      vi.stubEnv("DEPLOYMENT_MODE", "onprem");

      mockLicenseHasFeature.mockImplementation(
        (f: string) => ["hls", "webrtc"].includes(f),
      );

      expect(await checkFeatureFlag("tenant-123", "webrtc")).toBe(true);
      expect(await checkFeatureFlag("tenant-123", "sso")).toBe(false);
    });
  });
});
