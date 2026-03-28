import { createMiddleware } from "hono/factory";
import { sql } from "drizzle-orm";
import { db } from "../db/client";

/**
 * T048: RLS tenant context middleware
 *
 * After auth middleware has set tenantId on context, this middleware
 * executes `SET LOCAL app.tenant_id = 'uuid'` on the database connection
 * to enable PostgreSQL RLS policies.
 *
 * Note: SET LOCAL only works within a transaction. For request-scoped
 * tenant isolation, wrap your queries using `withTenantContext` from
 * the db client, or use this middleware to set up a transaction on
 * the context.
 */
export const tenantContextMiddleware = createMiddleware(async (c, next) => {
  const tenantId = c.get("tenantId") as string | undefined;

  if (!tenantId) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Tenant context not available",
        },
      },
      401,
    );
  }

  // Execute within a transaction so SET LOCAL is properly scoped.
  // Store the transaction on context for downstream handlers to use.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.tenant_id = ${tenantId}`);

    // Store the transaction-scoped db on context for downstream use
    c.set("tx", tx);

    await next();
  });
});
