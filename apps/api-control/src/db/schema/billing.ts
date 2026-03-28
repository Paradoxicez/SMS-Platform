import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { subscriptionPlans } from "./subscription-plans";

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").references(() => subscriptionPlans.id),
  amountCents: integer("amount_cents").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("pending"), // pending, paid, failed, cancelled
  paymentMethod: varchar("payment_method", { length: 30 }), // stripe, manual, null
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 30 }).notNull(), // stripe, manual
  providerRef: varchar("provider_ref", { length: 255 }), // Stripe payment intent ID, etc.
  amountCents: integer("amount_cents").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("pending"), // pending, completed, failed
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();
