import { eq, and, sql, count, ilike, inArray } from "drizzle-orm";
import { db, withTenantContext, type Database } from "../db/client";
import { cameras, streams } from "../db/schema";
import { logAuditEvent } from "./audit";
import { AppError } from "../middleware/error-handler";
import type { CreateCameraInput, UpdateCameraInput } from "@repo/types";
import { getEffectiveProfile } from "./stream-profiles";
import { setupCameraPipeline } from "./stream-pipeline";
import Redis from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL);
  }
  return redis;
}

interface OnboardCameraParams {
  tenantId: string;
  siteId: string;
  data: CreateCameraInput;
  actorId: string;
  sourceIp?: string;
}

export async function onboardCamera(params: OnboardCameraParams) {
  const { tenantId, siteId, data, actorId, sourceIp } = params;

  const [camera] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(cameras)
      .values({
        siteId,
        tenantId,
        name: data.name,
        rtspUrl: data.rtsp_url,
        credentialsEncrypted: data.credentials_encrypted ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        tags: data.tags ?? [],
        mapVisible: data.map_visible ?? false,
        healthStatus: "connecting",
        policyId: data.policy_id ?? null,
        profileId: data.profile_id ?? null,
      })
      .returning();
  });

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "camera.created",
    resourceType: "camera",
    resourceId: camera!.id,
    details: { name: data.name, siteId },
    sourceIp,
  });

  // Setup streaming pipeline (fire and forget)
  // Uses Stream Profile settings to build FFmpeg command
  setupAndMonitor(camera!.id, tenantId, data.rtsp_url).catch((err) => {
    console.error(
      JSON.stringify({
        level: "error",
        service: "camera",
        message: "Failed to setup stream pipeline",
        cameraId: camera!.id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });

  return camera!;
}

/**
 * Setup camera streaming pipeline using Stream Profile settings.
 * Called on camera onboard and manual start.
 */
async function setupAndMonitor(
  cameraId: string,
  tenantId: string,
  streamUrl: string,
): Promise<void> {
  try {
    const result = await setupCameraPipeline(cameraId, tenantId, streamUrl);

    if (!result.success) {
      console.error(`Pipeline setup failed for ${cameraId}: ${result.error}`);
      await db.update(cameras).set({ healthStatus: "offline" }).where(eq(cameras.id, cameraId));
      return;
    }

    // stream-sync will pick up the status in the next cycle (30s)
    // but also do a quick check after 10s
    setTimeout(async () => {
      try {
        const { mediamtxFetch } = await import("../lib/mediamtx-fetch");
        const res = await mediamtxFetch("/v3/paths/list");
        if (res.ok) {
          const list = await res.json();
          const path = (list.items || []).find((p: any) => p.name === `cam-${cameraId}`);
          if (path?.ready) {
            await db.update(cameras).set({ healthStatus: "online" }).where(eq(cameras.id, cameraId));
          }
        }
      } catch { /* stream-sync will handle it */ }
    }, 10000);
  } catch (err) {
    console.error("Pipeline setup error:", err instanceof Error ? err.message : String(err));
    await db.update(cameras).set({ healthStatus: "offline" }).where(eq(cameras.id, cameraId));
  }
}

interface UpdateCameraParams {
  tenantId: string;
  id: string;
  data: UpdateCameraInput;
  actorId: string;
  sourceIp?: string;
}

export async function updateCamera(params: UpdateCameraParams) {
  const { tenantId, id, data, actorId, sourceIp } = params;
  const { version, ...updateFields } = data;

  const updateData: Record<string, unknown> = {};
  if (updateFields.name !== undefined) updateData.name = updateFields.name;
  if (updateFields.rtsp_url !== undefined) updateData.rtspUrl = updateFields.rtsp_url;
  if (updateFields.credentials_encrypted !== undefined)
    updateData.credentialsEncrypted = updateFields.credentials_encrypted;
  if (updateFields.lat !== undefined) updateData.lat = updateFields.lat;
  if (updateFields.lng !== undefined) updateData.lng = updateFields.lng;
  if (updateFields.tags !== undefined) updateData.tags = updateFields.tags;
  if (updateFields.map_visible !== undefined) updateData.mapVisible = updateFields.map_visible;
  if (updateFields.policy_id !== undefined) updateData.policyId = updateFields.policy_id;
  updateData.updatedAt = new Date();
  updateData.version = sql`${cameras.version} + 1`;

  const [camera] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .update(cameras)
      .set(updateData)
      .where(
        and(
          eq(cameras.id, id),
          eq(cameras.tenantId, tenantId),
          eq(cameras.version, version),
        ),
      )
      .returning();
  });

  if (!camera) {
    // Check if the camera exists at all
    const existing = await withTenantContext(tenantId, async (tx) => {
      return tx.query.cameras.findFirst({
        where: and(eq(cameras.id, id), eq(cameras.tenantId, tenantId)),
      });
    });

    if (!existing) {
      throw new AppError("NOT_FOUND", "Camera not found", 404);
    }
    throw new AppError(
      "CONFLICT",
      "Camera was modified by another request. Please refresh and try again.",
      409,
    );
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "camera.updated",
    resourceType: "camera",
    resourceId: camera.id,
    details: updateFields,
    sourceIp,
  });

  return camera;
}

interface DeleteCameraParams {
  tenantId: string;
  id: string;
  actorId: string;
  sourceIp?: string;
}

export async function deleteCamera(params: DeleteCameraParams) {
  const { tenantId, id, actorId, sourceIp } = params;

  // Check for active streams
  const activeStream = await withTenantContext(tenantId, async (tx) => {
    return tx.query.streams.findFirst({
      where: and(eq(streams.cameraId, id), eq(streams.tenantId, tenantId)),
    });
  });

  if (activeStream) {
    throw new AppError(
      "CONFLICT",
      "Cannot delete camera with an active stream. Stop the stream first.",
      409,
    );
  }

  const [camera] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .delete(cameras)
      .where(and(eq(cameras.id, id), eq(cameras.tenantId, tenantId)))
      .returning();
  });

  if (!camera) {
    throw new AppError("NOT_FOUND", "Camera not found", 404);
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "camera.deleted",
    resourceType: "camera",
    resourceId: camera.id,
    sourceIp,
  });

  return camera;
}

export async function getCameraStatus(cameraId: string) {
  // Try Redis cache first
  try {
    const redisClient = getRedis();
    const cached = await redisClient.get(`camera:health:${cameraId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Redis unavailable, fall through to DB
  }

  // Fallback to DB
  const camera = await db.query.cameras.findFirst({
    where: eq(cameras.id, cameraId),
    columns: {
      id: true,
      healthStatus: true,
      updatedAt: true,
    },
  });

  if (!camera) {
    throw new AppError("NOT_FOUND", "Camera not found", 404);
  }

  return {
    camera_id: camera.id,
    health_status: camera.healthStatus,
    updated_at: camera.updatedAt,
  };
}

interface BulkOperationParams {
  tenantId: string;
  operation: "start_all" | "stop_all" | "tag" | "move";
  cameraIds: string[];
  actorId: string;
  payload?: Record<string, unknown>;
  sourceIp?: string;
}

/**
 * T188: Get the effective stream profile for a camera.
 * Resolves: camera.profile_id -> tenant default profile.
 */
export async function getCameraEffectiveProfile(cameraId: string, tenantId: string) {
  return getEffectiveProfile(cameraId, tenantId);
}

export async function bulkOperation(params: BulkOperationParams) {
  const { tenantId, operation, cameraIds, actorId, payload, sourceIp } = params;

  // Verify all cameras belong to tenant
  const cameraList = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select({ id: cameras.id })
      .from(cameras)
      .where(and(inArray(cameras.id, cameraIds), eq(cameras.tenantId, tenantId)));
  });

  const validIds = cameraList.map((c) => c.id);

  let results: { id: string; status: string }[] = [];

  switch (operation) {
    case "start_all":
      for (const id of validIds) {
        try {
          await triggerRtspValidation(id, "");
          results.push({ id, status: "started" });
        } catch {
          results.push({ id, status: "failed" });
        }
      }
      break;

    case "stop_all":
      // Phase 1: Mark all as "stopping"
      await withTenantContext(tenantId, async (tx) => {
        await tx
          .update(cameras)
          .set({ healthStatus: "stopping", updatedAt: new Date() })
          .where(and(inArray(cameras.id, validIds), eq(cameras.tenantId, tenantId)));
      });

      {
        const pub = getRedis();
        for (const id of validIds) {
          await pub.publish(
            "camera:health:state_change",
            JSON.stringify({
              camera_id: id,
              tenant_id: tenantId,
              previous_state: "online",
              new_state: "stopping",
              event: "camera.stopping",
              timestamp: new Date().toISOString(),
            }),
          );
        }
      }

      // Phase 2: Remove pipelines
      {
        const { removeCameraPipeline } = await import("./stream-pipeline");
        await Promise.allSettled(validIds.map((id) => removeCameraPipeline(id)));
      }

      // Phase 3: Mark all as "stopped"
      await withTenantContext(tenantId, async (tx) => {
        await tx
          .update(cameras)
          .set({ healthStatus: "stopped", updatedAt: new Date() })
          .where(and(inArray(cameras.id, validIds), eq(cameras.tenantId, tenantId)));
      });

      {
        const pub = getRedis();
        for (const id of validIds) {
          await pub.publish(
            "camera:health:state_change",
            JSON.stringify({
              camera_id: id,
              tenant_id: tenantId,
              previous_state: "stopping",
              new_state: "stopped",
              event: "camera.stopped",
              timestamp: new Date().toISOString(),
            }),
          );
        }
      }

      results = validIds.map((id) => ({ id, status: "stopped" }));
      break;

    case "tag":
      if (payload?.tags && Array.isArray(payload.tags)) {
        await withTenantContext(tenantId, async (tx) => {
          await tx
            .update(cameras)
            .set({ tags: payload.tags as string[], updatedAt: new Date() })
            .where(and(inArray(cameras.id, validIds), eq(cameras.tenantId, tenantId)));
        });
        results = validIds.map((id) => ({ id, status: "tagged" }));
      }
      break;

    case "move":
      if (payload?.site_id && typeof payload.site_id === "string") {
        await withTenantContext(tenantId, async (tx) => {
          await tx
            .update(cameras)
            .set({ siteId: payload.site_id as string, updatedAt: new Date() })
            .where(and(inArray(cameras.id, validIds), eq(cameras.tenantId, tenantId)));
        });
        results = validIds.map((id) => ({ id, status: "moved" }));
      }
      break;
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: `camera.bulk.${operation}`,
    details: { cameraIds: validIds, operation, payload },
    sourceIp,
  });

  return { operation, results };
}
