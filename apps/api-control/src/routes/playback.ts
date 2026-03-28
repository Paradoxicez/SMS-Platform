import { Hono } from "hono";
import {
  createPlaybackSessionSchema,
  batchCreatePlaybackSessionSchema,
} from "@repo/types";
import { requireRole } from "../middleware/rbac";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import {
  issueSession,
  refreshSession,
  revokeSession,
  batchCreateSessions,
} from "../services/playback";
import type { AppEnv } from "../types";

const playbackRouter = new Hono<AppEnv>();

// ─── POST /playback/sessions ──────────────────────────────────────────────────
// Issue a new playback session for a single camera
playbackRouter.post(
  "/sessions",
  requireRole("admin", "operator", "developer"),
  rateLimitMiddleware,
  async (c) => {
    const body = await c.req.json();
    const parsed = createPlaybackSessionSchema.parse(body);

    const tenantId = c.get("tenantId") as string;
    const apiClientId = (c.get("apiClientId") as string | undefined) ?? tenantId;
    const viewerIp =
      c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip");

    const result = await issueSession({
      cameraId: parsed.camera_id,
      ttl: parsed.ttl,
      embedOrigin: parsed.embed_origin,
      tenantId,
      apiClientId,
      viewerIp,
    });

    return c.json(
      {
        data: result,
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      201,
    );
  },
);

// ─── POST /playback/sessions/batch ────────────────────────────────────────────
// Create sessions for multiple cameras at once
playbackRouter.post(
  "/sessions/batch",
  requireRole("admin", "operator", "developer"),
  rateLimitMiddleware,
  async (c) => {
    const body = await c.req.json();
    const parsed = batchCreatePlaybackSessionSchema.parse(body);

    const tenantId = c.get("tenantId") as string;
    const apiClientId = (c.get("apiClientId") as string | undefined) ?? tenantId;
    const viewerIp =
      c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip");

    const results = await batchCreateSessions({
      cameraIds: parsed.camera_ids,
      ttl: parsed.ttl,
      embedOrigin: parsed.embed_origin,
      tenantId,
      apiClientId,
      viewerIp,
    });

    return c.json(
      {
        data: results,
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      201,
    );
  },
);

// ─── POST /playback/sessions/:id/refresh ──────────────────────────────────────
// Refresh (extend TTL of) an existing session
playbackRouter.post("/sessions/:id/refresh", async (c) => {
  const sessionId = c.req.param("id");
  const tenantId = c.get("tenantId") as string;

  const result = await refreshSession(sessionId, tenantId);

  return c.json({
    data: result,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── POST /playback/sessions/:id/revoke ───────────────────────────────────────
// Revoke an active session
playbackRouter.post("/sessions/:id/revoke", async (c) => {
  const sessionId = c.req.param("id");
  const tenantId = c.get("tenantId") as string;

  await revokeSession(sessionId, tenantId);

  return c.json({
    data: { session_id: sessionId, status: "revoked" },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

export { playbackRouter };
