import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import Redis from "ioredis";
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from "../services/notifications";

import type { AppEnv } from "../types";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const notificationsRouter = new Hono<AppEnv>();

// GET /notifications — list recent notifications
notificationsRouter.get("/notifications", async (c) => {
  const userId = c.get("userId") as string;
  const tenantId = c.get("tenantId") as string;
  const limit = parseInt(c.req.query("limit") ?? "20", 10);

  const items = await listNotifications(userId, tenantId, limit);

  return c.json({
    data: items,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /notifications/unread-count
notificationsRouter.get("/notifications/unread-count", async (c) => {
  const userId = c.get("userId") as string;
  const tenantId = c.get("tenantId") as string;

  const count = await getUnreadCount(userId, tenantId);

  return c.json({
    data: { count },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /notifications/read-all — mark all as read
notificationsRouter.post("/notifications/read-all", async (c) => {
  const userId = c.get("userId") as string;
  const tenantId = c.get("tenantId") as string;

  await markAllAsRead(userId, tenantId);

  return c.json({
    data: { success: true },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /notifications/:id/read — mark single as read
notificationsRouter.post("/notifications/:id/read", async (c) => {
  const userId = c.get("userId") as string;
  const notificationId = c.req.param("id");

  const updated = await markAsRead(notificationId, userId);

  if (!updated) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Notification not found" } },
      404,
    );
  }

  return c.json({
    data: updated,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /notifications/stream — SSE endpoint for real-time notifications
notificationsRouter.get("/notifications/stream", async (c) => {
  const userId = c.get("userId") as string;

  return streamSSE(c, async (stream) => {
    const subscriber = new Redis(REDIS_URL);
    const channel = `notifications:${userId}`;

    await subscriber.subscribe(channel);

    // Send initial keepalive
    await stream.writeSSE({ data: JSON.stringify({ type: "connected" }), event: "connected" });

    const messageHandler = async (_ch: string, message: string) => {
      try {
        await stream.writeSSE({ data: message, event: "notification" });
      } catch {
        // Client disconnected
      }
    };

    subscriber.on("message", messageHandler);

    // Keepalive every 30 seconds
    const keepalive = setInterval(async () => {
      try {
        await stream.writeSSE({ data: "", event: "keepalive" });
      } catch {
        clearInterval(keepalive);
      }
    }, 30000);

    // Wait for client disconnect
    stream.onAbort(() => {
      clearInterval(keepalive);
      subscriber.unsubscribe(channel);
      subscriber.disconnect();
    });

    // Keep the stream open
    await new Promise(() => {});
  });
});

export { notificationsRouter };
