import Redis from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

const THUMBNAIL_TTL_SECONDS = 10;

interface ThumbnailCacheEntry {
  url: string;
  updated_at: string;
  stale: boolean;
}

/**
 * T083: Thumbnail cache
 *
 * Stores thumbnail URLs in Redis with a short TTL.
 * When the key expires, the last-known value can be returned with a stale flag.
 */

/**
 * Update the thumbnail cache for a camera.
 * Sets Redis key `thumbnail:{cameraId}` with JSON payload and a 10-second TTL.
 */
export async function updateThumbnailCache(
  cameraId: string,
  url: string,
): Promise<void> {
  const key = `thumbnail:${cameraId}`;
  const lastKnownKey = `thumbnail:last:${cameraId}`;

  const entry: ThumbnailCacheEntry = {
    url,
    updated_at: new Date().toISOString(),
    stale: false,
  };

  const value = JSON.stringify(entry);

  // Set the main key with TTL and persist the last-known value (no TTL)
  await Promise.all([
    redis.set(key, value, "EX", THUMBNAIL_TTL_SECONDS),
    redis.set(lastKnownKey, value),
  ]);
}

/**
 * Get the thumbnail URL for a camera.
 * Returns the cached entry if fresh; otherwise returns the last-known entry with stale: true.
 * Returns null if no thumbnail has ever been cached.
 */
export async function getThumbnailUrl(
  cameraId: string,
): Promise<ThumbnailCacheEntry | null> {
  const key = `thumbnail:${cameraId}`;
  const raw = await redis.get(key);

  if (raw) {
    return JSON.parse(raw) as ThumbnailCacheEntry;
  }

  // Key expired — try last-known
  const lastKnownKey = `thumbnail:last:${cameraId}`;
  const lastKnownRaw = await redis.get(lastKnownKey);

  if (lastKnownRaw) {
    const entry = JSON.parse(lastKnownRaw) as ThumbnailCacheEntry;
    return { ...entry, stale: true };
  }

  return null;
}

/**
 * Mark a camera's thumbnail as stale.
 * Updates the main cache entry's stale flag without resetting TTL.
 */
export async function markStale(cameraId: string): Promise<void> {
  const key = `thumbnail:${cameraId}`;
  const raw = await redis.get(key);

  if (raw) {
    const entry = JSON.parse(raw) as ThumbnailCacheEntry;
    entry.stale = true;
    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      await redis.set(key, JSON.stringify(entry), "EX", ttl);
    }
  }

  // Also mark the last-known entry as stale
  const lastKnownKey = `thumbnail:last:${cameraId}`;
  const lastKnownRaw = await redis.get(lastKnownKey);
  if (lastKnownRaw) {
    const entry = JSON.parse(lastKnownRaw) as ThumbnailCacheEntry;
    entry.stale = true;
    await redis.set(lastKnownKey, JSON.stringify(entry));
  }
}

export { redis as thumbnailRedis };
