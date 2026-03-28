import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { cameras } from "../db/schema";
import { AppError } from "../middleware/error-handler";

const internalRouter = new Hono();

/**
 * Internal auth middleware — validates shared secret header.
 * No RBAC; this is for data-plane-worker communication only.
 */
const internalAuth = createMiddleware(async (c, next) => {
  const secret = c.req.header("X-Internal-Secret");
  const expectedSecret = process.env["INTERNAL_SECRET"] ?? "dev-secret";

  if (!secret || secret !== expectedSecret) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid internal secret",
        },
      },
      401,
    );
  }

  await next();
});

internalRouter.use("/*", internalAuth);

// POST /internal/cameras/:id/assign — assign camera to ingest node
internalRouter.post("/cameras/:id/assign", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const camera = await db.query.cameras.findFirst({
    where: eq(cameras.id, id),
  });

  if (!camera) {
    throw new AppError("NOT_FOUND", "Camera not found", 404);
  }

  // Update camera status to connecting
  await db
    .update(cameras)
    .set({
      healthStatus: "connecting",
      updatedAt: new Date(),
    })
    .where(eq(cameras.id, id));

  return c.json({
    data: {
      camera_id: id,
      rtsp_url: camera.rtspUrl,
      status: "assigned",
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /internal/cameras/:id/unassign — unassign camera
internalRouter.post("/cameras/:id/unassign", async (c) => {
  const id = c.req.param("id");

  const camera = await db.query.cameras.findFirst({
    where: eq(cameras.id, id),
  });

  if (!camera) {
    throw new AppError("NOT_FOUND", "Camera not found", 404);
  }

  await db
    .update(cameras)
    .set({
      healthStatus: "stopped",
      updatedAt: new Date(),
    })
    .where(eq(cameras.id, id));

  return c.json({
    data: {
      camera_id: id,
      status: "unassigned",
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /internal/cameras/:id/config — push updated config
internalRouter.post("/cameras/:id/config", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const camera = await db.query.cameras.findFirst({
    where: eq(cameras.id, id),
  });

  if (!camera) {
    throw new AppError("NOT_FOUND", "Camera not found", 404);
  }

  return c.json({
    data: {
      camera_id: id,
      config: {
        rtsp_url: camera.rtspUrl,
        name: camera.name,
        tags: camera.tags,
        ...body,
      },
      status: "config_pushed",
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /internal/nodes — list active ingest nodes
internalRouter.get("/nodes", async (c) => {
  // In a full implementation, this would query a registry of active ingest nodes.
  // For MVP, return a placeholder list.
  const nodes = [
    {
      id: "node-1",
      hostname: process.env["DATA_PLANE_HOSTNAME"] ?? "localhost",
      port: 3002,
      status: "active",
      camera_count: 0,
      last_heartbeat: new Date().toISOString(),
    },
  ];

  return c.json({
    data: nodes,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

export { internalRouter };
