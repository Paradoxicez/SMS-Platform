import crypto from "crypto";
import { eq, and, isNotNull, lt, desc } from "drizzle-orm";
import { db, withTenantContext } from "../db/client";
import { webhooks, webhookDeliveries } from "../db/schema";

/**
 * T268: Webhook service
 */

export async function registerWebhook(
  tenantId: string,
  url: string,
  events: string[],
) {
  const secret = crypto.randomBytes(32).toString("hex");

  const [webhook] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(webhooks)
      .values({
        tenantId,
        url,
        events,
        secret,
      })
      .returning();
  });

  return webhook;
}

export async function unregisterWebhook(id: string, tenantId: string) {
  await withTenantContext(tenantId, async (tx) => {
    await tx
      .delete(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.tenantId, tenantId)));
  });
}

export async function updateWebhook(
  id: string,
  tenantId: string,
  data: { url?: string; events?: string[]; isActive?: boolean },
) {
  const [updated] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .update(webhooks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(webhooks.id, id), eq(webhooks.tenantId, tenantId)))
      .returning();
  });
  return updated;
}

export async function listWebhooks(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    return tx.query.webhooks.findMany({
      where: eq(webhooks.tenantId, tenantId),
      orderBy: desc(webhooks.createdAt),
    });
  });
}

export async function getDeliveryLogs(webhookId: string, limit: number = 50) {
  return db.query.webhookDeliveries.findMany({
    where: eq(webhookDeliveries.webhookId, webhookId),
    orderBy: desc(webhookDeliveries.createdAt),
    limit,
  });
}

function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

export async function deliverEvent(
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const activeWebhooks = await withTenantContext(tenantId, async (tx) => {
    return tx.query.webhooks.findMany({
      where: and(
        eq(webhooks.tenantId, tenantId),
        eq(webhooks.isActive, true),
      ),
    });
  });

  for (const webhook of activeWebhooks) {
    const events = (webhook.events as string[]) ?? [];
    if (!events.includes(eventType) && !events.includes("*")) {
      continue;
    }

    const body = JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() });
    const signature = signPayload(body, webhook.secret);

    let responseStatus: number | null = null;
    let deliveredAt: Date | null = null;
    let failedAt: Date | null = null;

    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      responseStatus = res.status;
      if (res.ok) {
        deliveredAt = new Date();
      } else {
        failedAt = new Date();
      }
    } catch {
      failedAt = new Date();
    }

    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      eventType,
      payload: { event: eventType, data: payload },
      responseStatus,
      attempt: 1,
      deliveredAt,
      failedAt,
    });
  }
}

export async function retryFailed() {
  const failed = await db.query.webhookDeliveries.findMany({
    where: and(
      isNotNull(webhookDeliveries.failedAt),
      lt(webhookDeliveries.attempt, 3),
    ),
    limit: 100,
  });

  for (const delivery of failed) {
    const webhook = await db.query.webhooks.findFirst({
      where: eq(webhooks.id, delivery.webhookId),
    });

    if (!webhook || !webhook.isActive) continue;

    const body = JSON.stringify(delivery.payload);
    const signature = signPayload(body, webhook.secret);
    const attempt = delivery.attempt + 1;

    let responseStatus: number | null = null;
    let deliveredAt: Date | null = null;
    let failedAt: Date | null = null;

    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      responseStatus = res.status;
      if (res.ok) {
        deliveredAt = new Date();
      } else {
        failedAt = new Date();
      }
    } catch {
      failedAt = new Date();
    }

    await db
      .update(webhookDeliveries)
      .set({
        attempt,
        responseStatus,
        deliveredAt,
        failedAt,
      })
      .where(eq(webhookDeliveries.id, delivery.id));
  }
}
