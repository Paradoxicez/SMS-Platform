import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { tenants } from "../db/schema/tenants";
import { projects } from "../db/schema/projects";
import { redis } from "../lib/redis";

/**
 * T085: Viewer-hours quota service
 *
 * Tracks viewer-hours consumption per tenant and project using Redis counters.
 * Checks quota limits before allowing new playback sessions.
 */

interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/** Get the current YYYY-MM month key for quota bucketing. */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Check whether a tenant (and optionally a project) has remaining viewer-hours quota.
 * Returns { allowed, remaining, limit }.
 */
export async function checkQuota(
  tenantId: string,
  projectId?: string,
): Promise<QuotaCheckResult> {
  const month = getCurrentMonth();

  // Fetch tenant quota limit
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    return { allowed: false, remaining: 0, limit: 0 };
  }

  const tenantLimit = tenant.viewerHoursQuota; // in hours
  const tenantKey = `quota:viewer_hours:${tenantId}:${month}`;
  const tenantUsedRaw = await redis.get(tenantKey);
  const tenantUsedSeconds = parseFloat(tenantUsedRaw ?? "0");
  const tenantUsedHours = tenantUsedSeconds / 3600;

  if (tenantUsedHours >= tenantLimit) {
    return {
      allowed: false,
      remaining: Math.max(0, tenantLimit - tenantUsedHours),
      limit: tenantLimit,
    };
  }

  // Check project-level quota if a projectId is provided
  if (projectId) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (project?.viewerHoursQuota) {
      const projectLimit = project.viewerHoursQuota;
      const projectKey = `quota:viewer_hours:${projectId}:${month}`;
      const projectUsedRaw = await redis.get(projectKey);
      const projectUsedSeconds = parseFloat(projectUsedRaw ?? "0");
      const projectUsedHours = projectUsedSeconds / 3600;

      if (projectUsedHours >= projectLimit) {
        return {
          allowed: false,
          remaining: Math.max(0, projectLimit - projectUsedHours),
          limit: projectLimit,
        };
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, tenantLimit - tenantUsedHours),
    limit: tenantLimit,
  };
}

/**
 * Increment viewer time consumption for a tenant and project.
 * Uses Redis INCRBYFLOAT on quota counters. Keys auto-expire at end of month + buffer.
 */
export async function incrementViewerTime(
  tenantId: string,
  projectId: string,
  seconds: number,
): Promise<void> {
  const month = getCurrentMonth();

  const tenantKey = `quota:viewer_hours:${tenantId}:${month}`;
  const projectKey = `quota:viewer_hours:${projectId}:${month}`;

  // TTL: expire keys ~35 days from now (covers the billing month + buffer)
  const ttlSeconds = 35 * 24 * 60 * 60;

  const pipeline = redis.pipeline();
  pipeline.incrbyfloat(tenantKey, seconds);
  pipeline.expire(tenantKey, ttlSeconds);
  pipeline.incrbyfloat(projectKey, seconds);
  pipeline.expire(projectKey, ttlSeconds);
  await pipeline.exec();
}

/**
 * Get the current viewer-hours usage for a tenant this month.
 * Returns usage in hours.
 */
export async function getUsage(
  tenantId: string,
): Promise<{ used_hours: number; limit: number; month: string }> {
  const month = getCurrentMonth();

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  const tenantKey = `quota:viewer_hours:${tenantId}:${month}`;
  const usedRaw = await redis.get(tenantKey);
  const usedSeconds = parseFloat(usedRaw ?? "0");
  const usedHours = Math.round((usedSeconds / 3600) * 100) / 100;

  return {
    used_hours: usedHours,
    limit: tenant?.viewerHoursQuota ?? 0,
    month,
  };
}
