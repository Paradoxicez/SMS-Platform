import { createMiddleware } from "hono/factory";
import { checkCameraLimit, checkFeatureFlag } from "../services/feature-gate";
import type { AppEnv } from "../types";

/**
 * Middleware that checks if the tenant has an available camera slot.
 * Blocks camera creation with 403 if the limit is reached.
 */
export function requireCameraSlot() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const tenantId = c.get("tenantId") as string;
    if (!tenantId) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Tenant context required" } },
        401,
      );
    }

    const result = await checkCameraLimit(tenantId);
    if (!result.allowed) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: `Camera limit reached (${result.current}/${result.limit}). Upgrade your plan to add more cameras.`,
            details: {
              resource: "cameras",
              current: result.current,
              limit: result.limit,
            },
          },
        },
        403,
      );
    }

    await next();
  });
}

/**
 * Middleware that checks if a specific feature is enabled for the tenant's plan.
 * Returns 403 with upgrade message if the feature is not available.
 */
export function requireFeature(featureName: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const tenantId = c.get("tenantId") as string;
    if (!tenantId) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Tenant context required" } },
        401,
      );
    }

    const enabled = await checkFeatureFlag(tenantId, featureName);
    if (!enabled) {
      return c.json(
        {
          error: {
            code: "FEATURE_NOT_AVAILABLE",
            message: `The "${featureName}" feature is not available on your current plan. Please upgrade to access this feature.`,
            details: { feature: featureName },
          },
        },
        403,
      );
    }

    await next();
  });
}
