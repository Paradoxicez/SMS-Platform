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

export { recordingsRouter };
