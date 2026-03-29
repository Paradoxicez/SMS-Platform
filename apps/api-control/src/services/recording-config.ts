import { eq, and } from "drizzle-orm";
import { withTenantContext } from "../db/client";
import { recordingConfigs } from "../db/schema";

export type ScopeType = "global" | "site" | "project" | "camera";

export interface RecordingConfig {
  mode: string;
  schedule?: unknown;
  retentionDays: number;
  autoPurge: boolean;
  storageType: string;
  storagePath?: string | null;
  s3Config?: unknown;
  format: string;
  resolution: string;
  maxSegmentSizeMb: number;
  segmentDurationMinutes: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: RecordingConfig = {
  mode: "continuous",
  retentionDays: 30,
  autoPurge: true,
  storageType: "local",
  format: "fmp4",
  resolution: "original",
  maxSegmentSizeMb: 1024,
  segmentDurationMinutes: 60,
  enabled: true,
};

/**
 * Get recording config for a specific scope.
 * Returns null if no config exists at this scope.
 */
export async function getConfigForScope(
  tenantId: string,
  scopeType: ScopeType,
  scopeId?: string,
) {
  return withTenantContext(tenantId, async (tx) => {
    const conditions = [
      eq(recordingConfigs.tenantId, tenantId),
      eq(recordingConfigs.scopeType, scopeType),
    ];
    if (scopeId) {
      conditions.push(eq(recordingConfigs.scopeId, scopeId));
    }

    return tx.query.recordingConfigs.findFirst({
      where: and(...conditions),
    });
  });
}

/**
 * Resolve effective recording config for a camera using scope inheritance.
 * Camera → Project → Site → Global → Default
 */
export async function resolveEffectiveConfig(
  tenantId: string,
  cameraId: string,
  projectId?: string,
  siteId?: string,
): Promise<RecordingConfig & { inheritedFrom: string }> {
  // Camera-level override
  const cameraConfig = await getConfigForScope(tenantId, "camera", cameraId);
  if (cameraConfig) return { ...configToRecord(cameraConfig), inheritedFrom: "camera" };

  // Project-level override
  if (projectId) {
    const projectConfig = await getConfigForScope(tenantId, "project", projectId);
    if (projectConfig) return { ...configToRecord(projectConfig), inheritedFrom: "project" };
  }

  // Site-level override
  if (siteId) {
    const siteConfig = await getConfigForScope(tenantId, "site", siteId);
    if (siteConfig) return { ...configToRecord(siteConfig), inheritedFrom: "site" };
  }

  // Global override
  const globalConfig = await getConfigForScope(tenantId, "global");
  if (globalConfig) return { ...configToRecord(globalConfig), inheritedFrom: "global" };

  // Default
  return { ...DEFAULT_CONFIG, inheritedFrom: "default" };
}

/**
 * Upsert recording config for a scope.
 */
export async function upsertConfig(
  tenantId: string,
  scopeType: ScopeType,
  scopeId: string | undefined,
  config: Partial<RecordingConfig>,
) {
  return withTenantContext(tenantId, async (tx) => {
    const existing = await getConfigForScope(tenantId, scopeType, scopeId);

    if (existing) {
      const [updated] = await tx
        .update(recordingConfigs)
        .set({
          ...config,
          updatedAt: new Date(),
        })
        .where(eq(recordingConfigs.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(recordingConfigs)
      .values({
        tenantId,
        scopeType,
        scopeId: scopeId ?? null,
        ...DEFAULT_CONFIG,
        ...config,
      })
      .returning();
    return created;
  });
}

/**
 * List all recording config overrides for a tenant.
 */
export async function listAllOverrides(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    return tx
      .select()
      .from(recordingConfigs)
      .where(eq(recordingConfigs.tenantId, tenantId));
  });
}

/**
 * Delete a scope override (falls back to parent scope).
 */
export async function deleteConfig(
  tenantId: string,
  scopeType: ScopeType,
  scopeId?: string,
) {
  return withTenantContext(tenantId, async (tx) => {
    const existing = await getConfigForScope(tenantId, scopeType, scopeId);
    if (!existing) return false;

    await tx.delete(recordingConfigs).where(eq(recordingConfigs.id, existing.id));
    return true;
  });
}

/**
 * Get storage usage summary for a tenant.
 */
export async function getStorageUsage(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    const { recordings } = await import("../db/schema/recordings");
    const { sql } = await import("drizzle-orm");

    const [result] = await tx
      .select({
        totalBytes: sql<number>`COALESCE(SUM(${recordings.sizeBytes}), 0)`,
        totalCount: sql<number>`COUNT(*)`,
      })
      .from(recordings)
      .where(eq(recordings.tenantId, tenantId));

    // Top cameras by storage
    const topCameras = await tx
      .select({
        cameraId: recordings.cameraId,
        totalBytes: sql<number>`COALESCE(SUM(${recordings.sizeBytes}), 0)`,
        recordingCount: sql<number>`COUNT(*)`,
      })
      .from(recordings)
      .where(eq(recordings.tenantId, tenantId))
      .groupBy(recordings.cameraId)
      .orderBy(sql`SUM(${recordings.sizeBytes}) DESC`)
      .limit(5);

    return {
      total_bytes: Number(result?.totalBytes ?? 0),
      total_count: Number(result?.totalCount ?? 0),
      top_cameras: topCameras.map((c) => ({
        camera_id: c.cameraId,
        total_bytes: Number(c.totalBytes),
        recording_count: Number(c.recordingCount),
      })),
    };
  });
}

function configToRecord(row: typeof recordingConfigs.$inferSelect): RecordingConfig {
  return {
    mode: row.mode,
    schedule: row.schedule,
    retentionDays: row.retentionDays,
    autoPurge: row.autoPurge,
    storageType: row.storageType,
    storagePath: row.storagePath,
    s3Config: row.s3Config,
    format: row.format,
    resolution: row.resolution,
    maxSegmentSizeMb: row.maxSegmentSizeMb,
    segmentDurationMinutes: row.segmentDurationMinutes,
    enabled: row.enabled,
  };
}
