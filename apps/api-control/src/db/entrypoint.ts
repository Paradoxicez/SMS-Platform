/**
 * Docker entrypoint — runs migrations, seeds admin user, then starts the app.
 *
 * Environment variables:
 *   ADMIN_EMAIL    — admin email (default: none, skip seeding)
 *   ADMIN_PASSWORD — admin password (required if ADMIN_EMAIL is set)
 *   ADMIN_TENANT   — tenant name (default: "Default")
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:postgres@localhost:5432/sms_app";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function waitForDb(url: string, retries = 30): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const client = postgres(url, { max: 1, connect_timeout: 3 });
      await client`SELECT 1`;
      await client.end();
      return;
    } catch {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Database not reachable after retries");
}

async function runMigrations(): Promise<void> {
  console.log("[entrypoint] Running migrations...");
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  const migrationsFolder = path.resolve(__dirname, "migrations");
  await migrate(db, { migrationsFolder });
  await client.end();
  console.log("[entrypoint] Migrations completed.");
}

async function seedAdmin(): Promise<void> {
  const email = process.env["ADMIN_EMAIL"];
  const password = process.env["ADMIN_PASSWORD"];
  const tenantName = process.env["ADMIN_TENANT"] ?? "Default";

  if (!email || !password) {
    console.log("[entrypoint] No ADMIN_EMAIL set, skipping admin seed.");
    return;
  }

  console.log(`[entrypoint] Seeding admin user: ${email}`);
  const client = postgres(DATABASE_URL, { max: 1 });

  // Check if user already exists
  const existing = await client`SELECT id FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
  if (existing.length > 0) {
    console.log("[entrypoint] Admin user already exists, skipping.");
    await client.end();
    return;
  }

  // Create tenant
  const tenantId = crypto.randomUUID();
  const slug = tenantName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);

  await client`
    INSERT INTO tenants (id, name, slug, billing_email, subscription_tier, onboarding_completed)
    VALUES (${tenantId}, ${tenantName}, ${`${slug}-${crypto.randomBytes(3).toString("hex")}`}, ${email.toLowerCase()}, 'free', false)
  `;

  // Create admin user
  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);

  await client`
    INSERT INTO users (id, tenant_id, email, name, password_hash, role, mfa_enabled)
    VALUES (${userId}, ${tenantId}, ${email.toLowerCase()}, 'Admin', ${passwordHash}, 'admin', false)
  `;

  console.log(`[entrypoint] Admin user created: ${email}`);
  await client.end();
}

async function main() {
  await waitForDb(DATABASE_URL);
  await runMigrations();
  await seedAdmin();

  // Start the app
  console.log("[entrypoint] Starting api-control...");
  execSync("node dist/index.js", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}

main().catch((err) => {
  console.error("[entrypoint] Fatal error:", err);
  process.exit(1);
});
