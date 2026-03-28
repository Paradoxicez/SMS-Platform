import { eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  cameras,
  sites,
  projects,
  users,
  policies,
  streamProfiles,
  auditEvents,
  notifications,
  webhooks,
  invoices,
  tenants,
  apiClients,
} from "../db/schema";
import { recordings } from "../db/schema/recordings";
import { aiIntegrations, aiEvents } from "../db/schema/ai-integrations";
import { webhookDeliveries } from "../db/schema/webhooks";

/**
 * T274: Tenant deletion service (GDPR right to erasure)
 *
 * Cascade-deletes all tenant data. The confirmationName must match the tenant name.
 */
export async function deleteTenant(
  tenantId: string,
  confirmationName: string,
): Promise<{ deleted: boolean }> {
  // Verify confirmation name matches
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { name: true },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  if (tenant.name !== confirmationName) {
    throw new Error("Confirmation name does not match tenant name");
  }

  // Log to system log before deletion (not tenant-scoped)
  console.log(
    JSON.stringify({
      level: "warn",
      service: "tenant-deletion",
      message: "Tenant deletion initiated",
      tenantId,
      tenantName: tenant.name,
      timestamp: new Date().toISOString(),
    }),
  );

  // Cascade delete in dependency order
  await db.transaction(async (tx) => {
    // AI events and integrations
    await tx.delete(aiEvents).where(eq(aiEvents.tenantId, tenantId));
    await tx.delete(aiIntegrations).where(eq(aiIntegrations.tenantId, tenantId));

    // Recordings
    await tx.delete(recordings).where(eq(recordings.tenantId, tenantId));

    // Webhook deliveries (via webhook cascade), then webhooks
    const tenantWebhooks = await tx
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(eq(webhooks.tenantId, tenantId));
    for (const wh of tenantWebhooks) {
      await tx.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, wh.id));
    }
    await tx.delete(webhooks).where(eq(webhooks.tenantId, tenantId));

    // Notifications
    await tx.delete(notifications).where(eq(notifications.tenantId, tenantId));

    // Audit events
    await tx.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

    // Cameras
    await tx.delete(cameras).where(eq(cameras.tenantId, tenantId));

    // Sites (depends on cameras being gone)
    await tx.delete(sites).where(eq(sites.tenantId, tenantId));

    // Projects
    await tx.delete(projects).where(eq(projects.tenantId, tenantId));

    // Stream profiles
    await tx.delete(streamProfiles).where(eq(streamProfiles.tenantId, tenantId));

    // Policies
    await tx.delete(policies).where(eq(policies.tenantId, tenantId));

    // API clients
    await tx.delete(apiClients).where(eq(apiClients.tenantId, tenantId));

    // Users
    await tx.delete(users).where(eq(users.tenantId, tenantId));

    // Billing
    await tx.delete(invoices).where(eq(invoices.tenantId, tenantId));

    // Finally delete the tenant itself
    await tx.delete(tenants).where(eq(tenants.id, tenantId));
  });

  console.log(
    JSON.stringify({
      level: "warn",
      service: "tenant-deletion",
      message: "Tenant deletion completed",
      tenantId,
      timestamp: new Date().toISOString(),
    }),
  );

  return { deleted: true };
}
