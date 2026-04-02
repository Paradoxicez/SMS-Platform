/**
 * Standalone migration runner — reads SQL files from migrations/ and applies them.
 * Uses drizzle-orm/postgres-js migrate() so it tracks applied migrations.
 *
 * Usage: node dist/migrate.js
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:postgres@localhost:5432/sms_app";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Running migrations...");

  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  // migrations folder is copied alongside dist/
  const migrationsFolder = path.resolve(__dirname, "migrations");

  await migrate(db, { migrationsFolder });

  console.log("Migrations completed successfully.");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
