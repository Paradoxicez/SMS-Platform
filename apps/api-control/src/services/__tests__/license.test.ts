import { describe, it, expect, vi, beforeEach } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";

// Mock DB and audit before importing the module under test
vi.mock("../../db/client", () => ({
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
  },
}));

vi.mock("../audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Generate test keys
const privateKey = ed25519.utils.randomSecretKey();
const publicKey = ed25519.getPublicKey(privateKey);

// Mock ed25519 to use test keys
vi.mock("../../lib/ed25519", () => ({
  sign: (message: Uint8Array, privKey: Uint8Array) =>
    ed25519.sign(message, privKey),
  verify: (signature: Uint8Array, message: Uint8Array) => {
    try {
      return ed25519.verify(signature, message, publicKey);
    } catch {
      return false;
    }
  },
}));

import { encodeLicense } from "../../lib/license-codec";
import type { LicensePayload } from "../../lib/license-codec";

function makeValidKey(overrides: Partial<LicensePayload> = {}): string {
  const payload: LicensePayload = {
    id: "LIC-2026-TEST01",
    tenant: "test-company",
    plan: "pro",
    limits: {
      cameras: 100,
      projects: 5,
      users: 10,
      sites: 10,
      api_keys: 5,
      viewer_hours: 5000,
      retention_days: 30,
    },
    addons: ["recording"],
    issuedAt: "2026-01-01",
    expiresAt: "2099-01-01",
    ...overrides,
  };
  return encodeLicense(payload, privateKey);
}

describe("license service", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    // Reset module-level cache by re-importing
    vi.resetModules();
  });

  it("should return cloud status when not on-prem", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "cloud");
    const { getLicenseStatus } = await import("../license");
    const status = await getLicenseStatus();
    expect(status.valid).toBe(true);
    expect(status.status).toBe("active");
  });

  it("should return trial mode when on-prem with no license", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "onprem");
    const { getLicenseStatus } = await import("../license");
    const status = await getLicenseStatus();
    expect(status.valid).toBe(true);
    expect(status.status).toBe("trial");
    expect(status.plan).toBe("free");
  });

  it("should activate a valid license key", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "onprem");
    const { activateLicense } = await import("../license");
    const key = makeValidKey();
    const status = await activateLicense(key, "tenant-123");
    expect(status.valid).toBe(true);
    expect(status.status).toBe("active");
    expect(status.plan).toBe("pro");
    expect(status.licenseId).toBe("LIC-2026-TEST01");
    expect(status.limits?.cameras).toBe(100);
    expect(status.features).toContain("recording");
  });

  it("should reject an invalid license key", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "onprem");
    const { activateLicense } = await import("../license");
    const status = await activateLicense("invalid.key", "tenant-123");
    expect(status.valid).toBe(false);
    expect(status.status).toBe("invalid");
  });

  it("should reject an expired license (> 30 days)", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "onprem");
    const { activateLicense } = await import("../license");
    const key = makeValidKey({ expiresAt: "2020-01-01" });
    const status = await activateLicense(key, "tenant-123");
    expect(status.valid).toBe(false);
    expect(status.status).toBe("invalid");
    expect(status.reason).toContain("expired");
  });

  it("should cache status after activation", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "onprem");
    const { activateLicense, getCachedLicenseStatus } = await import("../license");
    const key = makeValidKey();
    await activateLicense(key, "tenant-123");

    const cached = getCachedLicenseStatus();
    expect(cached).not.toBeNull();
    expect(cached?.plan).toBe("pro");
  });

  it("should return all features for cloud deployment", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "cloud");
    const { getEffectiveFeatures } = await import("../license");
    const features = getEffectiveFeatures();
    expect(features).toContain("*");
  });

  it("should return free features when on-prem with no license", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "onprem");
    const { getEffectiveFeatures } = await import("../license");
    const features = getEffectiveFeatures();
    expect(features).toContain("hls");
    expect(features).not.toContain("webrtc");
  });

  it("should return enterprise limits for cloud", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "cloud");
    const { getEffectiveLimits } = await import("../license");
    const limits = getEffectiveLimits();
    expect(limits.cameras).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("hasFeature should return true for cloud", async () => {
    vi.stubEnv("DEPLOYMENT_MODE", "cloud");
    const { hasFeature } = await import("../license");
    expect(hasFeature("ai")).toBe(true);
    expect(hasFeature("any_feature")).toBe(true);
  });
});
