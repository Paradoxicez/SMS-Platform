import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import {
  createIntegration,
  listIntegrations,
  deleteIntegration,
  listAiEvents,
} from "../services/ai-integrations";
import type { AppEnv } from "../types";

/**
 * T298: AI integration routes
 */
const aiIntegrationsRouter = new Hono<AppEnv>();

// POST /ai-integrations — create (admin)
aiIntegrationsRouter.post(
  "/ai-integrations",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const body = await c.req.json();

    if (!body.name || !body.endpoint_url) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "name and endpoint_url are required" } },
        400,
      );
    }

    const integration = await createIntegration(tenantId, {
      name: body.name,
      endpoint_url: body.endpoint_url,
      api_key: body.api_key,
      event_types: body.event_types ?? [],
      cameras: body.cameras ?? [],
      interval_seconds: body.interval_seconds,
    });

    return c.json({ data: integration }, 201);
  },
);

// GET /ai-integrations — list (admin)
aiIntegrationsRouter.get(
  "/ai-integrations",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const data = await listIntegrations(tenantId);
    return c.json({ data });
  },
);

// DELETE /ai-integrations/:id — delete (admin)
aiIntegrationsRouter.delete(
  "/ai-integrations/:id",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    await deleteIntegration(id, tenantId);
    return c.json({ data: { id, deleted: true } });
  },
);

// GET /ai-integrations/events — list events with filters
aiIntegrationsRouter.get(
  "/ai-integrations/events",
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const cameraId = c.req.query("camera_id");
    const from = c.req.query("from") ? new Date(c.req.query("from")!) : undefined;
    const to = c.req.query("to") ? new Date(c.req.query("to")!) : undefined;
    const limit = parseInt(c.req.query("limit") ?? "50", 10);

    const data = await listAiEvents(tenantId, cameraId ?? undefined, from, to, limit);
    return c.json({ data });
  },
);

export { aiIntegrationsRouter };
