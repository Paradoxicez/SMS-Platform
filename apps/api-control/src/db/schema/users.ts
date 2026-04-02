import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "operator",
  "developer",
  "viewer",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    keycloakSub: varchar("keycloak_sub", { length: 255 }).unique(),
    role: userRoleEnum("role").notNull(),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    totpSecret: varchar("totp_secret", { length: 255 }),
    timezone: varchar("timezone", { length: 100 }).default("Asia/Bangkok"),
    dateFormat: varchar("date_format", { length: 20 }).default("YYYY-MM-DD"),
    timeFormat: varchar("time_format", { length: 10 }).default("24h"),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("users_tenant_id_email_unique").on(table.tenantId, table.email),
  ],
).enableRLS();
