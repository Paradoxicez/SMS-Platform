import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import { AppError } from "../middleware/error-handler";
import {
  inviteUser,
  validateToken,
  acceptInvitation,
  listPendingInvitations,
} from "../services/invitations";

const invitationsRouter = new Hono();

// POST /users/invite — create invitation (admin only, auth required)
invitationsRouter.post("/users/invite", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const actorId = c.get("userId") as string;
  const body = await c.req.json();

  const { email, role } = body as {
    email: string;
    role: "admin" | "operator" | "developer" | "viewer";
  };

  if (!email || !role) {
    throw new AppError("VALIDATION_ERROR", "email and role are required", 422);
  }

  const invitation = await inviteUser({
    tenantId,
    email,
    role,
    invitedBy: actorId,
    sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
  });

  return c.json(
    {
      data: invitation,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    201,
  );
});

// GET /users/invitations — list pending invitations (admin only)
invitationsRouter.get(
  "/users/invitations",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;

    const items = await listPendingInvitations(tenantId);

    return c.json({
      data: items,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

export { invitationsRouter };

// Public invitation routes (no auth required)
const publicInvitationsRouter = new Hono();

// GET /invitations/:token — validate invitation token (public)
publicInvitationsRouter.get("/invitations/:token", async (c) => {
  const token = c.req.param("token");

  try {
    const info = await validateToken(token);
    return c.json({
      data: info,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message } }, err.statusCode as any);
    }
    throw err;
  }
});

// POST /invitations/:token/accept — accept invitation (public)
publicInvitationsRouter.post("/invitations/:token/accept", async (c) => {
  const token = c.req.param("token");
  const body = await c.req.json();

  const { name, password } = body as { name: string; password: string };

  if (!name || !password) {
    throw new AppError(
      "VALIDATION_ERROR",
      "name and password are required",
      422,
    );
  }

  try {
    const user = await acceptInvitation({ token, name, password });
    return c.json({
      data: { id: user.id, email: user.email },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message } }, err.statusCode as any);
    }
    throw err;
  }
});

export { publicInvitationsRouter };
