/**
 * Integration test: License activation end-to-end via Hono test client.
 * Uses real license-codec + ed25519 (no mocks for crypto).
 * Mocks only DB and audit layers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { ed25519 } from "@noble/curves/ed25519.js";

// ─── Test key pair ──────────────────────────────────────────────────────────
const privateKey = ed25519.utils.randomSecretKey();
const publicKey = ed25519.getPublicKey(privateKey);

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock DB
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
  },
}));

vi.mock("../services/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock ed25519 to use our test keys for verification
vi.mock("../lib/ed25519", () => ({
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

import { encodeLicense, type LicensePayload } from "../lib/license-codec";
import { licenseRouter } from "../routes/license";

// ─── App setup ──────────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono();
  // Simulate tenant context
  app.use("*", async (c, next) => {
    c.set("tenantId" as never, "tenant-e2e" as never);
    await next();
  });
  app.route("/", licenseRouter);
  return app;
}

function generateLicenseKey(overrides: Partial<LicensePayload> = {}): string {
  const payload: LicensePayload = {
    id: "LIC-2026-E2E001",
    tenant: "e2e-company",
    plan: "pro",
    limits: {
      cameras: 200,
      projects: 10,
      users: 20,
      sites: 15,
      api_keys: 10,
      viewer_hours: 10000,
      retention_days: 30,
    },
    addons: ["recording", "webrtc"],
    issuedAt: "2026-03-28",
    expiresAt: "2027-03-28",
    ...overrides,
  };
  return encodeLicense(payload, privateKey);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("License E2E: generate → activate → status", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.stubEnv("DEPLOYMENT_MODE", "onprem");
    vi.resetModules();
    app = createApp();
  });

  it("full flow: generate key → activate → verify status", async () => {
    // 1. Generate a license key (simulates vendor CLI)
    const licenseKey = generateLicenseKey();
    expect(licenseKey).toContain(".");
    expect(licenseKey.split(".").length).toBe(2);

    // 2. Activate via API
    const activateRes = await app.request("/license/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: licenseKey }),
    });

    expect(activateRes.status).toBe(200);
    const activateBody = await activateRes.json();

    expect(activateBody.data.valid).toBe(true);
    expect(activateBody.data.status).toBe("active");
    expect(activateBody.data.license_id).toBe("LIC-2026-E2E001");
    expect(activateBody.data.plan).toBe("pro");
    expect(activateBody.data.limits.cameras).toBe(200);
    expect(activateBody.data.features).toContain("hls");
    expect(activateBody.data.features).toContain("webrtc");
    expect(activateBody.data.features).toContain("recording");
    expect(activateBody.data.addons).toEqual(["recording", "webrtc"]);
    expect(activateBody.data.days_remaining).toBeGreaterThan(300);
    expect(activateBody.meta.request_id).toBeTruthy();
    expect(activateBody.meta.timestamp).toBeTruthy();

    // 3. Check status via API
    const statusRes = await app.request("/license/status");
    expect(statusRes.status).toBe(200);
    const statusBody = await statusRes.json();

    expect(statusBody.data.is_on_prem).toBe(true);
    expect(statusBody.data.valid).toBe(true);
    expect(statusBody.data.plan).toBe("pro");
  });

  it("reject tampered license key", async () => {
    const licenseKey = generateLicenseKey();
    // Tamper: swap one character in the payload portion
    const tampered = "X" + licenseKey.slice(1);

    const res = await app.request("/license/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: tampered }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_LICENSE");
  });

  it("reject expired license (> 30 days)", async () => {
    const expiredKey = generateLicenseKey({ expiresAt: "2020-01-01" });

    const res = await app.request("/license/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: expiredKey }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("LICENSE_EXPIRED");
  });

  it("accept license in grace period (expired < 30 days)", async () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 10);
    const graceKey = generateLicenseKey({
      expiresAt: recent.toISOString().split("T")[0]!,
    });

    const res = await app.request("/license/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: graceKey }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("grace_period");
    expect(body.data.valid).toBe(true);
  });

  it("different plans have different features", async () => {
    const freeKey = generateLicenseKey({
      id: "LIC-FREE",
      plan: "free",
      limits: {
        cameras: 3,
        projects: 1,
        users: 2,
        sites: 1,
        api_keys: 0,
        viewer_hours: 100,
        retention_days: 0,
      },
      addons: [],
    });

    const res = await app.request("/license/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: freeKey }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.plan).toBe("free");
    expect(body.data.features).toContain("hls");
    expect(body.data.features).not.toContain("webrtc");
    expect(body.data.limits.cameras).toBe(3);
  });

  it("enterprise plan gets all features", async () => {
    const entKey = generateLicenseKey({
      id: "LIC-ENT",
      plan: "enterprise",
      addons: [],
    });

    const res = await app.request("/license/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: entKey }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.plan).toBe("enterprise");
    expect(body.data.features).toContain("ai");
    expect(body.data.features).toContain("sso");
    expect(body.data.features).toContain("multi_engine");
  });

  it("addons extend features beyond base plan", async () => {
    const starterWithAddons = generateLicenseKey({
      id: "LIC-ADDON",
      plan: "starter",
      addons: ["recording", "ai"],
    });

    const res = await app.request("/license/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: starterWithAddons }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.plan).toBe("starter");
    // Base starter features
    expect(body.data.features).toContain("hls");
    expect(body.data.features).toContain("embed");
    // Addon features
    expect(body.data.features).toContain("recording");
    expect(body.data.features).toContain("ai");
  });
});
