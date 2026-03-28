import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const actorTypeEnum = pgEnum("actor_type", [
  "user",
  "api_client",
  "system",
]);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    eventType: varchar("event_type", { length: 63 }).notNull(),
    resourceType: varchar("resource_type", { length: 63 }),
    resourceId: uuid("resource_id"),
    details: jsonb("details"),
    sourceIp: varchar("source_ip", { length: 45 }),
  },
  (table) => [
    index("audit_events_tenant_id_timestamp_idx").on(
      table.tenantId,
      table.timestamp,
    ),
    index("audit_events_tenant_id_event_type_idx").on(
      table.tenantId,
      table.eventType,
    ),
  ],
).enableRLS();
