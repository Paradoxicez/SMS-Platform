import { createHmac } from "node:crypto";
import { redis } from "../lib/redis";
import { getConfig } from "./mediamtx-config";

const SIGNING_SECRET =
  process.env["STREAM_SIGNING_SECRET"] ?? "dev-stream-signing-secret";

export interface StreamSecurityConfig {
  streamSecurityEnabled: boolean;
  streamTokenExpiry: number; // seconds
  domainAllowlistEnabled: boolean;
  domainAllowlist: string[];
  cdnEnabled: boolean;
  cdnOriginUrl: string;
}

const DEFAULTS: StreamSecurityConfig = {
  streamSecurityEnabled: false,
  streamTokenExpiry: 300,
  domainAllowlistEnabled: false,
  domainAllowlist: [],
  cdnEnabled: false,
  cdnOriginUrl: "",
};

/**
 * Get stream security config from the mediamtx config record.
 */
export async function getStreamSecurityConfig(
  tenantId: string,
): Promise<StreamSecurityConfig> {
  try {
    const { config } = await getConfig(tenantId);
    return {
      streamSecurityEnabled:
        (config.streamSecurityEnabled as boolean) ?? DEFAULTS.streamSecurityEnabled,
      streamTokenExpiry:
        (config.streamTokenExpiry as number) ?? DEFAULTS.streamTokenExpiry,
      domainAllowlistEnabled:
        (config.domainAllowlistEnabled as boolean) ?? DEFAULTS.domainAllowlistEnabled,
      domainAllowlist:
        (config.domainAllowlist as string[]) ?? DEFAULTS.domainAllowlist,
      cdnEnabled: (config.cdnEnabled as boolean) ?? DEFAULTS.cdnEnabled,
      cdnOriginUrl: (config.cdnOriginUrl as string) ?? DEFAULTS.cdnOriginUrl,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Generate a signed stream token for a playback session.
 */
export function signStreamToken(
  sessionId: string,
  cameraId: string,
  expiry: number, // unix timestamp
): string {
  const payload = `${sessionId}:${cameraId}:${expiry}`;
  const sig = createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 32); // short signature
  // Token format: base64(sessionId:cameraId:expiry:sig)
  return Buffer.from(`${sessionId}:${cameraId}:${expiry}:${sig}`).toString(
    "base64url",
  );
}

/**
 * Verify and decode a signed stream token.
 * Returns { sessionId, cameraId } if valid, null otherwise.
 */
export function verifyStreamToken(
  token: string,
): { sessionId: string; cameraId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 4) return null;

    // Reconstruct: last part is sig, third-to-last is expiry
    // Format: sessionId:cameraId:expiry:sig
    const sig = parts.pop()!;
    const expiry = parseInt(parts.pop()!, 10);
    const cameraId = parts.pop()!;
    const sessionId = parts.join(":"); // sessionId may contain colons (UUID doesn't, but safe)

    // Check expiry
    if (Date.now() > expiry * 1000) return null;

    // Verify signature
    const payload = `${sessionId}:${cameraId}:${expiry}`;
    const expectedSig = createHmac("sha256", SIGNING_SECRET)
      .update(payload)
      .digest("hex")
      .slice(0, 32);

    if (sig !== expectedSig) return null;

    return { sessionId, cameraId };
  } catch {
    return null;
  }
}

/**
 * Check if a domain matches the allowlist.
 */
export function isDomainAllowed(
  origin: string | undefined,
  allowlist: string[],
): boolean {
  if (!origin) return false;

  // Extract hostname from origin
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    hostname = origin;
  }

  for (const pattern of allowlist) {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // .example.com
      if (hostname.endsWith(suffix) || hostname === pattern.slice(2)) {
        return true;
      }
    } else {
      if (hostname === pattern) return true;
    }
  }

  return false;
}
