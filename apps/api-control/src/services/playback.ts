import { randomUUID, createHmac } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/client";
import { cameras } from "../db/schema/cameras";
import { playbackSessions } from "../db/schema/playback-sessions";
import { redis } from "../lib/redis";
import { AppError } from "../middleware/error-handler";
import { logAuditEvent } from "./audit";
import { getCameraProfileSettings } from "./stream-pipeline";
import { getStreamSecurityConfig, signStreamToken } from "./stream-security";
import { getEffectivePolicy } from "./policies";

if (!process.env["SESSION_SECRET"]) {
  throw new Error("SESSION_SECRET environment variable is required");
}
const SESSION_SECRET = process.env["SESSION_SECRET"];
const ORIGIN_BASE_URL =
  process.env["ORIGIN_BASE_URL"] ?? "http://localhost:8888";

/** System-level defaults for internal sessions (no policy enforcement) */
const SYSTEM_DEFAULTS_TTL = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signToken(jti: string, cameraId: string, expiresAt: string): string {
  return createHmac("sha256", SESSION_SECRET)
    .update(`${jti}:${cameraId}:${expiresAt}`)
    .digest("hex");
}

/**
 * Resolve HLS path for external API (uses profile transcode).
 * - Transcode (h264) → cam-{id}-hls
 * - Passthrough → cam-{id} (or cam-{id}-raw if H265)
 */
function resolveExternalPath(cameraId: string, profile: { outputCodec: string }, sourceCodec: string | null): string {
  if (profile.outputCodec !== "passthrough") {
    return `cam-${cameraId}-hls`;
  }
  // Passthrough but H265 → use -raw (auto transcoded to H264)
  return sourceCodec === "H265" ? `cam-${cameraId}-raw` : `cam-${cameraId}`;
}

/**
 * Resolve HLS path for internal preview.
 * - H265 camera → cam-{id}-raw (auto transcoded)
 * - H264 camera → cam-{id} (original stream)
 */
function resolvePreviewPath(cameraId: string, sourceCodec: string | null): string {
  return sourceCodec === "H265" ? `cam-${cameraId}-raw` : `cam-${cameraId}`;
}

// ─── T071: Issue Session ──────────────────────────────────────────────────────

interface IssueSessionParams {
  cameraId: string;
  ttl?: number;
  embedOrigin?: string;
  tenantId: string;
  apiClientId: string;
  viewerIp?: string;
}

interface SessionResult {
  session_id: string;
  playback_url: string;
  protocol: string;
  codec: string;
  expires_at: string;
  ttl: number;
}

export async function issueSession(
  params: IssueSessionParams,
): Promise<SessionResult> {
  const { cameraId, embedOrigin, tenantId, apiClientId, viewerIp } = params;

  // Validate camera exists and is online
  const camera = await db.query.cameras.findFirst({
    where: eq(cameras.id, cameraId),
  });

  if (!camera) {
    throw new AppError("NOT_FOUND", "Camera not found", 404);
  }

  if (camera.healthStatus !== "online" && camera.healthStatus !== "degraded") {
    throw new AppError("CAMERA_OFFLINE", "Camera is not online", 422);
  }

  // Resolve effective policy (includes all enforcement fields)
  const policy = await getEffectivePolicy(cameraId);

  // Use ttl_default when client doesn't specify TTL
  const ttl = params.ttl ?? policy.ttl_default;

  // Validate TTL within policy range
  if (ttl < policy.ttl_min || ttl > policy.ttl_max) {
    throw new AppError(
      "VALIDATION_ERROR",
      `TTL must be between ${policy.ttl_min} and ${policy.ttl_max}`,
      422,
    );
  }

  // T076: Domain allowlist enforcement
  if (embedOrigin && policy.domain_allowlist && policy.domain_allowlist.length > 0) {
    const allowed = policy.domain_allowlist.some((domain) => {
      if (domain.startsWith("*.")) {
        const suffix = domain.slice(1);
        return embedOrigin.endsWith(suffix) || embedOrigin === domain.slice(2);
      }
      return embedOrigin === domain;
    });

    if (!allowed) {
      logAuditEvent({
        tenantId,
        actorType: "api_client",
        actorId: apiClientId,
        eventType: "session.denied",
        resourceType: "camera",
        resourceId: cameraId,
        details: { embed_origin: embedOrigin, reason: "origin_denied" },
      });
      throw new AppError("PLAYBACK_ORIGIN_DENIED", "Origin not in allowlist", 403);
    }
  }

  // Per-policy rate limit enforcement
  if (policy.rate_limit_per_min > 0) {
    const windowSeconds = 60;
    const now = Math.floor(Date.now() / 1000);
    const windowTs = Math.floor(now / windowSeconds) * windowSeconds;
    const rlKey = `policyratelimit:${apiClientId}:${cameraId}:${windowTs}`;

    try {
      const current = await redis.incr(rlKey);
      if (current === 1) {
        await redis.expire(rlKey, windowSeconds);
      }
      if (current > policy.rate_limit_per_min) {
        logAuditEvent({
          tenantId,
          actorType: "api_client",
          actorId: apiClientId,
          eventType: "session.denied",
          resourceType: "camera",
          resourceId: cameraId,
          details: { reason: "rate_limit_exceeded", limit: policy.rate_limit_per_min },
        });
        throw new AppError(
          "RATE_LIMITED",
          `Rate limit exceeded: ${policy.rate_limit_per_min} requests per minute`,
          429,
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Fail open if Redis is unavailable
      console.error("[policy-rate-limit] Redis error, failing open");
    }
  }

  // Viewer concurrency limit enforcement
  if (policy.viewer_concurrency_limit > 0) {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playbackSessions)
      .where(
        and(
          eq(playbackSessions.cameraId, cameraId),
          eq(playbackSessions.status, "active"),
          sql`${playbackSessions.expiresAt} > now()`,
        ),
      );

    if (result && result.count >= policy.viewer_concurrency_limit) {
      logAuditEvent({
        tenantId,
        actorType: "api_client",
        actorId: apiClientId,
        eventType: "session.denied",
        resourceType: "camera",
        resourceId: cameraId,
        details: {
          reason: "concurrency_limit_exceeded",
          limit: policy.viewer_concurrency_limit,
          active: result.count,
        },
      });
      throw new AppError(
        "CONCURRENCY_LIMIT",
        `Viewer concurrency limit reached: ${policy.viewer_concurrency_limit} active viewers`,
        429,
      );
    }
  }

  // Generate session ID (jti)
  const jti = randomUUID();

  // T077: Replay protection check
  const replayKey = `replay:${jti}`;
  const replayExists = await redis.exists(replayKey);
  if (replayExists) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Session ID collision detected, please retry",
      409,
    );
  }

  // Calculate expiration
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 1000);
  const expiresAtIso = expiresAt.toISOString();

  // Sign token
  const signature = signToken(jti, cameraId, expiresAtIso);

  // Build allowed origins for Redis storage
  const allowedOrigins = embedOrigin ? [embedOrigin] : null;

  // Store in Redis
  const redisKey = `session:${jti}`;
  const redisValue = JSON.stringify({
    camera_id: cameraId,
    tenant_id: tenantId,
    allowed_origins: allowedOrigins,
    expires_at: expiresAtIso,
    token_signature: signature,
  });
  await redis.set(redisKey, redisValue, "EX", ttl);

  // Insert into PostgreSQL
  await db.insert(playbackSessions).values({
    id: jti,
    cameraId,
    tenantId,
    apiClientId,
    expiresAt,
    allowedOrigins: allowedOrigins,
    viewerIp: viewerIp ?? null,
    status: "active",
  });

  // Log audit event
  logAuditEvent({
    tenantId,
    actorType: "api_client",
    actorId: apiClientId,
    eventType: "session.issued",
    resourceType: "playback_session",
    resourceId: jti,
    details: { camera_id: cameraId, ttl, embed_origin: embedOrigin ?? null },
  });

  // Build playback URL — external sessions always use HLS (browser-compatible)
  const profileSettings = await getCameraProfileSettings(cameraId, tenantId);
  const secConfig = await getStreamSecurityConfig(tenantId);

  let playbackUrl: string;
  if (secConfig.streamSecurityEnabled) {
    const tokenExpiry = Math.floor(Date.now() / 1000) + secConfig.streamTokenExpiry;
    const streamToken = signStreamToken(jti, cameraId, tokenExpiry);
    const API_BASE = process.env["API_PUBLIC_URL"] ?? "http://localhost:3001";
    const baseUrl = secConfig.cdnEnabled && secConfig.cdnOriginUrl
      ? secConfig.cdnOriginUrl
      : API_BASE;
    playbackUrl = `${baseUrl}/api/v1/stream/${streamToken}/index.m3u8`;
  } else {
    const externalPath = resolveExternalPath(cameraId, profileSettings, camera.sourceCodec);
    playbackUrl = `${ORIGIN_BASE_URL}/${externalPath}/index.m3u8`;
  }

  return {
    session_id: jti,
    playback_url: playbackUrl,
    protocol: "hls",
    codec: profileSettings.outputCodec,
    expires_at: expiresAtIso,
    ttl,
  };
}

// ─── Internal Session (no policy enforcement) ────────────────────────────────

interface IssueInternalSessionParams {
  cameraId: string;
  tenantId: string;
  userId: string;
  viewerIp?: string;
}

/**
 * Issue a playback session for internal console-web use.
 * Skips policy enforcement — uses system defaults only.
 */
export async function issueInternalSession(
  params: IssueInternalSessionParams,
): Promise<SessionResult> {
  const { cameraId, tenantId, userId, viewerIp } = params;
  const ttl = SYSTEM_DEFAULTS_TTL; // 300s default for internal

  const camera = await db.query.cameras.findFirst({
    where: eq(cameras.id, cameraId),
  });

  if (!camera) {
    throw new AppError("NOT_FOUND", "Camera not found", 404);
  }

  if (camera.healthStatus !== "online" && camera.healthStatus !== "degraded") {
    throw new AppError("CAMERA_OFFLINE", "Camera is not online", 422);
  }

  // No policy enforcement — internal viewers always get system defaults

  const jti = randomUUID();

  const replayKey = `replay:${jti}`;
  const replayExists = await redis.exists(replayKey);
  if (replayExists) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Session ID collision detected, please retry",
      409,
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 1000);
  const expiresAtIso = expiresAt.toISOString();

  const signature = signToken(jti, cameraId, expiresAtIso);

  const redisKey = `session:${jti}`;
  const redisValue = JSON.stringify({
    camera_id: cameraId,
    tenant_id: tenantId,
    allowed_origins: null,
    expires_at: expiresAtIso,
    token_signature: signature,
  });
  await redis.set(redisKey, redisValue, "EX", ttl);

  await db.insert(playbackSessions).values({
    id: jti,
    cameraId,
    tenantId,
    apiClientId: userId,
    expiresAt,
    allowedOrigins: null,
    viewerIp: viewerIp ?? null,
    status: "active",
  });

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId: userId,
    eventType: "session.issued",
    resourceType: "playback_session",
    resourceId: jti,
    details: { camera_id: cameraId, ttl, internal: true },
  });

  // Internal preview: H265 → -raw (auto transcoded), H264 → original
  const previewPath = resolvePreviewPath(cameraId, camera.sourceCodec);
  const playbackUrl = `${ORIGIN_BASE_URL}/${previewPath}/index.m3u8`;

  return {
    session_id: jti,
    playback_url: playbackUrl,
    stream_path: `${previewPath}/index.m3u8`,
    protocol: "hls",
    codec: camera.sourceCodec === "H265" ? "h264" : "passthrough",
    expires_at: expiresAtIso,
    ttl,
  };
}

// ─── T072: Refresh Session ────────────────────────────────────────────────────

interface RefreshResult {
  session_id: string;
  expires_at: string;
}

export async function refreshSession(
  sessionId: string,
  tenantId: string,
): Promise<RefreshResult> {
  const redisKey = `session:${sessionId}`;
  const raw = await redis.get(redisKey);

  if (!raw) {
    throw new AppError(
      "PLAYBACK_SESSION_EXPIRED",
      "Session not found or expired",
      403,
    );
  }

  const session = JSON.parse(raw) as {
    camera_id: string;
    tenant_id: string;
    allowed_origins: string[] | null;
    expires_at: string;
    token_signature: string;
  };

  // Calculate new expiration based on original TTL (re-derive from current Redis TTL)
  const currentTtl = await redis.ttl(redisKey);
  // Use remaining TTL or default 120s for extension
  const extensionTtl = currentTtl > 0 ? currentTtl : 120;

  const newExpiresAt = new Date(Date.now() + extensionTtl * 1000);
  const newExpiresAtIso = newExpiresAt.toISOString();

  // Update Redis session data with new expiration
  session.expires_at = newExpiresAtIso;
  await redis.set(redisKey, JSON.stringify(session), "EX", extensionTtl);

  // Update PostgreSQL
  await db
    .update(playbackSessions)
    .set({ expiresAt: newExpiresAt })
    .where(eq(playbackSessions.id, sessionId));

  // Log audit event
  logAuditEvent({
    tenantId,
    actorType: "api_client",
    eventType: "session.refreshed",
    resourceType: "playback_session",
    resourceId: sessionId,
    details: { new_expires_at: newExpiresAtIso },
  });

  return {
    session_id: sessionId,
    expires_at: newExpiresAtIso,
  };
}

// ─── T073: Revoke Session ─────────────────────────────────────────────────────

export async function revokeSession(
  sessionId: string,
  tenantId: string,
): Promise<void> {
  // Delete Redis key
  await redis.del(`session:${sessionId}`);

  // T077: Add to replay protection set (24h TTL)
  const replayKey = `replay:${sessionId}`;
  await redis.set(replayKey, "1", "EX", 86400); // 24 hours

  // Update PostgreSQL
  await db
    .update(playbackSessions)
    .set({
      status: "revoked",
      revokedAt: new Date(),
    })
    .where(eq(playbackSessions.id, sessionId));

  // Log audit event
  logAuditEvent({
    tenantId,
    actorType: "api_client",
    eventType: "session.revoked",
    resourceType: "playback_session",
    resourceId: sessionId,
  });
}

// ─── T074: Batch Create Sessions ──────────────────────────────────────────────

interface BatchResult {
  session_id?: string;
  camera_id: string;
  playback_url?: string;
  expires_at?: string;
  ttl?: number;
  error?: string;
}

export async function batchCreateSessions(params: {
  cameraIds: string[];
  ttl?: number;
  embedOrigin?: string;
  tenantId: string;
  apiClientId: string;
  viewerIp?: string;
}): Promise<BatchResult[]> {
  const { cameraIds, ttl, embedOrigin, tenantId, apiClientId, viewerIp } =
    params;

  const results = await Promise.allSettled(
    cameraIds.map((cameraId) =>
      issueSession({
        cameraId,
        ttl,
        embedOrigin,
        tenantId,
        apiClientId,
        viewerIp,
      }),
    ),
  );

  return results.map((result, index) => {
    const cameraId = cameraIds[index]!;
    if (result.status === "fulfilled") {
      return {
        camera_id: cameraId,
        session_id: result.value.session_id,
        playback_url: result.value.playback_url,
        expires_at: result.value.expires_at,
        ttl: result.value.ttl,
      };
    }
    return {
      camera_id: cameraId,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });
}
