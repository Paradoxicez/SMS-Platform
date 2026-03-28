import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client";
import { mediamtxConfigs, mediamtxConfigHistory } from "../db/schema";
import { logAuditEvent } from "./audit";
import { mediamtxFetch } from "../lib/mediamtx-fetch";

// Default config used when no DB record exists yet
const DEFAULT_CONFIG: Record<string, unknown> = {
  logLevel: "info",
  logDestinations: ["stdout"],
  readTimeout: "10s",
  writeTimeout: "10s",
  rtsp: true,
  rtspAddress: ":8554",
  hls: true,
  hlsAddress: ":8888",
  hlsSegmentDuration: "2s",
  hlsPartDuration: "200ms",
  hlsSegmentCount: 5,
  webrtc: false,
  rtmp: false,
  srt: false,
  api: true,
  apiAddress: ":9997",
  metrics: true,
  metricsAddress: ":9998",
};

/**
 * Get config from DB. If no record exists, seed from Stream Engine live config.
 */
export async function getConfig(tenantId: string) {
  const [existing] = await db
    .select()
    .from(mediamtxConfigs)
    .where(eq(mediamtxConfigs.tenantId, tenantId))
    .limit(1);

  if (existing) {
    return {
      config: existing.config,
      version: existing.version,
      updatedAt: existing.updatedAt,
    };
  }

  // No DB record — seed from live Stream Engine or defaults
  let liveConfig: Record<string, unknown>;
  try {
    const res = await mediamtxFetch("/v3/config/global/get");
    liveConfig = res.ok ? (await res.json()) as Record<string, unknown> : DEFAULT_CONFIG;
  } catch {
    liveConfig = DEFAULT_CONFIG;
  }

  // Insert initial record
  const [created] = await db
    .insert(mediamtxConfigs)
    .values({
      tenantId,
      config: liveConfig,
      version: 1,
    })
    .returning();

  return {
    config: created!.config,
    version: created!.version,
    updatedAt: created!.updatedAt,
  };
}

/**
 * Update config: save to DB + push to Stream Engine API + log history.
 */
export async function updateConfig(
  tenantId: string,
  patch: Record<string, unknown>,
  version: number,
  userId?: string,
  reason?: string,
  sourceIp?: string
) {
  // Get current config
  const [current] = await db
    .select()
    .from(mediamtxConfigs)
    .where(eq(mediamtxConfigs.tenantId, tenantId))
    .limit(1);

  if (!current) {
    // Seed first
    await getConfig(tenantId);
    return updateConfig(tenantId, patch, 1, userId, reason, sourceIp);
  }

  // Optimistic concurrency check
  if (current.version !== version) {
    throw new Error(
      `Config was modified by another user. Expected version ${version}, current is ${current.version}. Please reload and try again.`
    );
  }

  // Merge patch into current config
  const previousConfig = { ...current.config };
  const newConfig = { ...current.config, ...patch };
  const changedFields = Object.keys(patch).filter(
    (key) => JSON.stringify(previousConfig[key]) !== JSON.stringify(patch[key])
  );

  if (changedFields.length === 0) {
    return { config: current.config, version: current.version, changed: false };
  }

  // Separate app-only fields from Stream Engine native fields
  const APP_ONLY_FIELDS = new Set([
    "streamSecurityEnabled",
    "streamTokenExpiry",
    "cdnEnabled",
    "cdnOriginUrl",
  ]);

  const mediamtxPatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!APP_ONLY_FIELDS.has(key)) {
      mediamtxPatch[key] = value;
    }
  }

  // Push to Stream Engine API (hot-reload) — only native fields
  if (Object.keys(mediamtxPatch).length > 0) {
    try {
      const res = await mediamtxFetch("/v3/config/global/patch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mediamtxPatch),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Stream Engine rejected config: ${body}`);
      }
    } catch (err) {
      throw new Error(
        `Failed to apply config to Stream Engine: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Save to DB (after Stream Engine accepts it)
  const newVersion = current.version + 1;
  const [updated] = await db
    .update(mediamtxConfigs)
    .set({
      config: newConfig,
      version: newVersion,
      updatedBy: userId ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediamtxConfigs.tenantId, tenantId),
        eq(mediamtxConfigs.version, version)
      )
    )
    .returning();

  if (!updated) {
    throw new Error("Concurrent update detected. Please reload.");
  }

  // Record history
  await db.insert(mediamtxConfigHistory).values({
    tenantId,
    configId: current.id,
    previousConfig,
    newConfig,
    changedFields,
    changedBy: userId ?? null,
    changeReason: reason ?? null,
  });

  // Audit log
  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId: userId,
    eventType: "mediamtx.config_changed",
    resourceType: "mediamtx_config",
    resourceId: current.id,
    details: { changedFields, reason },
    sourceIp,
  });

  return { config: newConfig, version: newVersion, changed: true };
}

/**
 * Get config change history for a tenant.
 */
export async function getConfigHistory(tenantId: string, limit = 20) {
  return db
    .select()
    .from(mediamtxConfigHistory)
    .where(eq(mediamtxConfigHistory.tenantId, tenantId))
    .orderBy(desc(mediamtxConfigHistory.createdAt))
    .limit(limit);
}

/**
 * List active Stream Engine paths (live from API).
 */
export async function listPaths() {
  const res = await mediamtxFetch("/v3/paths/list");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stream Engine list paths failed (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * Sync DB config to Stream Engine (called on data-plane-worker startup).
 */
export async function syncConfigToStreamEngine(tenantId: string) {
  const { config } = await getConfig(tenantId);
  try {
    await mediamtxFetch("/v3/config/global/patch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    return { synced: true };
  } catch (err) {
    return {
      synced: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
