import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import { AppError } from "../middleware/error-handler";
import {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  disableApiKey,
  enableApiKey,
  deleteApiKey,
} from "../services/api-clients";

const apiClientsRouter = new Hono();

// POST /api-clients — generate key (admin, developer)
apiClientsRouter.post(
  "/api-clients",
  requireRole("admin", "developer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const userId = c.get("userId") as string;
    const body = await c.req.json();

    const { label, project_id, site_id } = body as {
      label: string;
      project_id?: string;
      site_id?: string;
    };

    if (!label) {
      throw new AppError("VALIDATION_ERROR", "label is required", 422);
    }

    const result = await generateApiKey(userId, tenantId, label, {
      projectId: project_id,
      siteId: site_id,
      actorId: userId,
      sourceIp:
        c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
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

// GET /api-clients — list keys (admin, developer)
apiClientsRouter.get(
  "/api-clients",
  requireRole("admin", "developer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const keys = await listApiKeys(tenantId);

    return c.json({
      data: keys,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// POST /api-clients/:id/revoke — revoke key (admin, developer)
apiClientsRouter.post(
  "/api-clients/:id/revoke",
  requireRole("admin", "developer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");

    try {
      const result = await revokeApiKey(
        id,
        tenantId,
        actorId,
        c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      );

      return c.json({
        data: { id: result.id, revokedAt: result.revokedAt },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      throw new AppError("NOT_FOUND", "API key not found or already revoked", 404);
    }
  },
);

// POST /api-clients/:id/disable — disable key (admin, developer)
apiClientsRouter.post(
  "/api-clients/:id/disable",
  requireRole("admin", "developer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");

    try {
      const result = await disableApiKey(
        id,
        tenantId,
        actorId,
        c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      );

      return c.json({
        data: { id: result.id, disabledAt: result.disabledAt },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      throw new AppError(
        "NOT_FOUND",
        "API key not found, already disabled, or revoked",
        404,
      );
    }
  },
);

// POST /api-clients/:id/enable — enable key (admin, developer)
apiClientsRouter.post(
  "/api-clients/:id/enable",
  requireRole("admin", "developer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");

    try {
      const result = await enableApiKey(
        id,
        tenantId,
        actorId,
        c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      );

      return c.json({
        data: { id: result.id, disabledAt: result.disabledAt },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      throw new AppError("NOT_FOUND", "API key not found or revoked", 404);
    }
  },
);

// DELETE /api-clients/:id — delete key (admin, developer)
apiClientsRouter.delete(
  "/api-clients/:id",
  requireRole("admin", "developer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");

    try {
      await deleteApiKey(
        id,
        tenantId,
        actorId,
        c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      );

      return c.json({
        data: { id, deleted: true },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      throw new AppError("NOT_FOUND", "API key not found", 404);
    }
  },
);

export { apiClientsRouter };
