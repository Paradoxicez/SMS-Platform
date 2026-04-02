ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255);
ALTER TABLE "users" ADD COLUMN "totp_secret" varchar(255);
