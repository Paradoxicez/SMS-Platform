import { eq, and, count, sql } from "drizzle-orm";
import { db, withTenantContext } from "../db/client";
import { users } from "../db/schema/users";
import { logAuditEvent } from "./audit";

interface InviteUserParams {
  tenantId: string;
  email: string;
  name: string;
  role: "admin" | "operator" | "developer" | "viewer";
  actorId: string;
  sourceIp?: string;
}

interface ChangeRoleParams {
  userId: string;
  newRole: "admin" | "operator" | "developer" | "viewer";
  actorId: string;
  tenantId: string;
  sourceIp?: string;
}

interface ListUsersParams {
  tenantId: string;
  page: number;
  perPage: number;
}

interface UpdateProfileParams {
  userId: string;
  tenantId: string;
  name?: string;
  email?: string;
  sourceIp?: string;
}

interface RemoveUserParams {
  userId: string;
  tenantId: string;
  actorId: string;
  sourceIp?: string;
}

/**
 * T091: User management service
 */

export async function inviteUser(params: InviteUserParams) {
  const { tenantId, email, name, role, actorId, sourceIp } = params;

  const [user] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(users)
      .values({
        tenantId,
        email,
        name,
        role,
      })
      .returning();
  });

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "user.role_changed",
    resourceType: "user",
    resourceId: user!.id,
    details: { action: "invite", email, role },
    sourceIp,
  });

  return user!;
}

export async function changeRole(params: ChangeRoleParams) {
  const { userId, newRole, actorId, tenantId, sourceIp } = params;

  const [updated] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .update(users)
      .set({ role: newRole })
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .returning();
  });

  if (!updated) {
    throw new Error("User not found");
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "user.role_changed",
    resourceType: "user",
    resourceId: userId,
    details: { action: "change_role", newRole, previousRole: undefined },
    sourceIp,
  });

  return updated;
}

export async function listUsers(params: ListUsersParams) {
  const { tenantId, page, perPage } = params;
  const offset = (page - 1) * perPage;

  const result = await withTenantContext(tenantId, async (tx) => {
    const whereClause = eq(users.tenantId, tenantId);

    const [items, totalResult] = await Promise.all([
      tx
        .select()
        .from(users)
        .where(whereClause)
        .limit(perPage)
        .offset(offset)
        .orderBy(users.createdAt),
      tx.select({ count: count() }).from(users).where(whereClause),
    ]);

    return { items, total: totalResult[0]?.count ?? 0 };
  });

  return result;
}

export async function updateProfile(params: UpdateProfileParams) {
  const { userId, tenantId, name, email, sourceIp } = params;

  const updateFields: Record<string, unknown> = {};
  if (name !== undefined) updateFields.name = name;
  if (email !== undefined) updateFields.email = email;

  if (Object.keys(updateFields).length === 0) {
    // Nothing to update, just return current user
    const [current] = await withTenantContext(tenantId, async (tx) => {
      return tx
        .select()
        .from(users)
        .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
    });
    if (!current) throw new Error("User not found");
    return current;
  }

  const [updated] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .update(users)
      .set(updateFields as any)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .returning();
  });

  if (!updated) {
    throw new Error("User not found");
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId: userId,
    eventType: "user.updated",
    resourceType: "user",
    resourceId: userId,
    details: { action: "update_profile", fields: Object.keys(updateFields) },
    sourceIp,
  });

  return updated;
}

export async function removeUser(params: RemoveUserParams) {
  const { userId, tenantId, actorId, sourceIp } = params;

  const [deleted] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .delete(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .returning();
  });

  if (!deleted) {
    throw new Error("User not found");
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "user.role_changed",
    resourceType: "user",
    resourceId: userId,
    details: { action: "remove", email: deleted.email },
    sourceIp,
  });

  return deleted;
}
