import { Hono } from "hono";
import {
  createStreamProfileSchema,
  updateStreamProfileSchema,
} from "@repo/types";
import { requireRole } from "../middleware/rbac";
import {
  createProfile,
  listProfiles,
  getProfile,
  updateProfile,
  deleteProfile,
  cloneProfile,
  getCamerasUsingProfile,
} from "../services/stream-profiles";

const streamProfilesRouter = new Hono();

// POST /stream-profiles — create
streamProfilesRouter.post(
  "/stream-profiles",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const body = await c.req.json();
    const data = createStreamProfileSchema.parse(body);

    const profile = await createProfile(
      tenantId,
      data,
      actorId,
      c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    );

    return c.json(
      {
        data: profile,
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      201,
    );
  },
);

// GET /stream-profiles — list
streamProfilesRouter.get(
  "/stream-profiles",
  requireRole("admin", "operator", "viewer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const profiles = await listProfiles(tenantId);

    return c.json({
      data: profiles,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// GET /stream-profiles/:id — get single
streamProfilesRouter.get(
  "/stream-profiles/:id",
  requireRole("admin", "operator", "viewer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const profile = await getProfile(id, tenantId);

    return c.json({
      data: profile,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// PATCH /stream-profiles/:id — update with OCC
streamProfilesRouter.patch(
  "/stream-profiles/:id",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateStreamProfileSchema.parse(body);

    const profile = await updateProfile(
      id,
      tenantId,
      data,
      actorId,
      c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    );

    return c.json({
      data: profile,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// DELETE /stream-profiles/:id — delete
streamProfilesRouter.delete(
  "/stream-profiles/:id",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");

    const profile = await deleteProfile(
      id,
      tenantId,
      actorId,
      c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    );

    return c.json({
      data: { id: profile.id },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// POST /stream-profiles/:id/clone — clone
streamProfilesRouter.post(
  "/stream-profiles/:id/clone",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");

    const profile = await cloneProfile(
      id,
      tenantId,
      actorId,
      c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    );

    return c.json(
      {
        data: profile,
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      201,
    );
  },
);

// GET /stream-profiles/:id/cameras — list cameras using this profile
streamProfilesRouter.get(
  "/stream-profiles/:id/cameras",
  requireRole("admin", "operator", "viewer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const profileCameras = await getCamerasUsingProfile(id, tenantId);

    return c.json({
      data: profileCameras,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

export { streamProfilesRouter };
