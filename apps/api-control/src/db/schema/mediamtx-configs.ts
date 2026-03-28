import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const mediamtxConfigs = pgTable("mediamtx_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  // The full MediaMTX global config snapshot
  config: jsonb("config").notNull().$type<Record<string, unknown>>(),
  // Version for optimistic concurrency
  version: integer("version").notNull().default(1),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediamtxConfigHistory = pgTable("mediamtx_config_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  configId: uuid("config_id")
    .notNull()
    .references(() => mediamtxConfigs.id),
  // Snapshot of what changed
  previousConfig: jsonb("previous_config").$type<Record<string, unknown>>(),
  newConfig: jsonb("new_config").notNull().$type<Record<string, unknown>>(),
  changedFields: jsonb("changed_fields").notNull().$type<string[]>(),
  changedBy: uuid("changed_by"),
  changeReason: varchar("change_reason", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
