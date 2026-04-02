import { createMiddleware } from "hono/factory";
import { redis } from "../lib/redis";
import type { AppEnv } from "../types";

// Re-export redis for backward compatibility
export { redis };

const DEFAULT_RATE_LIMIT = 100; // requests per minute

/**
 * T049: Redis rate limiter middleware
 *
 * Tracks API key usage in 3 windows (min/hour/day) for analytics.
 * Key pattern: ratelimit:{tenantId}:{apiClientId}:{window}:{timestamp}
 * Returns 429 with rate limit headers when per-minute limit exceeded.
 */
export const rateLimitMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const apiClientId = c.get("apiClientId") as string | undefined;
  const tenantId = c.get("tenantId") as string | undefined;

  // Only rate-limit API key authenticated requests
  if (!apiClientId || !tenantId) {
    await next();
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  // Minute window
  const minWindow = Math.floor(now / 60) * 60;
  const minKey = `ratelimit:${tenantId}:${apiClientId}:min:${minWindow}`;

  // Hour window
  const hourWindow = Math.floor(now / 3600) * 3600;
  const hourKey = `ratelimit:${tenantId}:${apiClientId}:hour:${hourWindow}`;

  // Day window
  const dayWindow = Math.floor(now / 86400) * 86400;
  const dayKey = `ratelimit:${tenantId}:${apiClientId}:day:${dayWindow}`;

  // Track per-endpoint usage (for top endpoints chart)
  const path = c.req.path.replace(/\/api\/v1/, "").replace(/\/[0-9a-f-]{36}/g, "/:id") || "/";
  const endpointKey = `apistats:${tenantId}:endpoint:${path}`;

  try {
    // Increment all 3 windows + endpoint counter in a pipeline
    const pipeline = redis.pipeline();
    pipeline.incr(minKey);
    pipeline.expire(minKey, 120);     // 2 min TTL
    pipeline.incr(hourKey);
    pipeline.expire(hourKey, 7200);   // 2 hour TTL
    pipeline.incr(dayKey);
    pipeline.expire(dayKey, 172800);  // 2 day TTL
    pipeline.incr(endpointKey);
    pipeline.expire(endpointKey, 86400); // 1 day TTL
    const results = await pipeline.exec();

    const currentMin = (results?.[0]?.[1] as number) ?? 0;
    const remaining = Math.max(0, DEFAULT_RATE_LIMIT - currentMin);
    const resetAt = minWindow + 60;

    // Rate limit headers
    c.header("X-RateLimit-Limit", String(DEFAULT_RATE_LIMIT));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(resetAt));

    if (currentMin > DEFAULT_RATE_LIMIT) {
      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Rate limit exceeded. Try again later.",
          },
        },
        429,
      );
    }
  } catch {
    // Fail-open if Redis unavailable
    console.error("[rate-limit] Redis error, failing open");
  }

  await next();
});
