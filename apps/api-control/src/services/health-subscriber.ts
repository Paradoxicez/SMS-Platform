import Redis from "ioredis";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { cameras, users } from "../db/schema";
import { logAuditEvent } from "./audit";
import { createNotification } from "./notifications";
import { deliverEvent } from "./webhooks";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

let subscriber: Redis | null = null;
let cacheClient: Redis | null = null;

interface HealthUpdate {
  camera_id: string;
  tenant_id: string;
  health_status: string;
  metrics?: Record<string, unknown>;
  timestamp: string;
}

interface StateChangeEvent {
  camera_id: string;
  tenant_id: string;
  previous_state: string;
  new_state: string;
  event: string;
  timestamp: string;
}

function getCacheClient(): Redis {
  if (!cacheClient) {
    cacheClient = new Redis(REDIS_URL);
  }
  return cacheClient;
}

/**
 * T064: Redis Pub/Sub subscriber for camera health updates.
 *
 * Subscribes to:
 * - `camera:health:updates` — update Redis cache with latest health data
 * - `camera:health:state_change` — update camera.health_status in PostgreSQL, log audit event
 */
export function startHealthSubscriber(): void {
  subscriber = new Redis(REDIS_URL);

  subscriber.subscribe("camera:health:updates", "camera:health:state_change", (err) => {
    if (err) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "health-subscriber",
          message: "Failed to subscribe to Redis channels",
          error: err.message,
        }),
      );
      return;
    }
    console.log(
      JSON.stringify({
        level: "info",
        service: "health-subscriber",
        message: "Subscribed to camera health channels",
      }),
    );
  });

  subscriber.on("message", async (channel, message) => {
    try {
      if (channel === "camera:health:updates") {
        await handleHealthUpdate(JSON.parse(message) as HealthUpdate);
      } else if (channel === "camera:health:state_change") {
        await handleStateChange(JSON.parse(message) as StateChangeEvent);
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "health-subscriber",
          message: "Failed to process health message",
          channel,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  });

  subscriber.on("error", (err) => {
    console.error(
      JSON.stringify({
        level: "error",
        service: "health-subscriber",
        message: "Redis subscriber error",
        error: err.message,
      }),
    );
  });
}

async function handleHealthUpdate(data: HealthUpdate): Promise<void> {
  const cache = getCacheClient();
  await cache.setex(
    `camera:health:${data.camera_id}`,
    30,
    JSON.stringify({
      camera_id: data.camera_id,
      health_status: data.health_status,
      metrics: data.metrics ?? {},
      updated_at: data.timestamp,
    }),
  );
}

async function handleStateChange(data: StateChangeEvent): Promise<void> {
  // Update camera health status in PostgreSQL
  const now = new Date();
  const updateFields: Record<string, unknown> = {
    healthStatus: data.new_state as
      | "connecting"
      | "online"
      | "degraded"
      | "offline"
      | "reconnecting"
      | "stopping"
      | "stopped",
    updatedAt: now,
  };
  if (data.new_state === "online") {
    updateFields.lastSeenAt = now;
  }
  await db
    .update(cameras)
    .set(updateFields)
    .where(eq(cameras.id, data.camera_id));

  // Also update cache
  const cache = getCacheClient();
  await cache.setex(
    `camera:health:${data.camera_id}`,
    30,
    JSON.stringify({
      camera_id: data.camera_id,
      health_status: data.new_state,
      updated_at: data.timestamp,
    }),
  );

  // Log audit event
  logAuditEvent({
    tenantId: data.tenant_id,
    actorType: "system",
    eventType: "camera.status_changed",
    resourceType: "camera",
    resourceId: data.camera_id,
    details: {
      previous_state: data.previous_state,
      new_state: data.new_state,
      event: data.event,
    },
  });

  // T270: Deliver webhook event for camera state changes
  deliverEvent(data.tenant_id, `camera.${data.new_state}`, {
    camera_id: data.camera_id,
    previous_state: data.previous_state,
    new_state: data.new_state,
    event: data.event,
    timestamp: data.timestamp,
  }).catch((err) => {
    console.error(
      JSON.stringify({
        level: "error",
        service: "health-subscriber",
        message: "Failed to deliver webhook for state change",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });

  // Send notifications for state changes
  if (data.new_state === "online" && (data.previous_state === "offline" || data.previous_state === "degraded")) {
    try {
      const camera = await db.query.cameras.findFirst({
        where: eq(cameras.id, data.camera_id),
        columns: { name: true },
      });
      const cameraName = camera?.name ?? data.camera_id;
      const tenantUsers = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.tenantId, data.tenant_id));
      const relevantUsers = tenantUsers.filter(
        (u) => u.role === "admin" || u.role === "operator",
      );
      for (const user of relevantUsers) {
        createNotification({
          userId: user.id,
          tenantId: data.tenant_id,
          type: "camera.online",
          title: `Camera '${cameraName}' is back online`,
          message: `Camera '${cameraName}' recovered from ${data.previous_state} state.`,
          link: `/cameras`,
        }).catch(() => {});
      }
    } catch {
      // notification delivery is best-effort
    }
  }

  if (data.new_state === "offline" || data.new_state === "degraded") {
    try {
      // Look up camera name
      const camera = await db.query.cameras.findFirst({
        where: eq(cameras.id, data.camera_id),
        columns: { name: true },
      });

      const cameraName = camera?.name ?? data.camera_id;

      // Look up all users in the tenant (admins and operators)
      const tenantUsers = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.tenantId, data.tenant_id));

      const relevantUsers = tenantUsers.filter(
        (u) => u.role === "admin" || u.role === "operator",
      );

      const notificationType =
        data.new_state === "offline" ? "camera.offline" : "camera.degraded";
      const title =
        data.new_state === "offline"
          ? `Camera '${cameraName}' went offline`
          : `Camera '${cameraName}' degraded`;
      const message =
        data.new_state === "offline"
          ? `Camera '${cameraName}' has gone offline. Previous state: ${data.previous_state}.`
          : `Camera '${cameraName}' is experiencing degraded performance.`;

      for (const user of relevantUsers) {
        createNotification({
          userId: user.id,
          tenantId: data.tenant_id,
          type: notificationType,
          title,
          message,
          link: `/cameras`,
        }).catch((err) => {
          console.error(
            JSON.stringify({
              level: "error",
              service: "health-subscriber",
              message: "Failed to create notification",
              userId: user.id,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        });
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "health-subscriber",
          message: "Failed to send health change notifications",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

export function stopHealthSubscriber(): void {
  if (subscriber) {
    subscriber.unsubscribe();
    subscriber.disconnect();
    subscriber = null;
  }
  if (cacheClient) {
    cacheClient.disconnect();
    cacheClient = null;
  }
}
