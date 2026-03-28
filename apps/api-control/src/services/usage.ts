import { eq, count, and, sql } from "drizzle-orm";
import { db, withTenantContext } from "../db/client";
import { playbackSessions } from "../db/schema/playback-sessions";
import { cameras } from "../db/schema/cameras";
import { projects } from "../db/schema/projects";
import { sites } from "../db/schema/sites";
import { redis } from "../lib/redis";

interface UsageReport {
  tenantId: string;
  period: string;
  totalSessions: number;
  viewerHoursUsed: number;
  estimatedBandwidthBytes: number;
  byProject: Array<{
    projectId: string;
    projectName: string;
    sessionCount: number;
  }>;
}

/**
 * T104: Usage reporting service
 */
export async function getUsageReport(
  tenantId: string,
  period?: string,
): Promise<UsageReport> {
  const currentPeriod = period ?? new Date().toISOString().slice(0, 7); // YYYY-MM

  // Total sessions issued
  const sessionResult = await withTenantContext(tenantId, async (tx) => {
    const [total] = await tx
      .select({ count: count() })
      .from(playbackSessions)
      .where(eq(playbackSessions.tenantId, tenantId));

    return total?.count ?? 0;
  });

  // Viewer-hours from Redis quota counters
  let viewerHoursUsed = 0;
  try {
    const redisKey = `quota:viewer_hours:${tenantId}:${currentPeriod}`;
    const val = await redis.get(redisKey);
    viewerHoursUsed = val ? parseFloat(val) : 0;
  } catch {
    // Redis unavailable — default to 0
  }

  // Estimated bandwidth: sessions * avg_bitrate (2 Mbps) * avg_duration (30 min)
  const avgBitrateBps = 2_000_000; // 2 Mbps
  const avgDurationSec = 1800; // 30 minutes
  const estimatedBandwidthBytes = Math.round(
    (sessionResult * avgBitrateBps * avgDurationSec) / 8,
  );

  // Sessions grouped by project
  const byProject = await withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select({
        projectId: projects.id,
        projectName: projects.name,
        sessionCount: count(playbackSessions.id),
      })
      .from(playbackSessions)
      .innerJoin(cameras, eq(playbackSessions.cameraId, cameras.id))
      .innerJoin(sites, eq(cameras.siteId, sites.id))
      .innerJoin(projects, eq(sites.projectId, projects.id))
      .where(eq(playbackSessions.tenantId, tenantId))
      .groupBy(projects.id, projects.name);

    return rows.map((r) => ({
      projectId: r.projectId,
      projectName: r.projectName,
      sessionCount: r.sessionCount,
    }));
  });

  return {
    tenantId,
    period: currentPeriod,
    totalSessions: sessionResult,
    viewerHoursUsed,
    estimatedBandwidthBytes,
    byProject,
  };
}
