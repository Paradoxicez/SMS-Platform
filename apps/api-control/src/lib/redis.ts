import Redis from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

/**
 * Shared Redis client instance.
 * Reuse across services (playback, rate-limit, health-subscriber).
 */
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
