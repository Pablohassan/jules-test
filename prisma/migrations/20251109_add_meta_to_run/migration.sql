-- Add optional JSONB column `meta` on Run to match current schema
ALTER TABLE "Run" ADD COLUMN IF NOT EXISTS "meta" JSONB;

