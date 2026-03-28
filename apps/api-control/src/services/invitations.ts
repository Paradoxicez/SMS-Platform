import { randomBytes } from "crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db, withTenantContext } from "../db/client";
import { invitations } from "../db/schema/invitations";
import { users } from "../db/schema/users";
import { tenants } from "../db/schema/tenants";
import { logAuditEvent } from "./audit";
import { AppError } from "../middleware/error-handler";

interface InviteUserParams {
  tenantId: string;
  email: string;
  role: "admin" | "operator" | "developer" | "viewer";
  invitedBy: string;
  sourceIp?: string;
}

export async function inviteUser(params: InviteUserParams) {
  const { tenantId, email, role, invitedBy, sourceIp } = params;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  const [invitation] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(invitations)
      .values({
        tenantId,
        email,
        role,
        token,
        invitedBy,
        expiresAt,
      })
      .returning();
  });

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId: invitedBy,
    eventType: "invitation.created",
    resourceType: "invitation",
    resourceId: invitation!.id,
    details: { email, role },
    sourceIp,
  });

  return invitation!;
}

export async function validateToken(token: string) {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });

  if (!invitation) {
    throw new AppError("NOT_FOUND", "Invitation not found", 404);
  }

  if (invitation.acceptedAt) {
    throw new AppError("CONFLICT", "Invitation has already been accepted", 409);
  }

  if (new Date() > invitation.expiresAt) {
    throw new AppError("GONE", "Invitation has expired", 410);
  }

  // Fetch tenant name for display
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, invitation.tenantId),
    columns: { name: true },
  });

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    tenantName: tenant?.name ?? "Unknown",
    expiresAt: invitation.expiresAt,
  };
}

interface AcceptInvitationParams {
  token: string;
  name: string;
  password: string;
}

export async function acceptInvitation(params: AcceptInvitationParams) {
  const { token, name, password: _password } = params;

  // Validate first
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });

  if (!invitation) {
    throw new AppError("NOT_FOUND", "Invitation not found", 404);
  }

  if (invitation.acceptedAt) {
    throw new AppError("CONFLICT", "Invitation has already been accepted", 409);
  }

  if (new Date() > invitation.expiresAt) {
    throw new AppError("GONE", "Invitation has expired", 410);
  }

  // Create user in DB
  const [user] = await withTenantContext(invitation.tenantId, async (tx) => {
    return tx
      .insert(users)
      .values({
        tenantId: invitation.tenantId,
        email: invitation.email,
        name,
        role: invitation.role,
        // In production: also create user in Keycloak with password
      })
      .returning();
  });

  // Mark invitation as accepted
  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  logAuditEvent({
    tenantId: invitation.tenantId,
    actorType: "system",
    eventType: "invitation.accepted",
    resourceType: "invitation",
    resourceId: invitation.id,
    details: { email: invitation.email, userId: user!.id },
  });

  return user!;
}

export async function listPendingInvitations(tenantId: string) {
  const items = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.tenantId, tenantId),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .orderBy(invitations.createdAt);
  });

  return items;
}
