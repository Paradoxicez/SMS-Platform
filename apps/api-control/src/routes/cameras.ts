import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { eq, and, count, ilike, inArray, sql } from "drizzle-orm";
import { createCameraSchema, updateCameraSchema } from "@repo/types";
import Redis from "ioredis";
import { db, withTenantContext } from "../db/client";
import { cameras, sites, streamProfiles } from "../db/schema";
import { requireRole } from "../middleware/rbac";
import { requireCameraSlot } from "../middleware/feature-gate";
import { requireValidLicense } from "../middleware/license";
import type { AppEnv } from "../types";
import { AppError } from "../middleware/error-handler";
import { logAuditEvent } from "../services/audit";
import { redis } from "../lib/redis";
import {
  onboardCamera,
  updateCamera,
  deleteCamera,
  getCameraStatus,
  bulkOperation,
} from "../services/cameras";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const camerasRouter = new Hono<AppEnv>();

// POST /sites/:siteId/cameras — onboard camera
camerasRouter.post(
  "/sites/:siteId/cameras",
  requireRole("admin", "operator"),
  requireCameraSlot(),
  requireValidLicense(),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const siteId = c.req.param("siteId");
    const body = await c.req.json();
    const data = createCameraSchema.parse({ ...body, site_id: siteId });

    // Verify site belongs to tenant
    const site = await withTenantContext(tenantId, async (tx) => {
      return tx.query.sites.findFirst({
        where: and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)),
      });
    });

    if (!site) {
      throw new AppError("NOT_FOUND", "Site not found", 404);
    }

    const camera = await onboardCamera({
      tenantId,
      siteId,
      data,
      actorId,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json(
      {
        data: camera,
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      201,
    );
  },
);

// GET /cameras — list cameras with filters
camerasRouter.get(
  "/cameras",
  requireRole("admin", "operator", "viewer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const perPage = parseInt(c.req.query("per_page") ?? "20", 10);
    const offset = (page - 1) * perPage;
    const statusFilter = c.req.query("status");
    const siteIdFilter = c.req.query("site_id");
    const tagsFilter = c.req.query("tags");
    const searchFilter = c.req.query("search");

    const result = await withTenantContext(tenantId, async (tx) => {
      const conditions = [eq(cameras.tenantId, tenantId)];

      if (statusFilter) {
        conditions.push(
          eq(
            cameras.healthStatus,
            statusFilter as
              | "connecting"
              | "online"
              | "degraded"
              | "offline"
              | "reconnecting"
              | "stopping"
              | "stopped",
          ),
        );
      }
      if (siteIdFilter) {
        conditions.push(eq(cameras.siteId, siteIdFilter));
      }
      if (searchFilter) {
        conditions.push(ilike(cameras.name, `%${searchFilter}%`));
      }
      if (tagsFilter) {
        const tags = tagsFilter.split(",").map((t) => t.trim());
        // Check if camera tags JSON array contains any of the filter tags
        conditions.push(
          sql`${cameras.tags}::jsonb ?| array[${sql.join(
            tags.map((t) => sql`${t}`),
            sql`,`,
          )}]`,
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        tx
          .select()
          .from(cameras)
          .where(whereClause)
          .limit(perPage)
          .offset(offset)
          .orderBy(cameras.createdAt),
        tx.select({ count: count() }).from(cameras).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    });

    return c.json({
      data: result.items,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
      pagination: {
        page,
        per_page: perPage,
        total: result.total,
        total_pages: Math.ceil(result.total / perPage),
      },
    });
  },
);

// GET /cameras/:id — get camera details
camerasRouter.get(
  "/cameras/:id",
  requireRole("admin", "operator", "viewer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");

    const camera = await withTenantContext(tenantId, async (tx) => {
      return tx.query.cameras.findFirst({
        where: and(eq(cameras.id, id), eq(cameras.tenantId, tenantId)),
      });
    });

    if (!camera) {
      throw new AppError("NOT_FOUND", "Camera not found", 404);
    }

    return c.json({
      data: camera,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// PATCH /cameras/:id — update camera (with OCC)
camerasRouter.patch(
  "/cameras/:id",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateCameraSchema.parse(body);

    const camera = await updateCamera({
      tenantId,
      id,
      data,
      actorId,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    // If profile_id changed, restart pipeline with new profile settings
    if ((data as Record<string, unknown>).profile_id !== undefined) {
      const { updateCameraPipeline } = await import("../services/stream-pipeline");
      updateCameraPipeline(id, tenantId).catch((err) => {
        console.error("Failed to update pipeline after profile change:", err);
      });
    }

    return c.json({
      data: camera,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// DELETE /cameras/:id — delete camera
camerasRouter.delete(
  "/cameras/:id",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");

    const camera = await deleteCamera({
      tenantId,
      id,
      actorId,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: { id: camera.id },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// GET /cameras/:id/status — get real-time health status
camerasRouter.get(
  "/cameras/:id/status",
  requireRole("admin", "operator", "viewer"),
  async (c) => {
    const id = c.req.param("id");
    const status = await getCameraStatus(id);

    return c.json({
      data: status,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// POST /cameras/:id/start — start stream
camerasRouter.post(
  "/cameras/:id/start",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");

    const camera = await withTenantContext(tenantId, async (tx) => {
      return tx.query.cameras.findFirst({
        where: and(eq(cameras.id, id), eq(cameras.tenantId, tenantId)),
      });
    });

    if (!camera) {
      throw new AppError("NOT_FOUND", "Camera not found", 404);
    }

    const previousStatus = camera.healthStatus;

    // Update status to connecting
    await withTenantContext(tenantId, async (tx) => {
      await tx
        .update(cameras)
        .set({ healthStatus: "connecting", updatedAt: new Date() })
        .where(eq(cameras.id, id));
    });

    // Publish state change so SSE clients get notified
    await redis.publish(
      "camera:health:state_change",
      JSON.stringify({
        camera_id: id,
        tenant_id: tenantId,
        previous_state: previousStatus,
        new_state: "connecting",
        event: "camera.connecting",
        timestamp: new Date().toISOString(),
      }),
    );

    // Setup pipeline using Stream Profile settings
    const { setupCameraPipeline } = await import("../services/stream-pipeline");
    setupCameraPipeline(id, tenantId, camera.rtspUrl).then(async (result) => {
      if (!result.success) {
        await db.update(cameras).set({ healthStatus: "offline" }).where(eq(cameras.id, id));
        await redis.publish(
          "camera:health:state_change",
          JSON.stringify({
            camera_id: id,
            tenant_id: tenantId,
            previous_state: "connecting",
            new_state: "offline",
            event: "camera.offline",
            timestamp: new Date().toISOString(),
          }),
        );
      }
      // stream-sync will update status to "online" once path is ready
    }).catch(() => {});

    return c.json({
      data: { id, status: "starting" },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// POST /cameras/:id/stop — stop stream
camerasRouter.post(
  "/cameras/:id/stop",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");

    // Read current status before updating
    const existing = await withTenantContext(tenantId, async (tx) => {
      return tx.query.cameras.findFirst({
        where: and(eq(cameras.id, id), eq(cameras.tenantId, tenantId)),
        columns: { id: true, healthStatus: true },
      });
    });

    if (!existing) {
      throw new AppError("NOT_FOUND", "Camera not found", 404);
    }

    const previousStatus = existing.healthStatus;

    // Phase 1: Set to "stopping" immediately so UI reflects the in-progress state
    await withTenantContext(tenantId, async (tx) => {
      await tx
        .update(cameras)
        .set({ healthStatus: "stopping", updatedAt: new Date() })
        .where(and(eq(cameras.id, id), eq(cameras.tenantId, tenantId)));
    });

    await redis.publish(
      "camera:health:state_change",
      JSON.stringify({
        camera_id: id,
        tenant_id: tenantId,
        previous_state: previousStatus,
        new_state: "stopping",
        event: "camera.stopping",
        timestamp: new Date().toISOString(),
      }),
    );

    // Phase 2: Remove camera pipeline from MediaMTX
    const { removeCameraPipeline } = await import("../services/stream-pipeline");
    await removeCameraPipeline(id);

    // Phase 3: Set to "stopped" after cleanup completes
    await withTenantContext(tenantId, async (tx) => {
      await tx
        .update(cameras)
        .set({ healthStatus: "stopped", updatedAt: new Date() })
        .where(and(eq(cameras.id, id), eq(cameras.tenantId, tenantId)));
    });

    await redis.publish(
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

    return c.json({
      data: { id, status: "stopped" },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// POST /cameras/bulk — bulk operations
camerasRouter.post(
  "/cameras/bulk",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const body = await c.req.json();

    const { operation, camera_ids, payload } = body as {
      operation: "start_all" | "stop_all" | "tag" | "move";
      camera_ids: string[];
      payload?: Record<string, unknown>;
    };

    if (!operation || !camera_ids || !Array.isArray(camera_ids)) {
      throw new AppError("VALIDATION_ERROR", "operation and camera_ids are required", 422);
    }

    const result = await bulkOperation({
      tenantId,
      operation,
      cameraIds: camera_ids,
      actorId,
      payload,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: result,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// POST /cameras/bulk-assign-profile — T217: Bulk profile assignment
camerasRouter.post(
  "/cameras/bulk-assign-profile",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const body = await c.req.json();

    const { camera_ids, profile_id } = body as {
      camera_ids: string[];
      profile_id: string;
    };

    if (!camera_ids || !Array.isArray(camera_ids) || camera_ids.length === 0) {
      throw new AppError("VALIDATION_ERROR", "camera_ids must be a non-empty array", 422);
    }
    if (!profile_id || typeof profile_id !== "string") {
      throw new AppError("VALIDATION_ERROR", "profile_id is required", 422);
    }

    const updatedCount = await withTenantContext(tenantId, async (tx) => {
      // Validate all camera_ids belong to tenant
      const validCameras = await tx
        .select({ id: cameras.id })
        .from(cameras)
        .where(and(inArray(cameras.id, camera_ids), eq(cameras.tenantId, tenantId)));

      if (validCameras.length === 0) {
        throw new AppError("NOT_FOUND", "No valid cameras found", 404);
      }

      const validIds = validCameras.map((c) => c.id);

      // Validate profile belongs to tenant
      const profile = await tx.query.streamProfiles.findFirst({
        where: and(eq(streamProfiles.id, profile_id), eq(streamProfiles.tenantId, tenantId)),
      });

      if (!profile) {
        throw new AppError("NOT_FOUND", "Profile not found", 404);
      }

      // Update all valid cameras
      await tx
        .update(cameras)
        .set({ profileId: profile_id, updatedAt: new Date() })
        .where(and(inArray(cameras.id, validIds), eq(cameras.tenantId, tenantId)));

      return validIds.length;
    });

    logAuditEvent({
      tenantId,
      actorType: "user",
      actorId,
      eventType: "camera.bulk.assign_profile",
      details: { camera_ids, profile_id, updated_count: updatedCount },
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    // Restart pipelines for all updated cameras (fire and forget)
    const { updateCameraPipeline } = await import("../services/stream-pipeline");
    for (const cid of camera_ids) {
      updateCameraPipeline(cid, tenantId).catch(() => {});
    }

    return c.json({
      data: { updated_count: updatedCount },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// POST /cameras/import — T223: Bulk camera import
camerasRouter.post(
  "/cameras/import",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const body = await c.req.json();

    const { cameras: cameraList } = body as {
      cameras: {
        name: string;
        rtsp_url: string;
        site_id: string;
        profile_id?: string;
        lat?: number;
        lng?: number;
        tags?: string[];
      }[];
    };

    if (!cameraList || !Array.isArray(cameraList) || cameraList.length === 0) {
      throw new AppError("VALIDATION_ERROR", "cameras must be a non-empty array", 422);
    }

    let imported = 0;
    let skipped = 0;
    const errors: { index: number; reason: string }[] = [];

    for (let i = 0; i < cameraList.length; i++) {
      const cam = cameraList[i]!;
      try {
        if (!cam.name || !cam.rtsp_url || !cam.site_id) {
          errors.push({ index: i, reason: "Missing required fields: name, rtsp_url, site_id" });
          skipped++;
          continue;
        }

        // Verify site belongs to tenant
        const site = await withTenantContext(tenantId, async (tx) => {
          return tx.query.sites.findFirst({
            where: and(eq(sites.id, cam.site_id), eq(sites.tenantId, tenantId)),
          });
        });

        if (!site) {
          errors.push({ index: i, reason: `Site not found: ${cam.site_id}` });
          skipped++;
          continue;
        }

        await onboardCamera({
          tenantId,
          siteId: cam.site_id,
          data: {
            name: cam.name,
            rtsp_url: cam.rtsp_url,
            site_id: cam.site_id,
            profile_id: cam.profile_id,
            lat: cam.lat,
            lng: cam.lng,
            tags: cam.tags,
          },
          actorId,
          sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
        });

        imported++;
      } catch (err) {
        errors.push({
          index: i,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
        skipped++;
      }
    }

    logAuditEvent({
      tenantId,
      actorType: "user",
      actorId,
      eventType: "camera.bulk.import",
      details: { imported, skipped, total: cameraList.length },
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: { imported, skipped, errors },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// POST /cameras/import-profiles — T224: Bulk profile assign by name
camerasRouter.post(
  "/cameras/import-profiles",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const body = await c.req.json();

    const { mappings } = body as {
      mappings: { camera_name: string; profile_name: string }[];
    };

    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      throw new AppError("VALIDATION_ERROR", "mappings must be a non-empty array", 422);
    }

    let updated = 0;
    let not_found = 0;
    const errors: { camera_name: string; reason: string }[] = [];

    for (const mapping of mappings) {
      try {
        const result = await withTenantContext(tenantId, async (tx) => {
          // Find camera by name within tenant
          const camera = await tx.query.cameras.findFirst({
            where: and(
              ilike(cameras.name, mapping.camera_name),
              eq(cameras.tenantId, tenantId),
            ),
          });

          if (!camera) {
            return { found: false as const, reason: "Camera not found" };
          }

          // Find profile by name within tenant
          const profile = await tx.query.streamProfiles.findFirst({
            where: and(
              ilike(streamProfiles.name, mapping.profile_name),
              eq(streamProfiles.tenantId, tenantId),
            ),
          });

          if (!profile) {
            return { found: false as const, reason: "Profile not found" };
          }

          // Update camera
          await tx
            .update(cameras)
            .set({ profileId: profile.id, updatedAt: new Date() })
            .where(eq(cameras.id, camera.id));

          return { found: true as const };
        });

        if (result.found) {
          updated++;
        } else {
          not_found++;
          errors.push({ camera_name: mapping.camera_name, reason: result.reason });
        }
      } catch (err) {
        not_found++;
        errors.push({
          camera_name: mapping.camera_name,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    logAuditEvent({
      tenantId,
      actorType: "user",
      actorId,
      eventType: "camera.bulk.import_profiles",
      details: { updated, not_found, total: mappings.length },
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: { updated, not_found, errors },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// GET /cameras/status/stream — SSE real-time status updates
camerasRouter.get(
  "/cameras/status/stream",
  requireRole("admin", "operator", "viewer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;

    return streamSSE(c, async (stream) => {
      const subscriber = new Redis(REDIS_URL);

      await subscriber.subscribe("camera:health:state_change");

      // Send initial keepalive
      await stream.writeSSE({ data: JSON.stringify({ type: "connected" }), event: "connected" });

      const messageHandler = async (_ch: string, message: string) => {
        try {
          const data = JSON.parse(message) as {
            camera_id: string;
            tenant_id: string;
            previous_state: string;
            new_state: string;
            timestamp: string;
          };

          // Only forward events for the current tenant
          if (data.tenant_id !== tenantId) return;

          await stream.writeSSE({
            event: "status_change",
            data: JSON.stringify({
              camera_id: data.camera_id,
              previous_state: data.previous_state,
              new_state: data.new_state,
              timestamp: data.timestamp,
            }),
          });
        } catch {
          // Skip malformed messages
        }
      };

      subscriber.on("message", messageHandler);

      // Keepalive every 30 seconds
      const keepalive = setInterval(async () => {
        try {
          await stream.writeSSE({ data: "", event: "keepalive" });
        } catch {
          clearInterval(keepalive);
        }
      }, 30000);

      // Cleanup on disconnect
      stream.onAbort(() => {
        clearInterval(keepalive);
        subscriber.unsubscribe("camera:health:state_change");
        subscriber.disconnect();
      });

      // Keep the stream open
      await new Promise(() => {});
    });
  },
);

// POST /cameras/test-connection — test RTSP/SRT connection via MediaMTX temp path
camerasRouter.post(
  "/cameras/test-connection",
  requireRole("admin", "operator"),
  async (c) => {
    const body = await c.req.json<{ url?: string }>();
    const url = body.url;

    if (!url || typeof url !== "string") {
      return c.json(
        { data: { success: false, error: "URL is required" } },
        400,
      );
    }

    if (!url.startsWith("rtsp://") && !url.startsWith("srt://")) {
      return c.json({
        data: {
          success: false,
          error: "Invalid URL",
          detail: "Must start with rtsp:// or srt://",
        },
      });
    }

    const { mediamtxFetch } = await import("../lib/mediamtx-fetch");
    const testPathName = `__test_${crypto.randomUUID().slice(0, 8)}`;

    try {
      // 1. Create temp path in MediaMTX
      const addRes = await mediamtxFetch(`/v3/config/paths/add/${testPathName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: url,
          sourceOnDemand: false,
        }),
      });

      if (!addRes.ok) {
        return c.json({
          data: { success: false, error: "Failed to create test path", detail: await addRes.text() },
        });
      }

      // 2. Poll path status (wait up to 10s for connection)
      let connected = false;
      let tracks: string[] = [];
      let codecInfo: unknown[] = [];
      let errorMsg = "Connection timeout — host unreachable or firewall blocked";

      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));

        const pathRes = await mediamtxFetch(`/v3/paths/get/${testPathName}`);
        if (pathRes.ok) {
          const pathData = await pathRes.json() as {
            ready?: boolean;
            tracks?: string[];
            tracks2?: { codec?: string; codecProps?: { width?: number; height?: number } }[];
            source?: { type?: string };
          };

          if (pathData.ready) {
            connected = true;
            tracks = pathData.tracks ?? [];
            codecInfo = pathData.tracks2 ?? [];
            break;
          }
        }
      }

      // 3. Cleanup: remove temp path
      await mediamtxFetch(`/v3/config/paths/delete/${testPathName}`, {
        method: "DELETE",
      });

      if (connected) {
        // Build detail string from tracks
        const details: string[] = [];
        for (const track of codecInfo as { codec?: string; codecProps?: { width?: number; height?: number } }[]) {
          if (track.codec && track.codecProps?.width) {
            details.push(`${track.codec} ${track.codecProps.width}×${track.codecProps.height}`);
          } else if (track.codec) {
            details.push(track.codec);
          }
        }

        return c.json({
          data: {
            success: true,
            tracks,
            detail: details.join(" · ") || tracks.join(", "),
          },
        });
      }

      // Check if auth error (common pattern)
      if (url.includes("@")) {
        errorMsg = "Connection timeout — check IP/port and ensure camera is reachable";
      } else {
        errorMsg = "Authentication may be required — include credentials in URL (rtsp://user:pass@host)";
      }

      return c.json({
        data: { success: false, error: "Connection failed", detail: errorMsg },
      });
    } catch (err) {
      // Cleanup on error
      await mediamtxFetch(`/v3/config/paths/delete/${testPathName}`, {
        method: "DELETE",
      }).catch(() => {});

      return c.json({
        data: {
          success: false,
          error: "Connection test failed",
          detail: err instanceof Error ? err.message : "Unknown error",
        },
      });
    }
  },
);

export { camerasRouter };
