import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import { requireFeature } from "../middleware/feature-gate";
import {
  registerWebhook,
  unregisterWebhook,
  updateWebhook,
  listWebhooks,
  getDeliveryLogs,
  deliverEvent,
} from "../services/webhooks";
import type { AppEnv } from "../types";

/**
 * T269: Webhook routes
 */
const webhooksRouter = new Hono<AppEnv>();

// All webhook routes require the "webhooks" feature
webhooksRouter.use("/webhooks/*", requireFeature("webhooks"));
webhooksRouter.use("/webhooks", requireFeature("webhooks"));

// POST /webhooks — register webhook (admin)
webhooksRouter.post(
  "/webhooks",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const { url, events } = await c.req.json();

    if (!url || !events || !Array.isArray(events)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "url and events[] are required" } }, 400);
    }

    const webhook = await registerWebhook(tenantId, url, events);
    return c.json({ data: webhook }, 201);
  },
);

// GET /webhooks — list webhooks (admin)
webhooksRouter.get(
  "/webhooks",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const data = await listWebhooks(tenantId);
    return c.json({ data });
  },
);

// PATCH /webhooks/:id — update webhook (admin)
webhooksRouter.patch(
  "/webhooks/:id",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const body = await c.req.json<{ url?: string; events?: string[]; is_active?: boolean }>();
    const data: { url?: string; events?: string[]; isActive?: boolean } = {};
    if (body.url !== undefined) data.url = body.url;
    if (body.events !== undefined) data.events = body.events;
    if (body.is_active !== undefined) data.isActive = body.is_active;
    const updated = await updateWebhook(id, tenantId, data);
    return c.json({ data: updated });
  },
);

// DELETE /webhooks/:id — unregister webhook (admin)
webhooksRouter.delete(
  "/webhooks/:id",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    await unregisterWebhook(id, tenantId);
    return c.json({ data: { id, deleted: true } });
  },
);

// POST /webhooks/:id/test — send test event
webhooksRouter.post(
  "/webhooks/:id/test",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    await deliverEvent(tenantId, "webhook.test", {
      message: "This is a test webhook delivery",
      timestamp: new Date().toISOString(),
    });
    return c.json({ data: { sent: true } });
  },
);

// GET /webhooks/:id/deliveries — delivery logs
webhooksRouter.get(
  "/webhooks/:id/deliveries",
  requireRole("admin"),
  async (c) => {
    const webhookId = c.req.param("id");
    const limit = parseInt(c.req.query("limit") ?? "50", 10);
    const data = await getDeliveryLogs(webhookId, limit);
    return c.json({ data });
  },
);

export { webhooksRouter };
