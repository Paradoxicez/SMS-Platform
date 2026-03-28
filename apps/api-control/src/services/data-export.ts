import { eq } from "drizzle-orm";
import { db, withTenantContext } from "../db/client";
import {
  cameras,
  projects,
  sites,
  users,
  policies,
  streamProfiles,
  auditEvents,
} from "../db/schema";

/**
 * T273: Data export service (GDPR)
 *
 * Exports all tenant data as a JSON object.
 * For MVP, this returns a JSON buffer; ZIP packaging can be added later.
 */
export async function exportTenantData(tenantId: string): Promise<Buffer> {
  const data = await withTenantContext(tenantId, async (tx) => {
    const [
      tenantCameras,
      tenantProjects,
      tenantSites,
      tenantUsers,
      tenantPolicies,
      tenantProfiles,
      tenantAuditEvents,
    ] = await Promise.all([
      tx.select().from(cameras).where(eq(cameras.tenantId, tenantId)),
      tx.select().from(projects).where(eq(projects.tenantId, tenantId)),
      tx.select().from(sites).where(eq(sites.tenantId, tenantId)),
      tx.select().from(users).where(eq(users.tenantId, tenantId)),
      tx.select().from(policies).where(eq(policies.tenantId, tenantId)),
      tx.select().from(streamProfiles).where(eq(streamProfiles.tenantId, tenantId)),
      tx.select().from(auditEvents).where(eq(auditEvents.tenantId, tenantId)),
    ]);

    return {
      exported_at: new Date().toISOString(),
      tenant_id: tenantId,
      cameras: tenantCameras,
      projects: tenantProjects,
      sites: tenantSites,
      users: tenantUsers,
      policies: tenantPolicies,
      stream_profiles: tenantProfiles,
      audit_events: tenantAuditEvents,
    };
  });

  // TODO: For large tenants, generate as a background job and use archiver for ZIP+CSV
  return Buffer.from(JSON.stringify(data, null, 2), "utf-8");
}
