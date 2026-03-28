import { eq, count } from "drizzle-orm";
import { db } from "../db/client";
import { tenants, cameras, projects, users, subscriptionPlans } from "../db/schema";
import {
  isOnPrem,
  getEffectiveLimits,
  getEffectiveFeatures,
  hasFeature as licenseHasFeature,
  getCachedLicenseStatus,
} from "./license";

export interface PlanLimits {
  maxCameras: number;
  maxProjects: number;
  maxUsers: number;
  viewerHoursQuota: number;
  auditRetentionDays: number;
  features: Record<string, boolean>;
}

export interface UsageSummary {
  cameras: { current: number; limit: number };
  projects: { current: number; limit: number };
  users: { current: number; limit: number };
  viewerHoursQuota: number;
  planName: string;
  planDisplayName: string;
}

const UNLIMITED = 999999;

const DEFAULT_LIMITS: PlanLimits = {
  maxCameras: 5,
  maxProjects: 1,
  maxUsers: 2,
  viewerHoursQuota: 100,
  auditRetentionDays: 7,
  features: {
    webrtc: false,
    embed: false,
    api_access: false,
    csv_import: false,
    webhooks: false,
    recording: false,
    sso: false,
  },
};

/**
 * Check if we are running in on-prem mode.
 */
export function isOnPremDeployment(): boolean {
  return process.env["DEPLOYMENT_MODE"] === "onprem";
}

/**
 * Resolve plan limits for a tenant.
 * On-prem: reads from license (plan + addons).
 * Cloud: reads from subscription_plans table.
 */
export async function getPlanLimits(tenantId: string): Promise<PlanLimits> {
  if (isOnPremDeployment()) {
    // On-prem: use license-based limits
    const licenseLimits = getEffectiveLimits();
    const features = getEffectiveFeatures();
    const featureMap: Record<string, boolean> = {};
    for (const f of ["webrtc", "embed", "api_access", "csv_import", "webhooks", "recording", "sso", "forwarding", "ai", "multi_engine", "map_public", "audit_log", "stream_profiles", "custom_profiles"]) {
      featureMap[f] = features.includes("*") || features.includes(f);
    }
    return {
      maxCameras: licenseLimits.cameras,
      maxProjects: licenseLimits.projects,
      maxUsers: licenseLimits.users,
      viewerHoursQuota: licenseLimits.viewerHours,
      auditRetentionDays: licenseLimits.retentionDays,
      features: featureMap,
    };
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    return DEFAULT_LIMITS;
  }

  // Load the subscription plan if linked
  let plan: typeof subscriptionPlans.$inferSelect | null = null;
  if (tenant.subscriptionPlanId) {
    const found = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, tenant.subscriptionPlanId),
    });
    plan = found ?? null;
  }

  const baseLimits: PlanLimits = plan
    ? {
        maxCameras: plan.maxCameras,
        maxProjects: plan.maxProjects,
        maxUsers: plan.maxUsers,
        viewerHoursQuota: plan.viewerHoursQuota,
        auditRetentionDays: plan.auditRetentionDays,
        features: (plan.features as Record<string, boolean>) ?? DEFAULT_LIMITS.features,
      }
    : DEFAULT_LIMITS;

  // Apply plan_overrides if present
  if (tenant.planOverrides && typeof tenant.planOverrides === "object") {
    const overrides = tenant.planOverrides as Record<string, unknown>;
    return {
      maxCameras:
        typeof overrides["maxCameras"] === "number"
          ? overrides["maxCameras"]
          : baseLimits.maxCameras,
      maxProjects:
        typeof overrides["maxProjects"] === "number"
          ? overrides["maxProjects"]
          : baseLimits.maxProjects,
      maxUsers:
        typeof overrides["maxUsers"] === "number"
          ? overrides["maxUsers"]
          : baseLimits.maxUsers,
      viewerHoursQuota:
        typeof overrides["viewerHoursQuota"] === "number"
          ? overrides["viewerHoursQuota"]
          : baseLimits.viewerHoursQuota,
      auditRetentionDays:
        typeof overrides["auditRetentionDays"] === "number"
          ? overrides["auditRetentionDays"]
          : baseLimits.auditRetentionDays,
      features: {
        ...baseLimits.features,
        ...((overrides["features"] as Record<string, boolean>) ?? {}),
      },
    };
  }

  return baseLimits;
}

export async function checkCameraLimit(
  tenantId: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limits = await getPlanLimits(tenantId);
  const [result] = await db
    .select({ value: count() })
    .from(cameras)
    .where(eq(cameras.tenantId, tenantId));
  const current = result?.value ?? 0;
  return {
    allowed: current < limits.maxCameras,
    current,
    limit: limits.maxCameras,
  };
}

export async function checkProjectLimit(
  tenantId: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limits = await getPlanLimits(tenantId);
  const [result] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.tenantId, tenantId));
  const current = result?.value ?? 0;
  return {
    allowed: current < limits.maxProjects,
    current,
    limit: limits.maxProjects,
  };
}

export async function checkUserLimit(
  tenantId: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limits = await getPlanLimits(tenantId);
  const [result] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.tenantId, tenantId));
  const current = result?.value ?? 0;
  return {
    allowed: current < limits.maxUsers,
    current,
    limit: limits.maxUsers,
  };
}

export async function checkFeatureFlag(
  tenantId: string,
  feature: string,
): Promise<boolean> {
  // On-prem: fast path using license cache
  if (isOnPremDeployment()) {
    return licenseHasFeature(feature);
  }
  const limits = await getPlanLimits(tenantId);
  return limits.features[feature] === true;
}

export async function getUsageSummary(
  tenantId: string,
): Promise<UsageSummary> {
  const limits = await getPlanLimits(tenantId);

  const [cameraCount] = await db
    .select({ value: count() })
    .from(cameras)
    .where(eq(cameras.tenantId, tenantId));

  const [projectCount] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.tenantId, tenantId));

  const [userCount] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.tenantId, tenantId));

  // Get plan name
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  let planName = "free";
  let planDisplayName = "Free";
  if (tenant?.subscriptionPlanId) {
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, tenant.subscriptionPlanId),
    });
    if (plan) {
      planName = plan.name;
      planDisplayName = plan.displayName;
    }
  }

  return {
    cameras: { current: cameraCount?.value ?? 0, limit: limits.maxCameras },
    projects: {
      current: projectCount?.value ?? 0,
      limit: limits.maxProjects,
    },
    users: { current: userCount?.value ?? 0, limit: limits.maxUsers },
    viewerHoursQuota: limits.viewerHoursQuota,
    planName,
    planDisplayName,
  };
}
