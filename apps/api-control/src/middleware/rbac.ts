import { createMiddleware } from "hono/factory";
import { logAuditEvent } from "../services/audit";

/**
 * T047: Role-based access control middleware factory
 *
 * Returns middleware that checks if the current user's role (from context)
 * is in the list of allowed roles. Returns 403 if not authorized.
 */
export function requireRole(...roles: string[]) {
  return createMiddleware(async (c, next) => {
    const userRole = c.get("userRole") as string | undefined;

    if (!userRole || !roles.includes(userRole)) {
      // Log denied access as an audit event (fire and forget)
      const tenantId = c.get("tenantId") as string | undefined;
      const userId = c.get("userId") as string | undefined;

      if (tenantId) {
        logAuditEvent({
          tenantId,
          actorType: "user",
          actorId: userId,
          eventType: "auth.access_denied",
          details: {
            requiredRoles: roles,
            actualRole: userRole ?? null,
            path: c.req.path,
            method: c.req.method,
          },
          sourceIp:
            c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
        });
      }

      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Insufficient permissions",
          },
        },
        403,
      );
    }

    await next();
  });
}
