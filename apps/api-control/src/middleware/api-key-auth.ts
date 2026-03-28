import { createMiddleware } from "hono/factory";
import crypto from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { apiClients } from "../db/schema/api-clients";
import { users } from "../db/schema/users";
import type { AppEnv } from "../types";

/**
 * T046: API key auth middleware
 *
 * Validates X-API-Key header.
 * Hash the provided key with SHA-256, look up by key_hash in api_clients table.
 * Check not revoked (revoked_at IS NULL).
 * Resolve user permissions from the associated user's role.
 * Sets context variables: apiClientId, userId, tenantId, userRole.
 * Updates last_used_at.
 */
export const apiKeyAuthMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing X-API-Key header",
        },
      },
      401,
    );
  }

  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  // Look up api client by key_hash where not revoked
  const client = await db.query.apiClients.findFirst({
    where: and(eq(apiClients.keyHash, keyHash), isNull(apiClients.revokedAt)),
  });

  if (!client) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or revoked API key",
        },
      },
      401,
    );
  }

  // Reject disabled keys
  if (client.disabledAt) {
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

  // Resolve the associated user's role
  const user = await db.query.users.findFirst({
    where: eq(users.id, client.userId),
  });

  if (!user) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "API key owner not found",
        },
      },
      401,
    );
  }

  // Set context variables
  c.set("apiClientId", client.id);
  c.set("userId", user.id);
  c.set("tenantId", client.tenantId);
  c.set("userRole", user.role);

  // Fire-and-forget: update last_used_at
  db.update(apiClients)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiClients.id, client.id))
    .execute()
    .catch(() => {
      // Silently ignore update failures — non-critical
    });

  await next();
});
