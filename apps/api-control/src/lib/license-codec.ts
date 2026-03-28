/**
 * License key encoding/decoding with Ed25519 signature verification.
 *
 * Key format: BASE64URL(json_payload).BASE64URL(ed25519_signature)
 */

import { sign, verify } from "./ed25519";
import type { PlanTier } from "./plan-definitions";

export interface LicensePayload {
  id: string;
  tenant: string;
  plan: PlanTier;
  limits: {
    cameras: number;
    projects: number;
    users: number;
    sites: number;
    api_keys: number;
    viewer_hours: number;
    retention_days: number;
  };
  addons: string[];
  issuedAt: string;
  expiresAt: string;
}

export interface DecodedLicense {
  payload: LicensePayload;
  valid: boolean;
  error?: string;
}

/**
 * Encode a license payload and sign it with Ed25519 private key.
 * Returns: "BASE64URL(payload).BASE64URL(signature)"
 */
export function encodeLicense(
  payload: LicensePayload,
  privateKey: Uint8Array,
): string {
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const payloadB64 = base64urlEncode(payloadBytes);

  const signature = sign(payloadBytes, privateKey);
  const signatureB64 = base64urlEncode(signature);

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Decode and verify a license key.
 * Returns the payload if valid, or an error message if invalid.
 */
export function decodeLicense(licenseKey: string): DecodedLicense {
  try {
    const parts = licenseKey.split(".");
    if (parts.length !== 2) {
      return { payload: null as any, valid: false, error: "Invalid license key format" };
    }

    const [payloadB64, signatureB64] = parts;

    // Decode payload
    const payloadBytes = base64urlDecode(payloadB64!);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadJson) as LicensePayload;

    // Validate required fields
    if (!payload.id || !payload.tenant || !payload.plan || !payload.expiresAt) {
      return { payload, valid: false, error: "Missing required license fields" };
    }

    // Verify signature
    const signatureBytes = base64urlDecode(signatureB64!);
    const isValid = verify(signatureBytes, payloadBytes);

    if (!isValid) {
      return { payload, valid: false, error: "Invalid license key signature" };
    }

    return { payload, valid: true };
  } catch (err) {
    return {
      payload: null as any,
      valid: false,
      error: `Invalid license key: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check if a license payload has expired (ignoring grace period).
 */
export function isExpired(payload: LicensePayload): boolean {
  return new Date(payload.expiresAt) < new Date();
}

/**
 * Check if a license is in grace period (expired but within 30 days).
 */
export function isInGracePeriod(payload: LicensePayload): boolean {
  const expiryDate = new Date(payload.expiresAt);
  const now = new Date();
  if (expiryDate >= now) return false;

  const diffMs = now.getTime() - expiryDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 30;
}

/**
 * Get days remaining until expiry (negative if expired).
 */
export function daysRemaining(payload: LicensePayload): number {
  const expiryDate = new Date(payload.expiresAt);
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get license status string.
 */
export function getLicenseStatus(
  payload: LicensePayload,
): "active" | "expiring" | "grace_period" | "read_only" {
  const days = daysRemaining(payload);

  if (days > 30) return "active";
  if (days > 0) return "expiring";
  if (days >= -30) return "grace_period";
  return "read_only";
}

// ─── Base64url helpers ───────────────────────────────────────────────────────

function base64urlEncode(data: Uint8Array): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(base64, "base64"));
}
