import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { cameras } from "./cameras";

export const streams = pgTable("streams", {
  id: uuid("id").primaryKey().defaultRandom(),
  cameraId: uuid("camera_id")
    .notNull()
    .unique()
    .references(() => cameras.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  ingestNodeId: varchar("ingest_node_id", { length: 63 }).notNull(),
  codec: varchar("codec", { length: 16 }),
  resolution: varchar("resolution", { length: 16 }),
  bitrateKbps: integer("bitrate_kbps"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSegmentAt: timestamp("last_segment_at", { withTimezone: true }),
}).enableRLS();
