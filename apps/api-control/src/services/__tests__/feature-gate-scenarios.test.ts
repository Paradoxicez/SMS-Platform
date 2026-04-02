import { describe, it, expect, vi, beforeEach } from "vitest";
import { ALL_FEATURES } from "../../lib/plan-definitions";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock DB with chainable + query helpers
const mockTenantFindFirst = vi.fn();
const mockPlanFindFirst = vi.fn();
const mockCountResult = vi.fn().mockResolvedValue([{ value: 0 }]);

vi.mock("../../db/client", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: () => mockCountResult(),
      }),
    }),
    query: {
      tenants: { findFirst: (...args: unknown[]) => mockTenantFindFirst(...args) },
      subscriptionPlans: { findFirst: (...args: unknown[]) => mockPlanFindFirst(...args) },
    },
  },
}));

// Mock license service
const mockGetEffectiveLimits = vi.fn();
const mockGetEffectiveFeatures = vi.fn();
const mockLicenseHasFeature = vi.fn();

vi.mock("../license", () => ({
  isOnPrem: () => process.env["DEPLOYMENT_MODE"] === "onprem",
  getEffectiveLimits: () => mockGetEffectiveLimits(),
  getEffectiveFeatures: () => mockGetEffectiveFeatures(),
  hasFeature: (f: string) => mockLicenseHasFeature(f),
  getCachedLicenseStatus: vi.fn(),
}));

// Mock quota service
const mockGetUsage = vi.fn();
vi.mock("../quota", () => ({
  getUsage: (...args: unknown[]) => mockGetUsage(...args),
}));

import {
  getPlanLimits,
  checkFeatureFlag,
  checkCameraLimit,
  checkProjectLimit,
  checkUserLimit,
  checkViewerHoursQuota,
  getUsageSummary,
  isOnPremDeployment,
} from "../feature-gate";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Enterprise license: unlimited everything, all features */
function setupOnPremEnterprise() {
  vi.stubEnv("DEPLOYMENT_MODE", "onprem");
  mockGetEffectiveLimits.mockReturnValue({
    cameras: Number.MAX_SAFE_INTEGER,
    projects: Number.MAX_SAFE_INTEGER,
    users: Number.MAX_SAFE_INTEGER,
    sites: Number.MAX_SAFE_INTEGER,
    apiKeys: Number.MAX_SAFE_INTEGER,
    viewerHours: Number.MAX_SAFE_INTEGER,
    retentionDays: 90,
  });
  // "*" means all features enabled
  mockGetEffectiveFeatures.mockReturnValue(["*"]);
  mockLicenseHasFeature.mockReturnValue(true);
}

/** Starter SaaS plan: 50 cameras, limited features */
function setupSaasStarter() {
  vi.stubEnv("DEPLOYMENT_MODE", "");
  mockTenantFindFirst.mockResolvedValue({
    id: "tenant-saas",
    subscriptionPlanId: "plan-starter",
    planOverrides: null,
  });
  mockPlanFindFirst.mockResolvedValue({
    id: "plan-starter",
    name: "starter",
    displayName: "Starter",
    maxCameras: 50,
    maxProjects: 3,
    maxUsers: 5,
    viewerHoursQuota: 1000,
    auditRetentionDays: 7,
    features: {
      hls: true,
      stream_profiles: true,
      embed: true,
      api_access: true,
      recording: true,
      webrtc: false,
      custom_profiles: false,
      csv_import: false,
      webhooks: false,
      audit_log: false,
      map_public: false,
      sso: false,
      multi_engine: false,
    },
  });
}

/** Free SaaS plan (no subscription plan linked) */
function setupSaasFree() {
  vi.stubEnv("DEPLOYMENT_MODE", "");
  mockTenantFindFirst.mockResolvedValue({
    id: "tenant-free",
    subscriptionPlanId: null,
    planOverrides: null,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Feature Gate Scenarios", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mockCountResult.mockResolvedValue([{ value: 0 }]);
    mockGetUsage.mockResolvedValue({ used_hours: 0, limit: 0, month: "2026-04" });
  });

  // ======================================================================
  // Scenario 1: On-Prem Enterprise (full-option)
  // ======================================================================
  describe("On-Prem Enterprise (full-option license)", () => {
    beforeEach(() => setupOnPremEnterprise());

    it("should detect on-prem deployment", () => {
      expect(isOnPremDeployment()).toBe(true);
    });

    it("should return unlimited resource limits", async () => {
      const limits = await getPlanLimits("tenant-onprem");
      expect(limits.maxCameras).toBe(Number.MAX_SAFE_INTEGER);
      expect(limits.maxProjects).toBe(Number.MAX_SAFE_INTEGER);
      expect(limits.maxUsers).toBe(Number.MAX_SAFE_INTEGER);
      expect(limits.viewerHoursQuota).toBe(Number.MAX_SAFE_INTEGER);
      expect(limits.auditRetentionDays).toBe(90);
    });

    it("should enable ALL features including hls", async () => {
      const limits = await getPlanLimits("tenant-onprem");

      // Every feature from ALL_FEATURES should be true
      for (const feature of ALL_FEATURES) {
        expect(limits.features[feature]).toBe(true);
      }
    });

    it("should allow every feature via checkFeatureFlag", async () => {
      for (const feature of ALL_FEATURES) {
        const allowed = await checkFeatureFlag("tenant-onprem", feature);
        expect(allowed).toBe(true);
      }
    });

    it("should allow camera creation (unlimited slots)", async () => {
      // Even with 1000 cameras, still allowed
      mockCountResult.mockResolvedValue([{ value: 1000 }]);
      const result = await checkCameraLimit("tenant-onprem");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("should allow project creation (unlimited)", async () => {
      mockCountResult.mockResolvedValue([{ value: 100 }]);
      const result = await checkProjectLimit("tenant-onprem");
      expect(result.allowed).toBe(true);
    });

    it("should allow user creation (unlimited)", async () => {
      mockCountResult.mockResolvedValue([{ value: 50 }]);
      const result = await checkUserLimit("tenant-onprem");
      expect(result.allowed).toBe(true);
    });

    it("should allow viewer hours (unlimited quota)", async () => {
      mockGetUsage.mockResolvedValue({ used_hours: 9999, limit: 0, month: "2026-04" });
      const result = await checkViewerHoursQuota("tenant-onprem");
      expect(result.allowed).toBe(true);
      expect(result.quotaHours).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("should not query DB (uses license cache only)", async () => {
      await getPlanLimits("tenant-onprem");
      // On-prem doesn't hit the DB for plan lookups
      expect(mockTenantFindFirst).not.toHaveBeenCalled();
      expect(mockPlanFindFirst).not.toHaveBeenCalled();
    });
  });

  // ======================================================================
  // Scenario 2: SaaS Starter plan (limited features)
  // ======================================================================
  describe("SaaS Starter plan (limited features and resources)", () => {
    beforeEach(() => setupSaasStarter());

    it("should detect cloud deployment", () => {
      expect(isOnPremDeployment()).toBe(false);
    });

    it("should return Starter plan limits", async () => {
      const limits = await getPlanLimits("tenant-saas");
      expect(limits.maxCameras).toBe(50);
      expect(limits.maxProjects).toBe(3);
      expect(limits.maxUsers).toBe(5);
      expect(limits.viewerHoursQuota).toBe(1000);
    });

    it("should enable only Starter features", async () => {
      const limits = await getPlanLimits("tenant-saas");

      // Starter includes these
      expect(limits.features["hls"]).toBe(true);
      expect(limits.features["stream_profiles"]).toBe(true);
      expect(limits.features["embed"]).toBe(true);
      expect(limits.features["api_access"]).toBe(true);
      expect(limits.features["recording"]).toBe(true);

      // Starter does NOT include these
      expect(limits.features["webrtc"]).toBe(false);
      expect(limits.features["custom_profiles"]).toBe(false);
      expect(limits.features["csv_import"]).toBe(false);
      expect(limits.features["webhooks"]).toBe(false);
      expect(limits.features["audit_log"]).toBe(false);
      expect(limits.features["map_public"]).toBe(false);
      expect(limits.features["sso"]).toBe(false);
      expect(limits.features["multi_engine"]).toBe(false);
    });

    it("should allow enabled features via checkFeatureFlag", async () => {
      expect(await checkFeatureFlag("tenant-saas", "recording")).toBe(true);
      expect(await checkFeatureFlag("tenant-saas", "embed")).toBe(true);
      expect(await checkFeatureFlag("tenant-saas", "hls")).toBe(true);
    });

    it("should block disabled features via checkFeatureFlag", async () => {
      expect(await checkFeatureFlag("tenant-saas", "webhooks")).toBe(false);
      expect(await checkFeatureFlag("tenant-saas", "audit_log")).toBe(false);
      expect(await checkFeatureFlag("tenant-saas", "webrtc")).toBe(false);
      expect(await checkFeatureFlag("tenant-saas", "sso")).toBe(false);
      expect(await checkFeatureFlag("tenant-saas", "csv_import")).toBe(false);
      expect(await checkFeatureFlag("tenant-saas", "multi_engine")).toBe(false);
    });

    it("should allow camera creation when under limit", async () => {
      mockCountResult.mockResolvedValue([{ value: 10 }]);
      const result = await checkCameraLimit("tenant-saas");
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(10);
      expect(result.limit).toBe(50);
    });

    it("should block camera creation when at limit", async () => {
      mockCountResult.mockResolvedValue([{ value: 50 }]);
      const result = await checkCameraLimit("tenant-saas");
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(50);
      expect(result.limit).toBe(50);
    });

    it("should block project creation when at limit", async () => {
      mockCountResult.mockResolvedValue([{ value: 3 }]);
      const result = await checkProjectLimit("tenant-saas");
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.limit).toBe(3);
    });

    it("should block user creation when at limit", async () => {
      mockCountResult.mockResolvedValue([{ value: 5 }]);
      const result = await checkUserLimit("tenant-saas");
      expect(result.allowed).toBe(false);
    });

    it("should block viewer hours when quota exceeded", async () => {
      mockGetUsage.mockResolvedValue({ used_hours: 1200, limit: 1000, month: "2026-04" });
      const result = await checkViewerHoursQuota("tenant-saas");
      expect(result.allowed).toBe(false);
      expect(result.currentHours).toBe(1200);
      expect(result.quotaHours).toBe(1000);
    });

    it("should include features in getUsageSummary", async () => {
      mockCountResult.mockResolvedValue([{ value: 5 }]);
      const summary = await getUsageSummary("tenant-saas");
      expect(summary.features).toBeDefined();
      expect(summary.features["recording"]).toBe(true);
      expect(summary.features["webhooks"]).toBe(false);
      expect(summary.planName).toBe("starter");
      expect(summary.planDisplayName).toBe("Starter");
    });

    it("should query DB for plan limits (not license)", async () => {
      await getPlanLimits("tenant-saas");
      expect(mockTenantFindFirst).toHaveBeenCalled();
      expect(mockPlanFindFirst).toHaveBeenCalled();
    });
  });

  // ======================================================================
  // Scenario 3: SaaS Free plan (no subscription — DEFAULT_LIMITS)
  // ======================================================================
  describe("SaaS Free plan (no subscription, uses DEFAULT_LIMITS)", () => {
    beforeEach(() => setupSaasFree());

    it("should return Free plan limits when no subscription", async () => {
      const limits = await getPlanLimits("tenant-free");
      expect(limits.maxCameras).toBe(3);
      expect(limits.maxProjects).toBe(1);
      expect(limits.maxUsers).toBe(2);
      expect(limits.viewerHoursQuota).toBe(100);
      expect(limits.auditRetentionDays).toBe(0);
    });

    it("should only enable HLS on Free plan", async () => {
      const limits = await getPlanLimits("tenant-free");
      expect(limits.features["hls"]).toBe(true);

      // Everything else should be disabled
      const disabledFeatures = [
        "webrtc", "embed", "api_access", "stream_profiles",
        "custom_profiles", "csv_import", "webhooks", "recording",
        "audit_log", "map_public", "sso", "multi_engine",
      ];
      for (const f of disabledFeatures) {
        expect(limits.features[f]).toBe(false);
      }
    });

    it("should block all premium features", async () => {
      expect(await checkFeatureFlag("tenant-free", "recording")).toBe(false);
      expect(await checkFeatureFlag("tenant-free", "webhooks")).toBe(false);
      expect(await checkFeatureFlag("tenant-free", "webrtc")).toBe(false);
      expect(await checkFeatureFlag("tenant-free", "embed")).toBe(false);
    });

    it("should block camera creation at 3", async () => {
      mockCountResult.mockResolvedValue([{ value: 3 }]);
      const result = await checkCameraLimit("tenant-free");
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(3);
    });
  });

  // ======================================================================
  // Scenario 4: SaaS with planOverrides
  // ======================================================================
  describe("SaaS with planOverrides (enterprise customization)", () => {
    beforeEach(() => {
      vi.stubEnv("DEPLOYMENT_MODE", "");
      mockTenantFindFirst.mockResolvedValue({
        id: "tenant-custom",
        subscriptionPlanId: "plan-starter",
        planOverrides: {
          maxCameras: 200,
          features: { webhooks: true, csv_import: true },
        },
      });
      mockPlanFindFirst.mockResolvedValue({
        id: "plan-starter",
        name: "starter",
        displayName: "Starter",
        maxCameras: 50,
        maxProjects: 3,
        maxUsers: 5,
        viewerHoursQuota: 1000,
        auditRetentionDays: 7,
        features: {
          hls: true,
          recording: true,
          embed: true,
          api_access: true,
          stream_profiles: true,
          webhooks: false,
          csv_import: false,
          webrtc: false,
          custom_profiles: false,
          audit_log: false,
          map_public: false,
          sso: false,
          multi_engine: false,
        },
      });
    });

    it("should apply camera override (50 → 200)", async () => {
      const limits = await getPlanLimits("tenant-custom");
      expect(limits.maxCameras).toBe(200);
      // Other limits remain from base plan
      expect(limits.maxProjects).toBe(3);
      expect(limits.maxUsers).toBe(5);
    });

    it("should merge feature overrides", async () => {
      const limits = await getPlanLimits("tenant-custom");
      // Base plan features remain
      expect(limits.features["recording"]).toBe(true);
      expect(limits.features["hls"]).toBe(true);
      // Overrides enable extra features
      expect(limits.features["webhooks"]).toBe(true);
      expect(limits.features["csv_import"]).toBe(true);
      // Not overridden features remain false
      expect(limits.features["webrtc"]).toBe(false);
      expect(limits.features["sso"]).toBe(false);
    });
  });

  // ======================================================================
  // Scenario 5: Unknown tenant (SaaS)
  // ======================================================================
  describe("SaaS unknown tenant", () => {
    beforeEach(() => {
      vi.stubEnv("DEPLOYMENT_MODE", "");
      mockTenantFindFirst.mockResolvedValue(null);
    });

    it("should fall back to DEFAULT_LIMITS (Free plan)", async () => {
      const limits = await getPlanLimits("unknown-tenant");
      expect(limits.maxCameras).toBe(3);
      expect(limits.features["hls"]).toBe(true);
      expect(limits.features["recording"]).toBe(false);
    });
  });

  // ======================================================================
  // Cross-check: ALL_FEATURES coverage
  // ======================================================================
  describe("ALL_FEATURES coverage", () => {
    it("on-prem feature map should cover every feature in ALL_FEATURES", async () => {
      setupOnPremEnterprise();
      const limits = await getPlanLimits("tenant-onprem");
      for (const feature of ALL_FEATURES) {
        expect(limits.features).toHaveProperty(feature);
      }
    });

    it("DEFAULT_LIMITS should cover every feature in ALL_FEATURES", async () => {
      setupSaasFree();
      const limits = await getPlanLimits("tenant-free");
      for (const feature of ALL_FEATURES) {
        expect(limits.features).toHaveProperty(
          feature,
          // only hls should be true on Free
          feature === "hls" ? true : false,
        );
      }
    });
  });
});
