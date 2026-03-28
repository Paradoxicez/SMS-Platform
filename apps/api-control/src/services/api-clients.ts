import { createHash, randomBytes } from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { withTenantContext } from "../db/client";
import { apiClients } from "../db/schema/api-clients";
import { users } from "../db/schema/users";
import { projects } from "../db/schema/projects";
import { sites } from "../db/schema/sites";
import { logAuditEvent } from "./audit";

/**
 * T093: API client management service
 */

export async function generateApiKey(
  userId: string,
  tenantId: string,
  label: string,
  opts?: {
    projectId?: string;
    siteId?: string;
    actorId?: string;
    sourceIp?: string;
  },
) {
  const rawKey = randomBytes(32).toString("hex");
  const prefix = rawKey.slice(0, 8);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const [client] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(apiClients)
      .values({
        tenantId,
        userId,
        keyPrefix: prefix,
        keyHash,
        label,
        projectId: opts?.projectId ?? null,
        siteId: opts?.siteId ?? null,
      })
      .returning();
  });

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId: opts?.actorId ?? userId,
    eventType: "api_key.created",
    resourceType: "api_client",
    resourceId: client!.id,
    details: {
      label,
      prefix,
      projectId: opts?.projectId,
      siteId: opts?.siteId,
    },
    sourceIp: opts?.sourceIp,
  });

  return {
    id: client!.id,
    key: rawKey,
    prefix,
    label,
    createdAt: client!.createdAt,
  };
}

export async function listApiKeys(tenantId: string) {
  const keys = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select({
        id: apiClients.id,
        keyPrefix: apiClients.keyPrefix,
        label: apiClients.label,
        projectId: apiClients.projectId,
        siteId: apiClients.siteId,
        lastUsedAt: apiClients.lastUsedAt,
        disabledAt: apiClients.disabledAt,
        revokedAt: apiClients.revokedAt,
        createdAt: apiClients.createdAt,
        createdByName: users.name,
        createdByEmail: users.email,
        projectName: projects.name,
        siteName: sites.name,
      })
      .from(apiClients)
      .leftJoin(users, eq(apiClients.userId, users.id))
      .leftJoin(projects, eq(apiClients.projectId, projects.id))
      .leftJoin(sites, eq(apiClients.siteId, sites.id))
      .where(eq(apiClients.tenantId, tenantId))
      .orderBy(apiClients.createdAt);
  });

  return keys;
}

export async function revokeApiKey(
  id: string,
  tenantId: string,
  actorId: string,
  sourceIp?: string,
) {
  const [revoked] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .update(apiClients)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(apiClients.id, id),
          eq(apiClients.tenantId, tenantId),
          isNull(apiClients.revokedAt),
        ),
      )
      .returning();
  });

  if (!revoked) {
    throw new Error("API key not found or already revoked");
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "api_key.revoked",
    resourceType: "api_client",
    resourceId: id,
    details: { label: revoked.label },
    sourceIp,
  });

  return revoked;
}

export async function disableApiKey(
  id: string,
  tenantId: string,
  actorId: string,
  sourceIp?: string,
) {
  const [disabled] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .update(apiClients)
      .set({ disabledAt: new Date() })
      .where(
        and(
          eq(apiClients.id, id),
          eq(apiClients.tenantId, tenantId),
          isNull(apiClients.revokedAt),
          isNull(apiClients.disabledAt),
        ),
      )
      .returning();
  });

  if (!disabled) {
    throw new Error("API key not found, already disabled, or revoked");
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "api_key.disabled",
    resourceType: "api_client",
    resourceId: id,
    details: { label: disabled.label },
    sourceIp,
  });

  return disabled;
}

export async function enableApiKey(
  id: string,
  tenantId: string,
  actorId: string,
  sourceIp?: string,
) {
  const [enabled] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .update(apiClients)
      .set({ disabledAt: null })
      .where(
        and(
          eq(apiClients.id, id),
          eq(apiClients.tenantId, tenantId),
          isNull(apiClients.revokedAt),
        ),
      )
      .returning();
  });

  if (!enabled) {
    throw new Error("API key not found or revoked");
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "api_key.enabled",
    resourceType: "api_client",
    resourceId: id,
    details: { label: enabled.label },
    sourceIp,
  });

  return enabled;
}

export async function deleteApiKey(
  id: string,
  tenantId: string,
  actorId: string,
  sourceIp?: string,
) {
  const existing = await withTenantContext(tenantId, async (tx) => {
    return tx.query.apiClients.findFirst({
      where: and(eq(apiClients.id, id), eq(apiClients.tenantId, tenantId)),
    });
  });

  if (!existing) {
    throw new Error("API key not found");
  }

  await withTenantContext(tenantId, async (tx) => {
    return tx
      .delete(apiClients)
      .where(
        and(eq(apiClients.id, id), eq(apiClients.tenantId, tenantId)),
      );
  });

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "api_key.deleted",
    resourceType: "api_client",
    resourceId: id,
    details: { label: existing.label },
    sourceIp,
  });

  return { id };
}
