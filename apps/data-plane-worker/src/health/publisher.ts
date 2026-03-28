/**
 * T063: Redis Pub/Sub publisher for camera health updates.
 *
 * Publishes to:
 * - `camera:health:updates` — periodic health metrics
 * - `camera:health:state_change` — state transition events
 *
 * Also writes to Redis cache key `camera:health:{cameraId}` with 30s TTL.
 */

import Redis from "ioredis";

const HEALTH_UPDATES_CHANNEL = "camera:health:updates";
const STATE_CHANGE_CHANNEL = "camera:health:state_change";
const CACHE_TTL_SECONDS = 30;

export interface HealthUpdateMessage {
  camera_id: string;
  tenant_id: string;
  health_status: string;
  metrics?: Record<string, unknown>;
  timestamp: string;
}

export interface StateChangeMessage {
  camera_id: string;
  tenant_id: string;
  previous_state: string;
  new_state: string;
  event: string;
  timestamp: string;
}

export class HealthPublisher {
  private publisher: Redis;
  private cacheClient: Redis;

  constructor(redisUrl: string = "redis://localhost:6379") {
    this.publisher = new Redis(redisUrl);
    this.cacheClient = new Redis(redisUrl);

    this.publisher.on("error", (err) => {
      console.error(
        JSON.stringify({
          level: "error",
          service: "health-publisher",
          message: "Redis publisher error",
          error: err.message,
        }),
      );
    });

    this.cacheClient.on("error", (err) => {
      console.error(
        JSON.stringify({
          level: "error",
          service: "health-publisher",
          message: "Redis cache client error",
          error: err.message,
        }),
      );
    });
  }

  /**
   * Publish a health update message and update cache.
   */
  async publishHealthUpdate(message: HealthUpdateMessage): Promise<void> {
    const payload = JSON.stringify(message);

    await Promise.all([
      this.publisher.publish(HEALTH_UPDATES_CHANNEL, payload),
      this.cacheClient.setex(
        `camera:health:${message.camera_id}`,
        CACHE_TTL_SECONDS,
        JSON.stringify({
          camera_id: message.camera_id,
          health_status: message.health_status,
          metrics: message.metrics ?? {},
          updated_at: message.timestamp,
        }),
      ),
    ]);
  }

  /**
   * Publish a state change event and update cache.
   */
  async publishStateChange(message: StateChangeMessage): Promise<void> {
    const payload = JSON.stringify(message);

    await Promise.all([
      this.publisher.publish(STATE_CHANGE_CHANNEL, payload),
      this.cacheClient.setex(
        `camera:health:${message.camera_id}`,
        CACHE_TTL_SECONDS,
        JSON.stringify({
          camera_id: message.camera_id,
          health_status: message.new_state,
          updated_at: message.timestamp,
        }),
      ),
    ]);
  }

  /**
   * Disconnect from Redis.
   */
  async disconnect(): Promise<void> {
    this.publisher.disconnect();
    this.cacheClient.disconnect();
  }
}
