import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { subscriptionPlans } from "../db/schema";
import type { AppEnv } from "../types";

export const plansRouter = new Hono<AppEnv>();

// GET /plans — list all active plans (public, for pricing page)
plansRouter.get("/plans", async (c) => {
  const plans = await db.query.subscriptionPlans.findMany({
    where: eq(subscriptionPlans.isActive, true),
    orderBy: (plan, { asc }) => [asc(plan.priceCents)],
  });

  return c.json({
    data: plans.map((p) => ({
      id: p.id,
      name: p.name,
      display_name: p.displayName,
      max_cameras: p.maxCameras,
      max_projects: p.maxProjects,
      max_users: p.maxUsers,
      viewer_hours_quota: p.viewerHoursQuota,
      audit_retention_days: p.auditRetentionDays,
      features: p.features,
      price_cents: p.priceCents,
      billing_interval: p.billingInterval,
    })),
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /plans/:id — get plan details
plansRouter.get("/plans/:id", async (c) => {
  const id = c.req.param("id");

  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.id, id),
  });

  if (!plan) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Plan not found" } },
      404,
    );
  }

  return c.json({
    data: {
      id: plan.id,
      name: plan.name,
      display_name: plan.displayName,
      max_cameras: plan.maxCameras,
      max_projects: plan.maxProjects,
      max_users: plan.maxUsers,
      viewer_hours_quota: plan.viewerHoursQuota,
      audit_retention_days: plan.auditRetentionDays,
      features: plan.features,
      price_cents: plan.priceCents,
      billing_interval: plan.billingInterval,
      is_active: plan.isActive,
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});
