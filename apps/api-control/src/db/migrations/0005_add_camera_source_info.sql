ALTER TABLE "cameras" ADD COLUMN IF NOT EXISTS "source_codec" varchar(32);
ALTER TABLE "cameras" ADD COLUMN IF NOT EXISTS "source_resolution" varchar(32);
ALTER TABLE "cameras" ADD COLUMN IF NOT EXISTS "source_fps" integer;
ALTER TABLE "cameras" ADD COLUMN IF NOT EXISTS "source_audio" varchar(32);
