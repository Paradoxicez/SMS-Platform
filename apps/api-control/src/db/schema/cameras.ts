import {
  pgTable,
  uuid,
  varchar,
  text,
  doublePrecision,
  jsonb,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { sites } from "./sites";
import { policies } from "./policies";
import { streamProfiles } from "./stream-profiles";

export const healthStatusEnum = pgEnum("health_status", [
  "connecting",
  "online",
  "degraded",
  "offline",
  "reconnecting",
  "stopping",
  "stopped",
]);

export const cameras = pgTable("cameras", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  rtspUrl: text("rtsp_url").notNull(),
  credentialsEncrypted: text("credentials_encrypted"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  tags: jsonb("tags").notNull().default([]),
  mapVisible: boolean("map_visible").notNull().default(false),
  healthStatus: healthStatusEnum("health_status").notNull().default("stopped"),
  policyId: uuid("policy_id").references(() => policies.id),
  profileId: uuid("profile_id").references(() => streamProfiles.id),
  thumbnailUrl: text("thumbnail_url"),
  thumbnailUpdatedAt: timestamp("thumbnail_updated_at", {
    withTimezone: true,
  }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  version: integer("version").notNull().default(1),
}).enableRLS();
