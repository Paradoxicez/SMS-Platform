import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock the license service
const mockActivateLicense = vi.fn();
const mockGetLicenseStatus = vi.fn();
const mockIsOnPrem = vi.fn();

vi.mock("../../services/license", () => ({
  activateLicense: (...args: unknown[]) => mockActivateLicense(...args),
  getLicenseStatus: (...args: unknown[]) => mockGetLicenseStatus(...args),
  isOnPrem: () => mockIsOnPrem(),
}));

import { licenseRouter } from "../license";

function createApp() {
  const app = new Hono();
  // Simulate tenant context middleware
  app.use("*", async (c, next) => {
    c.set("tenantId" as never, "tenant-123" as never);
    await next();
  });
  app.route("/", licenseRouter);
  return app;
}

describe("license routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  describe("POST /license/activate", () => {
    it("should return 400 when no key provided", async () => {
      const res = await app.request("/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("BAD_REQUEST");
    });

    it("should return 200 with license data on valid key", async () => {
      mockActivateLicense.mockResolvedValue({
        valid: true,
        status: "active",
        licenseId: "LIC-2026-001",
        tenant: "test-company",
        plan: "pro",
        limits: { cameras: 100 },
        features: ["hls", "webrtc"],
        addons: ["recording"],
        expiresAt: "2027-01-01",
        daysRemaining: 365,
      });

      const res = await app.request("/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "valid.license.key" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.valid).toBe(true);
      expect(body.data.plan).toBe("pro");
      expect(body.data.license_id).toBe("LIC-2026-001");
      expect(body.meta.request_id).toBeTruthy();
    });

    it("should return 422 for invalid license key", async () => {
      mockActivateLicense.mockResolvedValue({
        valid: false,
        status: "invalid",
        reason: "Invalid license key signature",
      });

      const res = await app.request("/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "invalid.key" }),
      });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe("INVALID_LICENSE");
    });

    it("should return LICENSE_EXPIRED code for expired keys", async () => {
      mockActivateLicense.mockResolvedValue({
        valid: false,
        status: "invalid",
        reason: "License has expired. Contact your vendor for renewal.",
      });

      const res = await app.request("/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "expired.key" }),
      });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe("LICENSE_EXPIRED");
    });

    it("should pass tenantId to activateLicense", async () => {
      mockActivateLicense.mockResolvedValue({
        valid: true,
        status: "active",
      });

      await app.request("/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "some.key" }),
      });

      expect(mockActivateLicense).toHaveBeenCalledWith("some.key", "tenant-123");
    });
  });

  describe("GET /license/status", () => {
    it("should return current license status", async () => {
      mockIsOnPrem.mockReturnValue(true);
      mockGetLicenseStatus.mockResolvedValue({
        valid: true,
        status: "active",
        licenseId: "LIC-2026-001",
        plan: "pro",
        limits: { cameras: 100 },
        features: ["hls"],
      });

      const res = await app.request("/license/status");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.is_on_prem).toBe(true);
      expect(body.data.status).toBe("active");
      expect(body.data.plan).toBe("pro");
    });

    it("should return cloud status when not on-prem", async () => {
      mockIsOnPrem.mockReturnValue(false);
      mockGetLicenseStatus.mockResolvedValue({
        valid: true,
        status: "active",
        reason: "Cloud deployment",
      });

      const res = await app.request("/license/status");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.is_on_prem).toBe(false);
      expect(body.data.valid).toBe(true);
    });
  });
});
