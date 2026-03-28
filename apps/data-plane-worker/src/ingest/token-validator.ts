import { createHmac } from "node:crypto";
import Redis from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const SESSION_SECRET =
  process.env["SESSION_SECRET"] ?? "dev-session-secret-change-me";

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

interface ValidResult {
  valid: true;
  cameraId: string;
  tenantId: string;
}

interface InvalidResult {
  valid: false;
  reason: "malformed" | "expired" | "invalid_signature" | "expired_time";
}

type ValidationResult = ValidResult | InvalidResult;

/**
 * T078: Validate an HLS playback token.
 *
 * Token format: `{jti}.{hmac_signature}`
 *
 * Steps:
 * 1. Parse token into jti + signature
 * 2. Look up session:{jti} in Redis
 * 3. Verify HMAC signature
 * 4. Check expiration
 * 5. Optionally check origin header
 */
export async function validateToken(
  token: string,
  origin?: string,
): Promise<ValidationResult> {
  // Parse token
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) {
    return { valid: false, reason: "malformed" };
  }

  const jti = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  if (!jti || !signature) {
    return { valid: false, reason: "malformed" };
  }

  // Look up session in Redis
  const redisKey = `session:${jti}`;
  const raw = await redis.get(redisKey);

  if (!raw) {
    return { valid: false, reason: "expired" };
  }

  const session = JSON.parse(raw) as {
    camera_id: string;
    tenant_id: string;
    allowed_origins: string[] | null;
    expires_at: string;
    token_signature: string;
  };

  // Verify HMAC signature
  const expectedSignature = createHmac("sha256", SESSION_SECRET)
    .update(`${jti}:${session.camera_id}:${session.expires_at}`)
    .digest("hex");

  if (signature !== expectedSignature) {
    return { valid: false, reason: "invalid_signature" };
  }

  // Check expiration
  const expiresAt = new Date(session.expires_at);
  if (Date.now() >= expiresAt.getTime()) {
    return { valid: false, reason: "expired_time" };
  }

  // Check origin if provided and allowlist is set
  if (
    origin &&
    session.allowed_origins &&
    session.allowed_origins.length > 0
  ) {
    const originAllowed = session.allowed_origins.some((allowed) => {
      if (allowed.startsWith("*.")) {
        const suffix = allowed.slice(1);
        return origin.endsWith(suffix) || origin === allowed.slice(2);
      }
      return origin === allowed;
    });

    if (!originAllowed) {
      return { valid: false, reason: "expired" };
    }
  }

  return {
    valid: true,
    cameraId: session.camera_id,
    tenantId: session.tenant_id,
  };
}
