import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import {
  enableRecording,
  disableRecording,
  listRecordings,
  createVodSession,
} from "../services/recordings";
import type { AppEnv } from "../types";

/**
 * T292: Recording routes
 */
const recordingsRouter = new Hono<AppEnv>();

// POST /cameras/:id/recording/enable
recordingsRouter.post(
  "/cameras/:id/recording/enable",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const cameraId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const retentionDays = body.retention_days ?? 30;
    const storageType = body.storage_type ?? "local";

    try {
      const result = await enableRecording(cameraId, tenantId, retentionDays, storageType);
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
  async (c) => {
    const tenantId = c.get("tenantId") as string;
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
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const cameraId = c.req.param("id");
    const from = c.req.query("from") ? new Date(c.req.query("from")!) : undefined;
    const to = c.req.query("to") ? new Date(c.req.query("to")!) : undefined;
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const perPage = parseInt(c.req.query("per_page") ?? "20", 10);

    const data = await listRecordings(cameraId, tenantId, from, to, page, perPage);
    return c.json({ data });
  },
);

// POST /recordings/:id/playback — create VOD session
recordingsRouter.post(
  "/recordings/:id/playback",
  async (c) => {
    const tenantId = c.get("tenantId") as string;
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
