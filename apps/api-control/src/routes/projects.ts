import { Hono } from "hono";
import { eq, and, count } from "drizzle-orm";
import { createProjectSchema, updateProjectSchema } from "@repo/types";
import { withTenantContext } from "../db/client";
import { projects } from "../db/schema";
import { requireRole } from "../middleware/rbac";
import { logAuditEvent } from "../services/audit";
import { AppError } from "../middleware/error-handler";
import type { AppEnv } from "../types";

const projectsRouter = new Hono<AppEnv>();

function generatePublicKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  for (const byte of bytes) {
    result += chars[byte % chars.length];
  }
  return result;
}

// POST / — create project
projectsRouter.post("/", requireRole("admin", "operator"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const actorId = c.get("userId") as string;
  const body = await c.req.json();
  const data = createProjectSchema.parse(body);

  const [project] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(projects)
      .values({
        tenantId,
        name: data.name,
        description: data.description ?? null,
        defaultPolicyId: data.default_policy_id ?? null,
        viewerHoursQuota: data.viewer_hours_quota ?? null,
        publicKey: generatePublicKey(),
      })
      .returning();
  });

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "project.created",
    resourceType: "project",
    resourceId: project!.id,
    details: { name: data.name },
    sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
  });

  return c.json(
    {
      data: project,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    201,
  );
});

// GET / — list projects (paginated)
projectsRouter.get("/", requireRole("admin", "operator", "viewer"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const perPage = parseInt(c.req.query("per_page") ?? "20", 10);
  const offset = (page - 1) * perPage;

  const result = await withTenantContext(tenantId, async (tx) => {
    const [items, totalResult] = await Promise.all([
      tx
        .select()
        .from(projects)
        .where(eq(projects.tenantId, tenantId))
        .limit(perPage)
        .offset(offset),
      tx
        .select({ count: count() })
        .from(projects)
        .where(eq(projects.tenantId, tenantId)),
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
});

// GET /:id — get project
projectsRouter.get("/:id", requireRole("admin", "operator", "viewer"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const project = await withTenantContext(tenantId, async (tx) => {
    return tx.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.tenantId, tenantId)),
    });
  });

  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found", 404);
  }

  return c.json({
    data: project,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// PATCH /:id — update project
projectsRouter.patch("/:id", requireRole("admin", "operator"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const actorId = c.get("userId") as string;
  const id = c.req.param("id");
  const body = await c.req.json();
  const data = updateProjectSchema.parse(body);

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.default_policy_id !== undefined) updateData.defaultPolicyId = data.default_policy_id;
  if (data.viewer_hours_quota !== undefined) updateData.viewerHoursQuota = data.viewer_hours_quota;
  updateData.updatedAt = new Date();

  const [project] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .update(projects)
      .set(updateData)
      .where(and(eq(projects.id, id), eq(projects.tenantId, tenantId)))
      .returning();
  });

  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found", 404);
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "project.updated",
    resourceType: "project",
    resourceId: project.id,
    details: data,
    sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
  });

  return c.json({
    data: project,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// DELETE /:id — delete project
projectsRouter.delete("/:id", requireRole("admin", "operator"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const actorId = c.get("userId") as string;
  const id = c.req.param("id");

  const [project] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, tenantId)))
      .returning();
  });

  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found", 404);
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "project.deleted",
    resourceType: "project",
    resourceId: project.id,
    sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
  });

  return c.json({
    data: { id: project.id },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

export { projectsRouter };
