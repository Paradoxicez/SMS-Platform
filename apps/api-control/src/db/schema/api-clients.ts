import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { projects } from "./projects";
import { sites } from "./sites";

export const apiClients = pgTable("api_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  projectId: uuid("project_id").references(() => projects.id),
  siteId: uuid("site_id").references(() => sites.id),
  keyPrefix: varchar("key_prefix", { length: 8 }).notNull(),
  keyHash: varchar("key_hash", { length: 128 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  rateLimitOverride: integer("rate_limit_override"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();
