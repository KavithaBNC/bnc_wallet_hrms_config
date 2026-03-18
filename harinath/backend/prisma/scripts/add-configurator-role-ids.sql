-- Add configurator_role_ids to users table (stores Config role IDs for module fetch)
-- Run: psql $DATABASE_URL -f prisma/scripts/add-configurator-role-ids.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS configurator_role_ids integer[] DEFAULT '{}';
