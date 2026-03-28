import {
  pgTable,
  uuid,
  text,
  varchar,
  bigint,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { cameras } from "./cameras";

export const recordings = pgTable(
  "recordings",
  {
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
    // S3 metadata (null for local storage)
    s3Bucket: varchar("s3_bucket", { length: 255 }),
    s3Key: varchar("s3_key", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("recordings_camera_start_idx").on(table.cameraId, table.startTime),
    index("recordings_tenant_idx").on(table.tenantId),
    uniqueIndex("recordings_file_path_idx").on(table.filePath),
  ],
).enableRLS();
