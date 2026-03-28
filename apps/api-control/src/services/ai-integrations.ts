import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db, withTenantContext } from "../db/client";
import { aiIntegrations, aiEvents } from "../db/schema/ai-integrations";
import { deliverEvent } from "./webhooks";

/**
 * T297: AI integrations service
 */

interface CreateIntegrationData {
  name: string;
  endpoint_url: string;
  api_key?: string;
  event_types: string[];
  cameras: string[];
  interval_seconds?: number;
}

export async function createIntegration(
  tenantId: string,
  data: CreateIntegrationData,
) {
  const [integration] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(aiIntegrations)
      .values({
        tenantId,
        name: data.name,
        endpointUrl: data.endpoint_url,
        apiKeyEncrypted: data.api_key ?? null, // TODO: encrypt in production
        eventTypes: data.event_types,
        cameras: data.cameras,
        intervalSeconds: data.interval_seconds ?? 30,
      })
      .returning();
  });

  return integration;
}

export async function listIntegrations(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    return tx.query.aiIntegrations.findMany({
      where: eq(aiIntegrations.tenantId, tenantId),
      orderBy: desc(aiIntegrations.createdAt),
    });
  });
}

export async function deleteIntegration(id: string, tenantId: string) {
  await withTenantContext(tenantId, async (tx) => {
    // Delete associated events first
    await tx
      .delete(aiEvents)
      .where(and(eq(aiEvents.integrationId, id), eq(aiEvents.tenantId, tenantId)));
    await tx
      .delete(aiIntegrations)
      .where(and(eq(aiIntegrations.id, id), eq(aiIntegrations.tenantId, tenantId)));
  });
}

interface StoreAiEventData {
  tenant_id: string;
  integration_id: string;
  camera_id: string;
  event_type: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export async function storeAiEvent(data: StoreAiEventData) {
  const [event] = await db
    .insert(aiEvents)
    .values({
      tenantId: data.tenant_id,
      integrationId: data.integration_id,
      cameraId: data.camera_id,
      eventType: data.event_type,
      confidence: data.confidence ?? null,
      metadata: data.metadata ?? null,
    })
    .returning();

  // Trigger webhooks for AI events
  deliverEvent(data.tenant_id, `ai.${data.event_type}`, {
    camera_id: data.camera_id,
    integration_id: data.integration_id,
    event_type: data.event_type,
    confidence: data.confidence,
    metadata: data.metadata,
  }).catch((err) => {
    console.error(
      JSON.stringify({
        level: "error",
        service: "ai-integrations",
        message: "Failed to deliver AI event webhook",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });

  return event;
}

export async function listAiEvents(
  tenantId: string,
  cameraId?: string,
  from?: Date,
  to?: Date,
  limit: number = 50,
) {
  return withTenantContext(tenantId, async (tx) => {
    const conditions = [eq(aiEvents.tenantId, tenantId)];

    if (cameraId) {
      conditions.push(eq(aiEvents.cameraId, cameraId));
    }
    if (from) {
      conditions.push(gte(aiEvents.createdAt, from));
    }
    if (to) {
      conditions.push(lte(aiEvents.createdAt, to));
    }

    return tx
      .select()
      .from(aiEvents)
      .where(and(...conditions))
      .orderBy(desc(aiEvents.createdAt))
      .limit(limit);
  });
}
