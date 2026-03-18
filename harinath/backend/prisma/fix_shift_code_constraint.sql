-- Fix shift code uniqueness: allow same code per organization
-- Run this manually if prisma migrate deploy is blocked by failed migrations
--
-- Usage: psql -h <host> -U <user> -d hrms_db -f fix_shift_code_constraint.sql
-- Or run directly in your DB client (pgAdmin, DBeaver, etc.)

-- 1. Drop the old global unique constraint on code (if it exists)
ALTER TABLE "shifts" DROP CONSTRAINT IF EXISTS "shifts_code_key";

-- 2. Add composite unique: (organization_id, code) - allows same code in different orgs
CREATE UNIQUE INDEX IF NOT EXISTS "shifts_organization_id_code_key"
  ON "shifts"("organization_id", "code");
