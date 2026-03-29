import { Hono } from "hono";
import { z } from "zod";
import { requireRole } from "../middleware/rbac";
import { requireFeature } from "../middleware/feature-gate";
import {
  enableRecording,
  disableRecording,
  listRecordings,
  createVodSession,
} from "../services/recordings";
import {
  resolveEffectiveConfig,
  upsertConfig,
  deleteConfig,
  getStorageUsage,
  type ScopeType,
} from "../services/recording-config";
import type { AppEnv } from "../types";

const enableRecordingSchema = z.object({
  retention_days: z.number().int().min(1).max(90).optional().default(30),
  storage_type: z.enum(["local", "s3"]).optional().default("local"),
});

/**
 * Recording routes — all gated by "recording" feature flag.
 */
const recordingsRouter = new Hono<AppEnv>();

// POST /cameras/:id/recording/enable
recordingsRouter.post(
  "/cameras/:id/recording/enable",
  requireRole("admin", "operator"),
  requireFeature("recording"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const cameraId = c.req.param("id");
    const raw = await c.req.json<Record<string, unknown>>().catch(() => ({}));

    const parsed = enableRecordingSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
        400,
      );
    }

    try {
      const result = await enableRecording(cameraId, tenantId, parsed.data.retention_days, parsed.data.storage_type);
      return c.json({ data: result });
    } catch (err) {
      return c.json(
        { error: { code: "NOT_FOUND", message: err instanceof Error ? err.message : "Error" } },
        404,
      );
    }
  },
);

// POST /cameras/:id/recording/disable
recordingsRouter.post(
  "/cameras/:id/recording/disable",
  requireRole("admin", "operator"),
  requireFeature("recording"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const cameraId = c.req.param("id");

    try {
      const result = await disableRecording(cameraId, tenantId);
      return c.json({ data: result });
    } catch (err) {
      return c.json(
        { error: { code: "NOT_FOUND", message: err instanceof Error ? err.message : "Error" } },
        404,
      );
    }
  },
);

// GET /cameras/:id/recordings — list recordings by date range
recordingsRouter.get(
  "/cameras/:id/recordings",
  requireRole("admin", "operator", "viewer"),
  requireFeature("recording"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const cameraId = c.req.param("id");
    const from = c.req.query("from") ? new Date(c.req.query("from")!) : undefined;
    const to = c.req.query("to") ? new Date(c.req.query("to")!) : undefined;
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const perPage = Math.min(parseInt(c.req.query("per_page") ?? "20", 10), 100);

    const { items, total } = await listRecordings(cameraId, tenantId, from, to, page, perPage);
    return c.json({
      data: items,
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    });
  },
);

// POST /recordings/:id/playback — create VOD session
recordingsRouter.post(
  "/recordings/:id/playback",
  requireRole("admin", "operator", "viewer"),
  requireFeature("recording"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const recordingId = c.req.param("id");

    try {
      const session = await createVodSession(recordingId, tenantId);
      return c.json({ data: session });
    } catch (err) {
      return c.json(
        { error: { code: "NOT_FOUND", message: err instanceof Error ? err.message : "Error" } },
        404,
      );
    }
  },
);

// DELETE /recordings/:id — delete a recording (file + DB)
recordingsRouter.delete(
  "/recordings/:id",
  requireRole("admin", "operator"),
  requireFeature("recording"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const recordingId = c.req.param("id");

    try {
      const { deleteRecording } = await import("../services/recordings");
      await deleteRecording(recordingId, tenantId);
      return c.json({ data: { deleted: true } });
    } catch (err) {
      return c.json(
        { error: { code: "NOT_FOUND", message: err instanceof Error ? err.message : "Error" } },
        404,
      );
    }
  },
);

// ─── Recording Config Endpoints ─────────────────────────────────────────────

// GET /recording-config/overrides — list all scope overrides for tenant
recordingsRouter.get(
  "/recording-config/overrides",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const { listAllOverrides } = await import("../services/recording-config");
    const overrides = await listAllOverrides(tenantId);
    return c.json({ data: overrides });
  },
);

// GET /recording-config/storage-usage — storage summary (must be before parameterized route)
recordingsRouter.get(
  "/recording-config/storage-usage",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const usage = await getStorageUsage(tenantId);
    return c.json({ data: usage });
  },
);

// GET /recording-config/:scopeType/:scopeId? — get effective config
recordingsRouter.get(
  "/recording-config/:scopeType/:scopeId?",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const scopeId = c.req.param("scopeId");

    const config = await resolveEffectiveConfig(tenantId, scopeId ?? "", undefined, undefined);
    return c.json({ data: config });
  },
);

// PUT /recording-config/:scopeType/:scopeId? — upsert config
recordingsRouter.put(
  "/recording-config/:scopeType/:scopeId?",
  requireRole("admin"),
  requireFeature("recording"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const scopeType = c.req.param("scopeType") as ScopeType;
    const scopeId = c.req.param("scopeId");
    const body = await c.req.json<Record<string, unknown>>();

    // Map snake_case from API to camelCase for Drizzle schema
    const mapped: Record<string, unknown> = {};
    if (body.mode !== undefined) mapped.mode = body.mode;
    if (body.recording_mode !== undefined) mapped.mode = body.recording_mode;
    if (body.schedule !== undefined) mapped.schedule = body.schedule;
    if (body.retention_days !== undefined) mapped.retentionDays = body.retention_days;
    if (body.retentionDays !== undefined) mapped.retentionDays = body.retentionDays;
    if (body.auto_purge !== undefined) mapped.autoPurge = body.auto_purge;
    if (body.autoPurge !== undefined) mapped.autoPurge = body.autoPurge;
    if (body.storage_type !== undefined) mapped.storageType = body.storage_type;
    if (body.storageType !== undefined) mapped.storageType = body.storageType;
    if (body.storage_path !== undefined) mapped.storagePath = body.storage_path;
    if (body.s3_config !== undefined) mapped.s3Config = body.s3_config;
    if (body.format !== undefined) mapped.format = body.format;
    if (body.resolution !== undefined) mapped.resolution = body.resolution;
    if (body.max_segment_size_mb !== undefined) mapped.maxSegmentSizeMb = body.max_segment_size_mb;
    if (body.maxSegmentSizeMb !== undefined) mapped.maxSegmentSizeMb = body.maxSegmentSizeMb;
    if (body.enabled !== undefined) mapped.enabled = body.enabled;

    const result = await upsertConfig(tenantId, scopeType, scopeId, mapped);
    return c.json({ data: result });
  },
);

// DELETE /recording-config/:scopeType/:scopeId — remove override
recordingsRouter.delete(
  "/recording-config/:scopeType/:scopeId",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId");
    const scopeType = c.req.param("scopeType") as ScopeType;
    const scopeId = c.req.param("scopeId");

    const deleted = await deleteConfig(tenantId, scopeType, scopeId);
    return c.json({ data: { deleted } });
  },
);

export { recordingsRouter };

