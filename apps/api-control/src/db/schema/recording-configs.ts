import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * Scope-based recording configuration.
 * Inheritance: Global → Site → Project → Camera (closest scope wins).
 */
export const recordingConfigs = pgTable(
  "recording_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Scope: "global" | "site" | "project" | "camera"
    scopeType: varchar("scope_type", { length: 20 }).notNull(),
    // For global: null. For site/project/camera: the entity UUID.
    scopeId: uuid("scope_id"),

    // Recording mode: "continuous" | "scheduled"
    mode: varchar("mode", { length: 20 }).notNull().default("continuous"),

    // Schedule (only if mode=scheduled): JSON array of time windows
    // e.g. [{"days":["mon","tue"],"from":"18:00","to":"06:00"}]
    schedule: jsonb("schedule"),

    // Retention
    retentionDays: integer("retention_days").notNull().default(30),
    autoPurge: boolean("auto_purge").notNull().default(true),

    // Storage
    storageType: varchar("storage_type", { length: 20 }).notNull().default("local"),
    storagePath: varchar("storage_path", { length: 500 }),
    s3Config: jsonb("s3_config"), // { bucket, region, accessKey, secretKey }

    // Quality
    format: varchar("format", { length: 10 }).notNull().default("fmp4"),
    resolution: varchar("resolution", { length: 10 }).notNull().default("original"),
    maxSegmentSizeMb: integer("max_segment_size_mb").notNull().default(1024),
    segmentDurationMinutes: integer("segment_duration_minutes").notNull().default(60),

    // Recording enabled (for camera scope: toggle on/off)
    enabled: boolean("enabled").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("recording_configs_scope_idx").on(
      table.tenantId,
      table.scopeType,
      table.scopeId,
    ),
  ],
).enableRLS();
