import {
  pgTable,
  uuid,
  varchar,
  integer,
  bigint,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { subscriptionPlans } from "./subscription-plans";

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "starter",
  "pro",
  "enterprise",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 63 }).notNull().unique(),
  billingEmail: varchar("billing_email", { length: 255 }).notNull(),
  subscriptionTier: subscriptionTierEnum("subscription_tier")
    .notNull()
    .default("free"),
  subscriptionPlanId: uuid("subscription_plan_id").references(
    () => subscriptionPlans.id,
  ),
  planOverrides: jsonb("plan_overrides"), // custom enterprise limit overrides
  viewerHoursQuota: integer("viewer_hours_quota").notNull().default(1000),
  egressQuotaBytes: bigint("egress_quota_bytes", { mode: "number" })
    .notNull()
    .default(107374182400),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();
