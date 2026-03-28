import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createTenantSchema, updateTenantSchema } from "@repo/types";
import { db, withTenantContext } from "../db/client";
import { tenants } from "../db/schema";
import { requireRole } from "../middleware/rbac";
import { logAuditEvent } from "../services/audit";
import { AppError } from "../middleware/error-handler";

const tenantsRouter = new Hono();

// All tenant operations require admin role
tenantsRouter.use("/*", requireRole("admin"));

// POST / — create tenant
tenantsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const data = createTenantSchema.parse(body);

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: data.name,
      slug: data.slug,
      billingEmail: data.billing_email,
      subscriptionTier: data.subscription_tier ?? "free",
      viewerHoursQuota: data.viewer_hours_quota ?? 1000,
      egressQuotaBytes: data.egress_quota_bytes
        ? BigInt(data.egress_quota_bytes)
        : BigInt("107374182400"),
    })
    .returning();

  const actorId = c.get("userId") as string;
  const tenantId = c.get("tenantId") as string;

  logAuditEvent({
    tenantId: tenant!.id,
    actorType: "user",
    actorId,
    eventType: "tenant.created",
    resourceType: "tenant",
    resourceId: tenant!.id,
    details: { name: data.name, slug: data.slug },
    sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
  });

  return c.json(
    {
      data: tenant,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    201,
  );
});

// GET /:id — get tenant by id
tenantsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, id),
  });

  if (!tenant) {
    throw new AppError("NOT_FOUND", "Tenant not found", 404);
  }

  return c.json({
    data: tenant,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// PATCH /:id — update tenant
tenantsRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const data = updateTenantSchema.parse(body);

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.billing_email !== undefined) updateData.billingEmail = data.billing_email;
  if (data.subscription_tier !== undefined) updateData.subscriptionTier = data.subscription_tier;
  if (data.viewer_hours_quota !== undefined) updateData.viewerHoursQuota = data.viewer_hours_quota;
  if (data.egress_quota_bytes !== undefined)
    updateData.egressQuotaBytes = BigInt(data.egress_quota_bytes);
  updateData.updatedAt = new Date();

  const [tenant] = await db
    .update(tenants)
    .set(updateData)
    .where(eq(tenants.id, id))
    .returning();

  if (!tenant) {
    throw new AppError("NOT_FOUND", "Tenant not found", 404);
  }

  const actorId = c.get("userId") as string;

  logAuditEvent({
    tenantId: tenant.id,
    actorType: "user",
    actorId,
    eventType: "tenant.updated",
    resourceType: "tenant",
    resourceId: tenant.id,
    details: data,
    sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
  });

  return c.json({
    data: tenant,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

export { tenantsRouter };
