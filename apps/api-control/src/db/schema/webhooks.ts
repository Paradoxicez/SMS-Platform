import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: jsonb("events").notNull().$type<string[]>(),
  secret: varchar("secret", { length: 64 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 100 }),
  payload: jsonb("payload"),
  responseStatus: integer("response_status"),
  attempt: integer("attempt").notNull().default(1),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
