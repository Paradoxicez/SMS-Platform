import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const outputProtocolEnum = pgEnum("output_protocol", [
  "hls",
  "webrtc",
  "both",
]);

export const audioModeEnum = pgEnum("audio_mode", [
  "include",
  "strip",
  "mute",
]);

export const outputResolutionEnum = pgEnum("output_resolution", [
  "original",
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "480p",
  "360p",
  "240p",
]);

export const outputCodecEnum = pgEnum("output_codec", [
  "h264",
  "passthrough",
  "copy",
]);

export const streamProfiles = pgTable("stream_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  outputProtocol: outputProtocolEnum("output_protocol")
    .notNull()
    .default("hls"),
  audioMode: audioModeEnum("audio_mode").notNull().default("include"),
  maxFramerate: integer("max_framerate").notNull().default(0),
  outputResolution: outputResolutionEnum("output_resolution")
    .notNull()
    .default("original"),
  outputCodec: outputCodecEnum("output_codec").notNull().default("h264"),
  keyframeInterval: integer("keyframe_interval").notNull().default(2),
  isDefault: boolean("is_default").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();
