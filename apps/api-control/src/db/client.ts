import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:postgres@localhost:5432/sms_app";

const queryClient = postgres(DATABASE_URL);

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;

/**
 * Executes a callback within a transaction that has `app.tenant_id` set
 * via `SET LOCAL`, so that RLS policies can reference
 * `current_setting('app.tenant_id')`.
 *
 * `SET LOCAL` is scoped to the transaction and automatically reverted on
 * commit / rollback.
 */
export async function withTenantContext<T>(
  tenantId: string,
  callback: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // SET LOCAL doesn't support parameterized values — use sql.raw
    // tenantId is a UUID validated by auth middleware, safe to interpolate
    await tx.execute(
      sql.raw(`SET LOCAL app.tenant_id = '${tenantId}'`),
    );
    return callback(tx as unknown as Database);
  });
}
