import { describe, it, expect, vi, beforeEach } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  encodeLicense,
  decodeLicense,
  isExpired,
  isInGracePeriod,
  daysRemaining,
  getLicenseStatus,
} from "../license-codec";
import type { LicensePayload } from "../license-codec";

// Generate a test key pair
const privateKey = ed25519.utils.randomSecretKey();
const publicKey = ed25519.getPublicKey(privateKey);

// Mock ed25519 module to use our test keys
vi.mock("../ed25519", () => ({
  sign: (message: Uint8Array, privKey: Uint8Array) =>
    ed25519.sign(message, privKey),
  verify: (signature: Uint8Array, message: Uint8Array, pubKey?: Uint8Array) => {
    try {
      return ed25519.verify(signature, message, pubKey ?? publicKey);
    } catch {
      return false;
    }
  },
}));

function makePayload(overrides: Partial<LicensePayload> = {}): LicensePayload {
  return {
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
    expiresAt: "2027-01-01",
    ...overrides,
  };
}

describe("license-codec", () => {
  describe("encodeLicense / decodeLicense", () => {
    it("should encode and decode a license round-trip", () => {
      const payload = makePayload();
      const encoded = encodeLicense(payload, privateKey);

      expect(encoded).toContain(".");
      const parts = encoded.split(".");
      expect(parts.length).toBe(2);

      const decoded = decodeLicense(encoded);
      expect(decoded.valid).toBe(true);
      expect(decoded.payload.id).toBe("LIC-2026-TEST01");
      expect(decoded.payload.tenant).toBe("test-company");
      expect(decoded.payload.plan).toBe("pro");
      expect(decoded.payload.limits.cameras).toBe(100);
      expect(decoded.payload.addons).toEqual(["recording"]);
    });

    it("should reject a tampered payload", () => {
      const payload = makePayload();
      const encoded = encodeLicense(payload, privateKey);

      // Tamper by replacing part of the payload
      const parts = encoded.split(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...payload, plan: "enterprise" }),
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const tampered = `${tamperedPayload}.${parts[1]}`;
      const decoded = decodeLicense(tampered);
      expect(decoded.valid).toBe(false);
      expect(decoded.error).toContain("signature");
    });

    it("should reject invalid format (no dot separator)", () => {
      const decoded = decodeLicense("invalidlicensekey");
      expect(decoded.valid).toBe(false);
      expect(decoded.error).toContain("format");
    });

    it("should reject license with missing required fields", () => {
      // Encode a payload missing required fields but with valid signature
      const badPayload = { foo: "bar" } as any;
      const payloadBytes = new TextEncoder().encode(
        JSON.stringify(badPayload),
      );
      const payloadB64 = Buffer.from(payloadBytes)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const sig = ed25519.sign(payloadBytes, privateKey);
      const sigB64 = Buffer.from(sig)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const decoded = decodeLicense(`${payloadB64}.${sigB64}`);
      expect(decoded.valid).toBe(false);
      expect(decoded.error).toContain("Missing required");
    });
  });

  describe("isExpired", () => {
    it("should return false for future expiry", () => {
      const payload = makePayload({ expiresAt: "2099-01-01" });
      expect(isExpired(payload)).toBe(false);
    });

    it("should return true for past expiry", () => {
      const payload = makePayload({ expiresAt: "2020-01-01" });
      expect(isExpired(payload)).toBe(true);
    });
  });

  describe("isInGracePeriod", () => {
    it("should return false for active license", () => {
      const payload = makePayload({ expiresAt: "2099-01-01" });
      expect(isInGracePeriod(payload)).toBe(false);
    });

    it("should return true for recently expired license (within 30 days)", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const payload = makePayload({
        expiresAt: yesterday.toISOString().split("T")[0]!,
      });
      expect(isInGracePeriod(payload)).toBe(true);
    });

    it("should return false for license expired > 30 days ago", () => {
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 60);
      const payload = makePayload({
        expiresAt: longAgo.toISOString().split("T")[0]!,
      });
      expect(isInGracePeriod(payload)).toBe(false);
    });
  });

  describe("daysRemaining", () => {
    it("should return positive for future expiry", () => {
      const future = new Date();
      future.setDate(future.getDate() + 100);
      const payload = makePayload({
        expiresAt: future.toISOString().split("T")[0]!,
      });
      const days = daysRemaining(payload);
      expect(days).toBeGreaterThanOrEqual(98);
      expect(days).toBeLessThanOrEqual(100);
    });

    it("should return negative for past expiry", () => {
      const past = new Date();
      past.setDate(past.getDate() - 10);
      const payload = makePayload({
        expiresAt: past.toISOString().split("T")[0]!,
      });
      expect(daysRemaining(payload)).toBeLessThan(0);
    });
  });

  describe("getLicenseStatus", () => {
    it("should return 'active' for license expiring in > 30 days", () => {
      const future = new Date();
      future.setDate(future.getDate() + 100);
      const payload = makePayload({
        expiresAt: future.toISOString().split("T")[0]!,
      });
      expect(getLicenseStatus(payload)).toBe("active");
    });

    it("should return 'expiring' for license expiring within 30 days", () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 15);
      const payload = makePayload({
        expiresAt: soon.toISOString().split("T")[0]!,
      });
      expect(getLicenseStatus(payload)).toBe("expiring");
    });

    it("should return 'grace_period' for license expired within 30 days", () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 10);
      const payload = makePayload({
        expiresAt: recent.toISOString().split("T")[0]!,
      });
      expect(getLicenseStatus(payload)).toBe("grace_period");
    });

    it("should return 'read_only' for license expired > 30 days ago", () => {
      const old = new Date();
      old.setDate(old.getDate() - 60);
      const payload = makePayload({
        expiresAt: old.toISOString().split("T")[0]!,
      });
      expect(getLicenseStatus(payload)).toBe("read_only");
    });
  });
});
