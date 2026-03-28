import { randomUUID, createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { cameras } from "../db/schema/cameras";
import { policies } from "../db/schema/policies";
import { projects } from "../db/schema/projects";
import { sites } from "../db/schema/sites";
import { playbackSessions } from "../db/schema/playback-sessions";
import { redis } from "../lib/redis";
import { AppError } from "../middleware/error-handler";
import { logAuditEvent } from "./audit";
import { getCameraProfileSettings } from "./stream-pipeline";
import { getStreamSecurityConfig, signStreamToken } from "./stream-security";

const SESSION_SECRET =
  process.env["SESSION_SECRET"] ?? "dev-session-secret-change-me";
const ORIGIN_BASE_URL =
  process.env["ORIGIN_BASE_URL"] ?? "http://localhost:8888";

/** System-level defaults when no policy is found */
const SYSTEM_DEFAULTS = {
  ttlMin: 60,
  ttlMax: 300,
  ttlDefault: 120,
  domainAllowlist: null as string[] | null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signToken(jti: string, cameraId: string, expiresAt: string): string {
  return createHmac("sha256", SESSION_SECRET)
    .update(`${jti}:${cameraId}:${expiresAt}`)
    .digest("hex");
}

interface EffectivePolicy {
  ttlMin: number;
  ttlMax: number;
  ttlDefault: number;
  domainAllowlist: string[] | null;
}

/**
 * Resolve the effective policy for a camera:
 *   camera.policyId -> project.defaultPolicyId -> system defaults
 */
async function resolvePolicy(camera: {
  policyId: string | null;
  siteId: string;
}): Promise<EffectivePolicy> {
  // 1. Camera-level policy
  if (camera.policyId) {
    const policy = await db.query.policies.findFirst({
      where: eq(policies.id, camera.policyId),
    });
    if (policy) {
      return {
        ttlMin: policy.ttlMin,
        ttlMax: policy.ttlMax,
        ttlDefault: policy.ttlDefault,
        domainAllowlist: policy.domainAllowlist,
      };
    }
  }

  // 2. Project-level default policy (camera -> site -> project)
  const site = await db.query.sites.findFirst({
    where: eq(sites.id, camera.siteId),
  });

  if (site) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, site.projectId),
    });

    if (project?.defaultPolicyId) {
      const policy = await db.query.policies.findFirst({
        where: eq(policies.id, project.defaultPolicyId),
      });
      if (policy) {
        return {
          ttlMin: policy.ttlMin,
          ttlMax: policy.ttlMax,
          ttlDefault: policy.ttlDefault,
          domainAllowlist: policy.domainAllowlist,
        };
      }
    }
  }

  // 3. System defaults
  return { ...SYSTEM_DEFAULTS };
}

// ─── T071: Issue Session ──────────────────────────────────────────────────────

interface IssueSessionParams {
  cameraId: string;
  ttl: number;
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
  const { cameraId, ttl, embedOrigin, tenantId, apiClientId, viewerIp } =
    params;

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

  // Resolve effective policy
  const policy = await resolvePolicy(camera);

  // Validate TTL within policy range
  if (ttl < policy.ttlMin || ttl > policy.ttlMax) {
    throw new AppError(
      "VALIDATION_ERROR",
      `TTL must be between ${policy.ttlMin} and ${policy.ttlMax}`,
      422,
    );
  }

  // T076: Domain allowlist enforcement
  if (embedOrigin && policy.domainAllowlist && policy.domainAllowlist.length > 0) {
    const allowed = policy.domainAllowlist.some((domain) => {
      // Support wildcard subdomains: *.example.com
      if (domain.startsWith("*.")) {
        const suffix = domain.slice(1); // .example.com
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

  // Build playback URL based on profile settings + security config
  const profileSettings = await getCameraProfileSettings(cameraId, tenantId);
  const secConfig = await getStreamSecurityConfig(tenantId);

  let playbackUrl: string;
  if (profileSettings.outputProtocol === "webrtc" && profileSettings.outputCodec === "passthrough") {
    // WebRTC only — return WebRTC WHEP URL
    const WEBRTC_BASE = process.env["WEBRTC_BASE_URL"] ?? "http://localhost:8889";
    playbackUrl = `${WEBRTC_BASE}/cam-${cameraId}/whep`;
  } else if (secConfig.streamSecurityEnabled) {
    // Security enabled — use signed proxy URL
    const tokenExpiry = Math.floor(Date.now() / 1000) + secConfig.streamTokenExpiry;
    const streamToken = signStreamToken(jti, cameraId, tokenExpiry);
    const API_BASE = process.env["API_PUBLIC_URL"] ?? "http://localhost:3001";
    const baseUrl = secConfig.cdnEnabled && secConfig.cdnOriginUrl
      ? secConfig.cdnOriginUrl
      : API_BASE;
    playbackUrl = `${baseUrl}/api/v1/stream/${streamToken}/index.m3u8`;
  } else {
    // No security — direct MediaMTX URL
    playbackUrl = `${ORIGIN_BASE_URL}/cam-${cameraId}-hls/index.m3u8`;
  }

  return {
    session_id: jti,
    playback_url: playbackUrl,
    protocol: profileSettings.outputProtocol,
    codec: profileSettings.outputCodec,
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
  ttl: number;
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
