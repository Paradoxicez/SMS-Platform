import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { cameras } from "./cameras";
import { apiClients } from "./api-clients";

export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "expired",
  "revoked",
]);

export const playbackSessions = pgTable(
  "playback_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cameraId: uuid("camera_id")
      .notNull()
      .references(() => cameras.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    apiClientId: uuid("api_client_id")
      .notNull()
      .references(() => apiClients.id),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    allowedOrigins: text("allowed_origins").array(),
    viewerIp: varchar("viewer_ip", { length: 45 }),
    status: sessionStatusEnum("status").notNull().default("active"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("playback_sessions_camera_id_status_idx").on(
      table.cameraId,
      table.status,
    ),
    index("playback_sessions_tenant_id_issued_at_idx").on(
      table.tenantId,
      table.issuedAt,
    ),
  ],
).enableRLS();
