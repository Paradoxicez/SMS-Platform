ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "default_policy_id" uuid REFERENCES "policies"("id");
