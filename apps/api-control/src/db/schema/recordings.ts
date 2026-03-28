import {
  pgTable,
  uuid,
  text,
  varchar,
  bigint,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { cameras } from "./cameras";

export const recordings = pgTable("recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  cameraId: uuid("camera_id")
    .notNull()
    .references(() => cameras.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  filePath: text("file_path").notNull(),
  fileFormat: varchar("file_format", { length: 10 }).notNull().default("fmp4"),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
  retentionDays: integer("retention_days").notNull().default(30),
  storageType: varchar("storage_type", { length: 20 }).notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();
