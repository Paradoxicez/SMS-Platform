import { redis } from "../lib/redis";

/**
 * T277: Rate analytics service
 *
 * Aggregates API usage data from Redis rate-limit keys.
 * Key patterns:
 *   ratelimit:{tenantId}:{apiClientId}:{min|hour|day}:{timestamp} — per-window counters
 *   apistats:{tenantId}:endpoint:{path} — per-endpoint daily counters
 */

interface ApiUsageResult {
  current_requests_per_minute: number;
  current_requests_per_hour: number;
  current_requests_per_day: number;
  top_endpoints: { endpoint: string; count: number }[];
}

export async function getApiUsage(
  tenantId: string,
  apiClientId?: string,
): Promise<ApiUsageResult> {
  const prefix = apiClientId
    ? `ratelimit:${tenantId}:${apiClientId}`
    : `ratelimit:${tenantId}`;

  let reqPerMin = 0;
  let reqPerHour = 0;
  let reqPerDay = 0;

  try {
    // Scan rate-limit keys for request counts
    const keys: string[] = [];
    let cursor = "0";

    do {
      const [nextCursor, batch] = await redis.scan(
        cursor,
        "MATCH",
        `${prefix}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== "0");

    for (const key of keys) {
      const value = await redis.get(key);
      const count = parseInt(value ?? "0", 10);

      if (key.includes(":min:")) {
        reqPerMin += count;
      } else if (key.includes(":hour:")) {
        reqPerHour += count;
      } else if (key.includes(":day:")) {
        reqPerDay += count;
      }
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        service: "rate-analytics",
        message: "Failed to read rate limit keys",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  // Scan endpoint stats
  const endpointCounts = new Map<string, number>();
  try {
    const endpointPrefix = `apistats:${tenantId}:endpoint:`;
    let cursor = "0";
    const endpointKeys: string[] = [];

    do {
      const [nextCursor, batch] = await redis.scan(
        cursor,
        "MATCH",
        `${endpointPrefix}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      endpointKeys.push(...batch);
    } while (cursor !== "0");

    for (const key of endpointKeys) {
      const value = await redis.get(key);
      const count = parseInt(value ?? "0", 10);
      const endpoint = key.replace(endpointPrefix, "");
      endpointCounts.set(endpoint, count);
    }
  } catch {
    // Best-effort
  }

  // Sort endpoints by count descending, take top 5
  const topEndpoints = Array.from(endpointCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([endpoint, count]) => ({ endpoint, count }));

  return {
    current_requests_per_minute: reqPerMin,
    current_requests_per_hour: reqPerHour,
    current_requests_per_day: reqPerDay,
    top_endpoints: topEndpoints,
  };
}
