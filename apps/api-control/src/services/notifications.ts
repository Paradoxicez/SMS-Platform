import { eq, and, desc, count } from "drizzle-orm";
import { db, withTenantContext } from "../db/client";
import { notifications } from "../db/schema/notifications";
import { users } from "../db/schema/users";
import Redis from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

let publisherClient: Redis | null = null;

function getPublisher(): Redis {
  if (!publisherClient) {
    publisherClient = new Redis(REDIS_URL);
  }
  return publisherClient;
}

interface CreateNotificationParams {
  userId: string;
  tenantId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(
  params: CreateNotificationParams,
) {
  const { userId, tenantId, type, title, message, link } = params;

  const [notification] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(notifications)
      .values({
        userId,
        tenantId,
        type,
        title,
        message,
        link: link ?? null,
      })
      .returning();
  });

  // Publish to Redis for SSE subscribers
  try {
    const publisher = getPublisher();
    await publisher.publish(
      `notifications:${userId}`,
      JSON.stringify(notification),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        service: "notifications",
        message: "Failed to publish notification to Redis",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return notification!;
}

export async function listNotifications(
  userId: string,
  tenantId: string,
  limit: number = 20,
) {
  const items = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.tenantId, tenantId),
        ),
      )
      .orderBy(notifications.read, desc(notifications.createdAt))
      .limit(limit);
  });

  return items;
}

export async function markAsRead(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      ),
    )
    .returning();

  return updated;
}

export async function markAllAsRead(userId: string, tenantId: string) {
  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.tenantId, tenantId),
          eq(notifications.read, false),
        ),
      );
  });
}

export async function getUnreadCount(
  userId: string,
  tenantId: string,
): Promise<number> {
  const result = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.tenantId, tenantId),
          eq(notifications.read, false),
        ),
      );
  });

  return result[0]?.count ?? 0;
}

/**
 * Send a notification to all admins (and optionally operators) in a tenant.
 * Best-effort — errors are swallowed.
 */
export async function notifyTenantUsers(
  tenantId: string,
  params: {
    type: string;
    title: string;
    message: string;
    link?: string;
    roles?: string[];
  },
) {
  const targetRoles = params.roles ?? ["admin", "operator"];
  try {
    const tenantUsers = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    const targets = tenantUsers.filter((u) => targetRoles.includes(u.role));

    for (const user of targets) {
      createNotification({
        userId: user.id,
        tenantId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
      }).catch(() => {});
    }
  } catch {
    // best-effort
  }
}
