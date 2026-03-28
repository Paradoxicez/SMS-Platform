import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema/users";
import { tenants } from "../db/schema/tenants";
import { apiClients } from "../db/schema/api-clients";

/**
 * T045: Keycloak OIDC auth middleware
 *
 * Validates Bearer token from Authorization header.
 * For MVP: decode JWT (no signature verification), extract sub/email/realm_access,
 * look up user by keycloak_sub in users table.
 * Sets context variables: userId, tenantId, userRole, userEmail.
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const apiKeyHeader = c.req.header("X-API-Key");

  // Try API Key auth first (for embeds and SDK usage)
  if (apiKeyHeader) {
    try {
      const crypto = await import("node:crypto");
      const keyHash = crypto.createHash("sha256").update(apiKeyHeader).digest("hex");

      const apiClient = await db.query.apiClients.findFirst({
        where: and(
          eq(apiClients.keyHash, keyHash),
          sql`${apiClients.revokedAt} IS NULL`,
        ),
      });

      if (apiClient) {
        // Reject disabled keys
        if (apiClient.disabledAt) {
          return c.json(
            {
              error: {
                code: "FORBIDDEN",
                message: "API key is disabled",
              },
            },
            403,
          );
        }

        // Look up the associated user for role info
        const user = await db.query.users.findFirst({
          where: eq(users.id, apiClient.userId),
        });

        if (user) {
          c.set("userId", user.id);
          c.set("tenantId", user.tenantId);
          c.set("userRole", user.role);
          c.set("userEmail", user.email);
          c.set("apiClientId", apiClient.id);

          // Update last used
          db.update(apiClients)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiClients.id, apiClient.id))
            .catch(() => {});

          await next();
          return;
        }
      }
    } catch {
      // API key auth failed — fall through to Bearer token
    }
  }

  // Fallback: accept token from query param (needed for SSE/EventSource which can't set headers)
  const queryToken = new URL(c.req.url).searchParams.get("token");

  if (!authHeader?.startsWith("Bearer ") && !queryToken) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid Authorization header",
        },
      },
      401,
    );
  }

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : queryToken!;

  try {
    // MVP: Decode JWT without signature verification.
    // In production, validate the token signature against the Keycloak JWKS endpoint.
    const parts = token.split(".");
    if (parts.length !== 3) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Malformed JWT token",
          },
        },
        401,
      );
    }

    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf-8"),
    );

    const keycloakSub: string | undefined = payload.sub;
    const email: string | undefined = payload.email;

    if (!keycloakSub) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Token missing subject claim",
          },
        },
        401,
      );
    }

    // Look up user by keycloak_sub
    let user = await db.query.users.findFirst({
      where: eq(users.keycloakSub, keycloakSub),
    });

    // Auto-provision user from JWT claims if not found (dev convenience)
    if (!user) {
      try {
        // Find or create default tenant
        let tenant = await db.query.tenants.findFirst();
        if (!tenant) {
          const [created] = await db
            .insert(tenants)
            .values({
              name: "Default Tenant",
              slug: "default",
              billingEmail: email ?? "admin@example.com",
            })
            .returning();
          tenant = created;
        }

        // Determine role from JWT realm_access
        const jwtRoles: string[] = payload.realm_access?.roles ?? [];
        const role = jwtRoles.find(
          (r: string) => r === "admin" || r === "operator" || r === "developer" || r === "viewer",
        ) ?? "admin";

        const [created] = await db
          .insert(users)
          .values({
            tenantId: tenant!.id,
            email: email ?? `${keycloakSub}@keycloak`,
            name: payload.name ?? payload.preferred_username ?? "User",
            keycloakSub,
            role: role as "admin" | "operator" | "developer" | "viewer",
          })
          .returning();
        user = created;
        console.log(`Auto-provisioned user ${user!.email} (${user!.role}) for tenant ${tenant!.slug}`);
      } catch (provisionErr) {
        console.error("Failed to auto-provision user:", provisionErr);
        return c.json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "User not found and auto-provision failed",
            },
          },
          401,
        );
      }
    }

    // Set context variables for downstream middleware and handlers
    c.set("userId", user!.id);
    c.set("tenantId", user!.tenantId);
    c.set("userRole", user!.role);
    c.set("userEmail", user!.email);

    await next();
  } catch {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid token",
        },
      },
      401,
    );
  }
});
