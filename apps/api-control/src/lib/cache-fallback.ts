import { redis } from "./redis";

/**
 * T281: Cache fallback utility
 *
 * Tries fetchFn first. On success, caches the result in Redis.
 * On failure, returns the cached (stale) value if available.
 */
export async function withCacheFallback<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>,
): Promise<{ data: T; stale: boolean }> {
  try {
    const data = await fetchFn();

    // Cache the fresh result
    await redis
      .setex(`cache:${key}`, ttl, JSON.stringify(data))
      .catch(() => {
        // Redis write failure is non-fatal
      });

    return { data, stale: false };
  } catch (err) {
    // Primary fetch failed — try to return cached value
    try {
      const cached = await redis.get(`cache:${key}`);
      if (cached) {
        return { data: JSON.parse(cached) as T, stale: true };
      }
    } catch {
      // Redis read also failed
    }

    // No cached value available — rethrow original error
    throw err;
  }
}
