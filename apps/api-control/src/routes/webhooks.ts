import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import {
  registerWebhook,
  unregisterWebhook,
  listWebhooks,
  getDeliveryLogs,
  deliverEvent,
} from "../services/webhooks";

/**
 * T269: Webhook routes
 */
const webhooksRouter = new Hono();

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
