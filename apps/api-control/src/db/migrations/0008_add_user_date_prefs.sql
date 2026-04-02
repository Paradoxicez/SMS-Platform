-- Add date_format and time_format preference columns to users table
ALTER TABLE "users" ADD COLUMN "date_format" varchar(20) DEFAULT 'YYYY-MM-DD';
ALTER TABLE "users" ADD COLUMN "time_format" varchar(10) DEFAULT '24h';
