import { Hono } from "hono";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { tenants } from "../db/schema/tenants";
import { AppError } from "../middleware/error-handler";
import type { AppEnv } from "../types";

export const onboardingRouter = new Hono<AppEnv>();

// GET /onboarding/status
onboardingRouter.get("/onboarding/status", async (c) => {
  const tenantId = c.get("tenantId") as string;

  if (!tenantId) {
    throw new AppError("UNAUTHORIZED", "Tenant context required", 401);
  }

  const [tenant] = await db
    .select({
      onboardingCompleted: tenants.onboardingCompleted,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new AppError("NOT_FOUND", "Tenant not found", 404);
  }

  return c.json({
    data: {
      completed: tenant.onboardingCompleted ?? false,
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /onboarding/complete
onboardingRouter.post("/onboarding/complete", async (c) => {
  const tenantId = c.get("tenantId") as string;

  if (!tenantId) {
    throw new AppError("UNAUTHORIZED", "Tenant context required", 401);
  }

  await db
    .update(tenants)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  return c.json({
    data: { completed: true },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /onboarding/skip
onboardingRouter.post("/onboarding/skip", async (c) => {
  const tenantId = c.get("tenantId") as string;

  if (!tenantId) {
    throw new AppError("UNAUTHORIZED", "Tenant context required", 401);
  }

  await db
    .update(tenants)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  return c.json({
    data: { completed: true, skipped: true },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});
