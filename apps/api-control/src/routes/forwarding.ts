import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import { AppError } from "../middleware/error-handler";
import { addRule, removeRule, listRules } from "../services/forwarding";

const forwardingRouter = new Hono();

// POST /forwarding — create forwarding rule (admin only)
forwardingRouter.post("/forwarding", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const body = await c.req.json();

  const { cameraId, cameraName, targetUrl } = body as {
    cameraId: string;
    cameraName?: string;
    targetUrl: string;
  };

  if (!cameraId || !targetUrl) {
    throw new AppError(
      "VALIDATION_ERROR",
      "cameraId and targetUrl are required",
      422,
    );
  }

  const rule = await addRule(
    cameraId,
    cameraName ?? cameraId,
    tenantId,
    targetUrl,
  );

  return c.json(
    {
      data: rule,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    201,
  );
});

// GET /forwarding — list forwarding rules (admin only)
forwardingRouter.get("/forwarding", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;

  const rules = listRules(tenantId);

  return c.json({
    data: rules,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// DELETE /forwarding/:id — delete forwarding rule (admin only)
forwardingRouter.delete("/forwarding/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");

  const removed = await removeRule(id);

  if (!removed) {
    throw new AppError("NOT_FOUND", "Forwarding rule not found", 404);
  }

  return c.json({
    data: { id, deleted: true },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

export { forwardingRouter };
