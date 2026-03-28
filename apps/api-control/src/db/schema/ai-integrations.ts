import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  boolean,
  integer,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const aiIntegrations = pgTable("ai_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  apiKeyEncrypted: text("api_key_encrypted"),
  eventTypes: jsonb("event_types").notNull().$type<string[]>(),
  cameras: jsonb("cameras").notNull().$type<string[]>(),
  intervalSeconds: integer("interval_seconds").notNull().default(30),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const aiEvents = pgTable("ai_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  integrationId: uuid("integration_id")
    .notNull()
    .references(() => aiIntegrations.id, { onDelete: "cascade" }),
  cameraId: uuid("camera_id").notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  confidence: doublePrecision("confidence"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();
