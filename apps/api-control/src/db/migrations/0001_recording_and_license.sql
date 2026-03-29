-- Migration 0001: Add licenses, recording_configs tables + new columns
-- Run after 0000_strong_forgotten_one.sql

-- ============================================================
-- 1. NEW TABLE: licenses
-- ============================================================
CREATE TABLE IF NOT EXISTS "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"license_key" text NOT NULL,
	"license_id" varchar(50) NOT NULL,
	"plan" varchar(20) NOT NULL,
	"limits" jsonb NOT NULL,
	"addons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "licenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "licenses" ADD CONSTRAINT "licenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. NEW TABLE: recording_configs
-- ============================================================
CREATE TABLE IF NOT EXISTS "recording_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"scope_type" varchar(20) NOT NULL,
	"scope_id" uuid,
	"mode" varchar(20) DEFAULT 'continuous' NOT NULL,
	"schedule" jsonb,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"auto_purge" boolean DEFAULT true NOT NULL,
	"storage_type" varchar(20) DEFAULT 'local' NOT NULL,
	"storage_path" varchar(500),
	"s3_config" jsonb,
	"format" varchar(10) DEFAULT 'fmp4' NOT NULL,
	"resolution" varchar(10) DEFAULT 'original' NOT NULL,
	"max_segment_size_mb" integer DEFAULT 1024 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recording_configs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recording_configs_scope_idx" ON "recording_configs" ("tenant_id", "scope_type", "scope_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recording_configs" ADD CONSTRAINT "recording_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 3. NEW COLUMNS: cameras
-- ============================================================
ALTER TABLE "cameras" ADD COLUMN IF NOT EXISTS "recording_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "cameras" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;

-- ============================================================
-- 4. NEW COLUMNS: recordings
-- ============================================================
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "s3_bucket" varchar(255);
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "s3_key" varchar(1000);

-- ============================================================
-- 5. NEW INDEXES: recordings
-- ============================================================
CREATE INDEX IF NOT EXISTS "recordings_camera_start_idx" ON "recordings" ("camera_id", "start_time");
CREATE INDEX IF NOT EXISTS "recordings_tenant_idx" ON "recordings" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recordings_file_path_idx" ON "recordings" ("file_path");

-- ============================================================
-- 6. MIGRATE DATA: recording tag → column
-- ============================================================
UPDATE "cameras" SET "recording_enabled" = true WHERE "tags"::text LIKE '%__recording_enabled%';
-- Clean up the tag
UPDATE "cameras" SET "tags" = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements("tags") AS elem
  WHERE elem::text != '"__recording_enabled"'
) WHERE "tags"::text LIKE '%__recording_enabled%';
