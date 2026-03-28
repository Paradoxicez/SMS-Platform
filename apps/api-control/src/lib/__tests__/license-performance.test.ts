/**
 * Performance tests for license system (SC-002, SC-003, SC-006).
 */
import { describe, it, expect, vi } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";

const privateKey = ed25519.utils.randomSecretKey();
const publicKey = ed25519.getPublicKey(privateKey);

vi.mock("../ed25519", () => ({
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

import { encodeLicense, decodeLicense, getLicenseStatus } from "../license-codec";
import { resolveFeatures, resolveLimits, hasFeature } from "../plan-definitions";
import type { LicensePayload } from "../license-codec";

function makePayload(): LicensePayload {
  return {
    id: "LIC-PERF-001",
    tenant: "perf-test",
    plan: "pro",
    limits: {
      cameras: 500,
      projects: 10,
      users: 20,
      sites: 30,
      api_keys: 10,
      viewer_hours: 10000,
      retention_days: 30,
    },
    addons: ["recording", "ai"],
    issuedAt: "2026-01-01",
    expiresAt: "2027-01-01",
  };
}

describe("license performance (SC-002, SC-003, SC-006)", () => {
  it("SC-002: license key generation under 1 second", () => {
    const payload = makePayload();
    const iterations = 100;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      encodeLicense(payload, privateKey);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    expect(avgMs).toBeLessThan(1000); // < 1s per key
    console.log(`  Average key generation: ${avgMs.toFixed(2)}ms`);
  });

  it("SC-003: feature access check under 10ms", () => {
    const iterations = 10000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      resolveFeatures("pro", ["recording"]);
      resolveLimits("pro", { cameras: 100 });
      hasFeature("pro", "webrtc", ["recording"]);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    expect(avgMs).toBeLessThan(10); // < 10ms per check
    console.log(`  Average feature check: ${avgMs.toFixed(4)}ms`);
  });

  it("SC-006: tampered key rejected 100% of the time", () => {
    const payload = makePayload();
    const key = encodeLicense(payload, privateKey);
    const rejections = 100;

    let rejected = 0;
    for (let i = 0; i < rejections; i++) {
      // Tamper at random position in payload portion
      const parts = key.split(".");
      const payloadStr = parts[0]!;
      const pos = Math.floor(Math.random() * payloadStr.length);
      const char = payloadStr[pos] === "A" ? "B" : "A";
      const tampered =
        payloadStr.substring(0, pos) + char + payloadStr.substring(pos + 1) +
        "." + parts[1];

      const decoded = decodeLicense(tampered);
      if (!decoded.valid) rejected++;
    }

    expect(rejected).toBe(rejections);
    console.log(`  Tampered key rejection rate: ${rejected}/${rejections} (100%)`);
  });

  it("SC-003: getLicenseStatus computation under 10ms", () => {
    const payload = makePayload();
    const iterations = 10000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      getLicenseStatus(payload);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    expect(avgMs).toBeLessThan(10);
    console.log(`  Average status check: ${avgMs.toFixed(4)}ms`);
  });

  it("license decode + verify under 10ms", () => {
    const payload = makePayload();
    const key = encodeLicense(payload, privateKey);
    const iterations = 100;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      decodeLicense(key);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    expect(avgMs).toBeLessThan(10);
    console.log(`  Average decode+verify: ${avgMs.toFixed(2)}ms`);
  });
});
