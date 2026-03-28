import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import { AppError } from "../middleware/error-handler";
import {
  inviteUser,
  changeRole,
  listUsers,
  removeUser,
  updateProfile,
} from "../services/users";

const usersRouter = new Hono();

// PATCH /users/me — update current user's own profile (any authenticated user)
usersRouter.patch("/users/me", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { name, email } = body as { name?: string; email?: string };

  if (!name && !email) {
    throw new AppError("VALIDATION_ERROR", "At least one of name or email is required", 422);
  }

  try {
    const user = await updateProfile({
      userId,
      tenantId,
      name,
      email,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: user,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }
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

  return c.json(
    {
      data: user,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    201,
  );
});

// GET /users — list users (admin)
usersRouter.get("/users", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const perPage = parseInt(c.req.query("per_page") ?? "20", 10);

  const result = await listUsers({ tenantId, page, perPage });

  return c.json({
    data: result.items,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
    pagination: {
      page,
      per_page: perPage,
      total: result.total,
      total_pages: Math.ceil(result.total / perPage),
    },
  });
});

// PATCH /users/:id/role — change role (admin)
usersRouter.patch("/users/:id/role", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const actorId = c.get("userId") as string;
  const userId = c.req.param("id");
  const body = await c.req.json();

  const { role } = body as { role: "admin" | "operator" | "developer" | "viewer" };

  if (!role) {
    throw new AppError("VALIDATION_ERROR", "role is required", 422);
  }

  try {
    const user = await changeRole({
      userId,
      newRole: role,
      actorId,
      tenantId,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: user,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }
});

// DELETE /users/:id — remove user (admin)
usersRouter.delete("/users/:id", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const actorId = c.get("userId") as string;
  const userId = c.req.param("id");

  try {
    const user = await removeUser({
      userId,
      tenantId,
      actorId,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: { id: user.id },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }
});

export { usersRouter };
