import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { cameras } from "./cameras";

export const forwardingRules = pgTable("forwarding_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  cameraId: uuid("camera_id")
    .notNull()
    .references(() => cameras.id),
  cameraName: varchar("camera_name", { length: 255 }),
  targetUrl: text("target_url").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
