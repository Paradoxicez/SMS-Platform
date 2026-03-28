import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  maxCameras: integer("max_cameras").notNull().default(5),
  maxProjects: integer("max_projects").notNull().default(1),
  maxUsers: integer("max_users").notNull().default(2),
  viewerHoursQuota: integer("viewer_hours_quota").notNull().default(100),
  auditRetentionDays: integer("audit_retention_days").notNull().default(7),
  features: jsonb("features")
    .notNull()
    .default(
      JSON.stringify({
        webrtc: false,
        embed: false,
        api_access: false,
        csv_import: false,
        webhooks: false,
        recording: false,
        sso: false,
      }),
    ),
  priceCents: integer("price_cents").notNull().default(0),
  billingInterval: varchar("billing_interval", { length: 20 }).default(
    "monthly",
  ),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();
