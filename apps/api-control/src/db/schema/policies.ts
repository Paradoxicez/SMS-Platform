import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  ttlMin: integer("ttl_min").notNull().default(60),
  ttlMax: integer("ttl_max").notNull().default(300),
  ttlDefault: integer("ttl_default").notNull().default(120),
  domainAllowlist: text("domain_allowlist").array(),
  rateLimitPerMin: integer("rate_limit_per_min").notNull().default(100),
  viewerConcurrencyLimit: integer("viewer_concurrency_limit")
    .notNull()
    .default(50),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  version: integer("version").notNull().default(1),
}).enableRLS();
