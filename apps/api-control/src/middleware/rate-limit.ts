import { createMiddleware } from "hono/factory";
import { redis } from "../lib/redis";
import type { AppEnv } from "../types";

// Re-export redis for backward compatibility
export { redis };

const DEFAULT_RATE_LIMIT = 100; // requests per minute

/**
 * T049: Redis sliding window rate limiter middleware
 *
 * Uses a fixed-window counter per API client per minute window.
 * Key pattern: ratelimit:{apiClientId}:{window_timestamp}
 * Returns 429 with rate limit headers when limit exceeded.
 */
export const rateLimitMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const apiClientId = c.get("apiClientId") as string | undefined;

  // Only rate-limit API key authenticated requests
  if (!apiClientId) {
    await next();
    return;
  }

  const limit = DEFAULT_RATE_LIMIT;
  const windowSeconds = 60;
  const now = Math.floor(Date.now() / 1000);
  const windowTimestamp = Math.floor(now / windowSeconds) * windowSeconds;
  const key = `ratelimit:${apiClientId}:${windowTimestamp}`;
  const resetAt = windowTimestamp + windowSeconds;

  try {
    const current = await redis.incr(key);

    // Set TTL on first increment (new key)
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - current);

    // Always add rate limit headers
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(resetAt));

    if (current > limit) {
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
    // If Redis is unavailable, allow the request through (fail-open).
    // Log the error for observability in production.
    console.error("[rate-limit] Redis error, failing open");
  }

  await next();
});
