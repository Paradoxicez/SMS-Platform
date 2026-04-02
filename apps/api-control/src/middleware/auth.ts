import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";
import type { AppEnv } from "../types";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema/users";
import { apiClients } from "../db/schema/api-clients";
import { JWT_SECRET, JWT_ISSUER } from "../routes/auth";

/**
 * Auth middleware — verifies self-issued JWT (HS256) or API key.
 * Sets context: userId, tenantId, userRole, userEmail.
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const apiKeyHeader = c.req.header("X-API-Key");

  // ── API Key auth (for embeds and SDK usage) ───────────────
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
        if (apiClient.disabledAt) {
          return c.json({ error: { code: "FORBIDDEN", message: "API key is disabled" } }, 403);
        }

        const user = await db.query.users.findFirst({
          where: eq(users.id, apiClient.userId),
        });

        if (user) {
          c.set("userId", user.id);
          c.set("tenantId", user.tenantId);
          c.set("userRole", user.role);
          c.set("userEmail", user.email);
          c.set("apiClientId", apiClient.id);

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

  // ── Bearer token (JWT) ────────────────────────────────────
  // Also accept token from query param for SSE/EventSource
  const queryToken = new URL(c.req.url).searchParams.get("token");

  if (!authHeader?.startsWith("Bearer ") && !queryToken) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" } },
      401,
    );
  }

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : queryToken!;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
    });

    const userId = payload.sub;
    if (!userId) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Token missing subject" } },
        401,
      );
    }

    // Look up user by ID from JWT
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "User not found" } },
        401,
      );
    }

    c.set("userId", user.id);
    c.set("tenantId", user.tenantId);
    c.set("userRole", user.role);
    c.set("userEmail", user.email);

    await next();
  } catch {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
      401,
    );
  }
});
