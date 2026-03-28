import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const licenses = pgTable("licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  licenseKey: text("license_key").notNull(),
  licenseId: varchar("license_id", { length: 50 }).notNull(),
  plan: varchar("plan", { length: 20 }).notNull(),
  limits: jsonb("limits").notNull(),
  addons: jsonb("addons").notNull().default([]),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedReason: varchar("revoked_reason", { length: 255 }),
}).enableRLS();
