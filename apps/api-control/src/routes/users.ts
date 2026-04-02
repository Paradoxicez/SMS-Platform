import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { requireRole } from "../middleware/rbac";
import { AppError } from "../middleware/error-handler";
import {
  inviteUser,
  changeRole,
  listUsers,
  removeUser,
  updateProfile,
} from "../services/users";
import { createNotification, notifyTenantUsers } from "../services/notifications";
import type { AppEnv } from "../types";

const usersRouter = new Hono<AppEnv>();

// GET /users/me — get current user's profile
usersRouter.get("/users/me", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const userId = c.get("userId") as string;
  const { withTenantContext } = await import("../db/client");
  const { users } = await import("../db/schema/users");
  const { eq, and } = await import("drizzle-orm");
  const [user] = await withTenantContext(tenantId, async (tx) => {
    return tx.select().from(users).where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  });
  if (!user) return c.json({ error: { code: "NOT_FOUND" } }, 404);

  // Don't expose sensitive fields
  const { passwordHash: _, totpSecret: __, ...safeUser } = user;
  return c.json({ data: safeUser });
});

// POST /users/me/change-password — change own password
usersRouter.post("/users/me/change-password", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const userId = c.get("userId") as string;
  const body = await c.req.json();
  const { current_password, new_password } = body as {
    current_password?: string;
    new_password?: string;
  };

  if (!current_password || !new_password) {
    throw new AppError("VALIDATION_ERROR", "current_password and new_password are required", 422);
  }

  if (new_password.length < 8) {
    throw new AppError("VALIDATION_ERROR", "Password must be at least 8 characters", 422);
  }

  const { withTenantContext } = await import("../db/client");
  const { users } = await import("../db/schema/users");
  const { eq, and } = await import("drizzle-orm");

  const [user] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  });

  if (!user?.passwordHash) {
    throw new AppError("NOT_FOUND", "User not found or has no password set", 404);
  }

  const valid = await bcrypt.compare(current_password, user.passwordHash);
  if (!valid) {
    throw new AppError("UNAUTHORIZED", "Current password is incorrect", 401);
  }

  const newHash = await bcrypt.hash(new_password, 12);

  await withTenantContext(tenantId, async (tx) => {
    await tx.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
  });

  return c.json({ data: { changed: true } });
});

// DELETE /users/me — delete own account
usersRouter.delete("/users/me", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const userId = c.get("userId") as string;
  const body = await c.req.json();
  const { confirmation_email } = body as { confirmation_email?: string };

  const { withTenantContext } = await import("../db/client");
  const { users } = await import("../db/schema/users");
  const { eq, and } = await import("drizzle-orm");

  const [user] = await withTenantContext(tenantId, async (tx) => {
    return tx.select().from(users).where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  });
  if (!user) return c.json({ error: { code: "NOT_FOUND" } }, 404);
  if (confirmation_email !== user.email) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Email does not match" } }, 422);
  }

  await withTenantContext(tenantId, async (tx) => {
    await tx.delete(users).where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  });

  return c.json({ data: { deleted: true } });
});

// PATCH /users/me — update current user's own profile
usersRouter.patch("/users/me", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { name, email, timezone, date_format, time_format } = body as {
    name?: string;
    email?: string;
    timezone?: string;
    date_format?: string;
    time_format?: string;
  };

  if (!name && !email && !timezone && !date_format && !time_format) {
    throw new AppError("VALIDATION_ERROR", "At least one field is required", 422);
  }

  try {
    const user = await updateProfile({
      userId,
      tenantId,
      name,
      email,
      timezone,
      dateFormat: date_format,
      timeFormat: time_format,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({ data: user });
  } catch {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }
});

// POST /users/create — create user directly (admin only)
usersRouter.post("/users/create", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const actorId = c.get("userId") as string;
  const body = await c.req.json();
  const { email, name, role, password } = body as {
    email: string;
    name: string;
    role: string;
    password?: string;
  };
  if (!email || !name || !role) {
    throw new AppError("VALIDATION_ERROR", "email, name, and role are required", 422);
  }
  if (!password || password.length < 8) {
    throw new AppError("VALIDATION_ERROR", "Password is required and must be at least 8 characters", 422);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Create user in DB with password hash
  const user = await inviteUser({
    tenantId,
    email,
    name,
    role: role as any,
    actorId,
    sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
  });

  // Update the password hash
  const { withTenantContext } = await import("../db/client");
  const { users } = await import("../db/schema/users");
  const { eq } = await import("drizzle-orm");
  await withTenantContext(tenantId, async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  });

  notifyTenantUsers(tenantId, {
    type: "user.created",
    title: "New user added",
    message: `${email} was added as ${role}.`,
    link: "/settings/users",
    roles: ["admin"],
  });

  return c.json({ data: user }, 201);
});

// POST /users — invite user (admin only)
usersRouter.post("/users", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const actorId = c.get("userId") as string;
  const body = await c.req.json();

  const { email, name, role } = body as {
    email: string;
    name: string;
    role: "admin" | "operator" | "developer" | "viewer";
  };

  if (!email || !name || !role) {
    throw new AppError("VALIDATION_ERROR", "email, name, and role are required", 422);
  }

  const user = await inviteUser({
    tenantId,
    email,
    name,
    role,
    actorId,
    sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
  });

  return c.json({ data: user }, 201);
});

// GET /users — list users (admin)
usersRouter.get("/users", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const perPage = parseInt(c.req.query("per_page") ?? "20", 10);

  const result = await listUsers({ tenantId, page, perPage });

  return c.json({
    data: result.items,
    pagination: {
      page,
      per_page: perPage,
      total: result.total,
      total_pages: Math.ceil(result.total / perPage),
    },
  });
});

// PATCH /users/:id/role — change role (admin) with last-admin guard
usersRouter.patch("/users/:id/role", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const actorId = c.get("userId") as string;
  const userId = c.req.param("id");
  const body = await c.req.json();

  const { role } = body as { role: "admin" | "operator" | "developer" | "viewer" };

  if (!role) {
    throw new AppError("VALIDATION_ERROR", "role is required", 422);
  }

  if (role !== "admin") {
    const { withTenantContext } = await import("../db/client");
    const { users } = await import("../db/schema/users");
    const { eq, and, count } = await import("drizzle-orm");
    const [adminCount] = await withTenantContext(tenantId, async (tx) => {
      return tx.select({ value: count() }).from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")));
    });
    if ((adminCount?.value ?? 0) <= 1) {
      const [targetUser] = await withTenantContext(tenantId, async (tx) => {
        return tx.select({ role: users.role }).from(users).where(eq(users.id, userId));
      });
      if (targetUser?.role === "admin") {
        throw new AppError("VALIDATION_ERROR", "Cannot demote the last admin", 422);
      }
    }
  }

  try {
    const user = await changeRole({
      userId,
      newRole: role,
      actorId,
      tenantId,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });
    createNotification({
      userId,
      tenantId,
      type: "user.role_changed",
      title: "Your role was changed",
      message: `Your role has been changed to ${role}.`,
      link: "/profile",
    }).catch(() => {});
    return c.json({ data: user });
  } catch {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }
});

// DELETE /users/:id — remove user (admin)
usersRouter.delete("/users/:id", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const actorId = c.get("userId") as string;
  const userId = c.req.param("id");

  if (userId === actorId) {
    throw new AppError("VALIDATION_ERROR", "Cannot delete your own account from here", 422);
  }

  try {
    const user = await removeUser({
      userId,
      tenantId,
      actorId,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });
    return c.json({ data: { id: user.id } });
  } catch {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }
});

// DELETE /users/invitations/:id — cancel pending invitation (admin)
usersRouter.delete("/users/invitations/:id", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const invitationId = c.req.param("id");
  const { db: rawDb } = await import("../db/client");
  const { invitations } = await import("../db/schema");
  const { eq, and } = await import("drizzle-orm");
  const [deleted] = await rawDb
    .delete(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.tenantId, tenantId)))
    .returning();
  if (!deleted) throw new AppError("NOT_FOUND", "Invitation not found", 404);
  return c.json({ data: { id: invitationId, deleted: true } });
});

// POST /users/invitations/:id/resend — resend invitation email (admin)
usersRouter.post("/users/invitations/:id/resend", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const invitationId = c.req.param("id");
  const { db: rawDb } = await import("../db/client");
  const { invitations } = await import("../db/schema");
  const { eq, and } = await import("drizzle-orm");
  const [inv] = await rawDb
    .select()
    .from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.tenantId, tenantId)));
  if (!inv) throw new AppError("NOT_FOUND", "Invitation not found", 404);
  console.log(JSON.stringify({ level: "info", service: "users", message: "Invitation resend requested", email: inv.email }));
  return c.json({ data: { id: invitationId, resent: true } });
});

export { usersRouter };
