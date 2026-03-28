import {
  pgTable,
  uuid,
  varchar,
  text,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { projects } from "./projects";
import { streamProfiles } from "./stream-profiles";

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  timezone: varchar("timezone", { length: 63 }).notNull().default("UTC"),
  defaultProfileId: uuid("default_profile_id").references(
    () => streamProfiles.id,
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();
