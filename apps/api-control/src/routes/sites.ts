import { Hono } from "hono";
import { eq, and, count } from "drizzle-orm";
import { createSiteSchema, updateSiteSchema } from "@repo/types";
import { db, withTenantContext } from "../db/client";
import { sites, projects, cameras, streamProfiles } from "../db/schema";
import { requireRole } from "../middleware/rbac";
import { logAuditEvent } from "../services/audit";
import { AppError } from "../middleware/error-handler";

const sitesRouter = new Hono();

// POST /projects/:projectId/sites — create site
sitesRouter.post(
  "/projects/:projectId/sites",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const projectId = c.req.param("projectId");
    const body = await c.req.json();
    const data = createSiteSchema.parse({ ...body, project_id: projectId });

    // Verify project belongs to tenant
    const project = await withTenantContext(tenantId, async (tx) => {
      return tx.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)),
      });
    });

    if (!project) {
      throw new AppError("NOT_FOUND", "Project not found", 404);
    }

    const [site] = await withTenantContext(tenantId, async (tx) => {
      return tx
        .insert(sites)
        .values({
          projectId,
          tenantId,
          name: data.name,
          address: data.address ?? null,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
          timezone: data.timezone ?? "UTC",
          defaultProfileId: data.default_profile_id ?? null,
        })
        .returning();
    });

    logAuditEvent({
      tenantId,
      actorType: "user",
      actorId,
      eventType: "site.created",
      resourceType: "site",
      resourceId: site!.id,
      details: { name: data.name, projectId },
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json(
      {
        data: site,
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      201,
    );
  },
);

// GET /projects/:projectId/sites — list sites for project
sitesRouter.get(
  "/projects/:projectId/sites",
  requireRole("admin", "operator", "viewer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const projectId = c.req.param("projectId");
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const perPage = parseInt(c.req.query("per_page") ?? "20", 10);
    const offset = (page - 1) * perPage;

    const result = await withTenantContext(tenantId, async (tx) => {
      const [items, totalResult] = await Promise.all([
        tx
          .select()
          .from(sites)
          .where(and(eq(sites.projectId, projectId), eq(sites.tenantId, tenantId)))
          .limit(perPage)
          .offset(offset),
        tx
          .select({ count: count() })
          .from(sites)
          .where(and(eq(sites.projectId, projectId), eq(sites.tenantId, tenantId))),
      ]);
      return { items, total: totalResult[0]?.count ?? 0 };
    });

    return c.json({
      data: result.items,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
      pagination: {
        page,
        per_page: perPage,
        total: result.total,
        total_pages: Math.ceil(result.total / perPage),
      },
    });
  },
);

// GET /sites/:id — get site
sitesRouter.get(
  "/sites/:id",
  requireRole("admin", "operator", "viewer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");

    const site = await withTenantContext(tenantId, async (tx) => {
      return tx.query.sites.findFirst({
        where: and(eq(sites.id, id), eq(sites.tenantId, tenantId)),
      });
    });

    if (!site) {
      throw new AppError("NOT_FOUND", "Site not found", 404);
    }

    return c.json({
      data: site,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// PATCH /sites/:id — update site
sitesRouter.patch(
  "/sites/:id",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateSiteSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.lat !== undefined) updateData.lat = data.lat;
    if (data.lng !== undefined) updateData.lng = data.lng;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.default_profile_id !== undefined)
      updateData.defaultProfileId = data.default_profile_id;

    const [site] = await withTenantContext(tenantId, async (tx) => {
      return tx
        .update(sites)
        .set(updateData)
        .where(and(eq(sites.id, id), eq(sites.tenantId, tenantId)))
        .returning();
    });

    if (!site) {
      throw new AppError("NOT_FOUND", "Site not found", 404);
    }

    logAuditEvent({
      tenantId,
      actorType: "user",
      actorId,
      eventType: "site.updated",
      resourceType: "site",
      resourceId: site.id,
      details: data,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: site,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// DELETE /sites/:id — delete site
sitesRouter.delete(
  "/sites/:id",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");

    // Check if site has cameras — prevent deletion if so
    const cameraCount = await withTenantContext(tenantId, async (tx) => {
      const [result] = await tx
        .select({ count: count() })
        .from(cameras)
        .where(and(eq(cameras.siteId, id), eq(cameras.tenantId, tenantId)));
      return result?.count ?? 0;
    });

    if (cameraCount > 0) {
      throw new AppError(
        "CONFLICT",
        "Cannot delete site with cameras. Move or delete cameras first.",
        409,
      );
    }

    const [site] = await withTenantContext(tenantId, async (tx) => {
      return tx
        .delete(sites)
        .where(and(eq(sites.id, id), eq(sites.tenantId, tenantId)))
        .returning();
    });

    if (!site) {
      throw new AppError("NOT_FOUND", "Site not found", 404);
    }

    logAuditEvent({
      tenantId,
      actorType: "user",
      actorId,
      eventType: "site.deleted",
      resourceType: "site",
      resourceId: site.id,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: { id: site.id },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// POST /sites/:id/apply-profile — apply site default profile to all cameras
sitesRouter.post(
  "/sites/:id/apply-profile",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");

    const site = await withTenantContext(tenantId, async (tx) => {
      return tx.query.sites.findFirst({
        where: and(eq(sites.id, id), eq(sites.tenantId, tenantId)),
      });
    });

    if (!site) {
      throw new AppError("NOT_FOUND", "Site not found", 404);
    }

    if (!site.defaultProfileId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "No default profile configured for this site",
        400,
      );
    }

    const result = await withTenantContext(tenantId, async (tx) => {
      const updated = await tx
        .update(cameras)
        .set({
          profileId: site.defaultProfileId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(cameras.siteId, id), eq(cameras.tenantId, tenantId)),
        )
        .returning();
      return updated.length;
    });

    logAuditEvent({
      tenantId,
      actorType: "user",
      actorId,
      eventType: "site.profile_applied",
      resourceType: "site",
      resourceId: site.id,
      details: {
        profileId: site.defaultProfileId,
        camerasUpdated: result,
      },
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    // Restart pipelines for all cameras in this site (fire and forget)
    const siteCameras = await withTenantContext(tenantId, async (tx) => {
      return tx.query.cameras.findMany({
        where: and(eq(cameras.siteId, id), eq(cameras.tenantId, tenantId)),
      });
    });

    const { updateCameraPipeline } = await import("../services/stream-pipeline");
    for (const cam of siteCameras) {
      updateCameraPipeline(cam.id, tenantId).catch(() => {});
    }

    return c.json({
      data: { cameras_updated: result },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

export { sitesRouter };
