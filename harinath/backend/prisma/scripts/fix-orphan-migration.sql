-- Remove orphan migration record: the DB references a migration that no longer exists in the repo.
-- Run this against your database (e.g. RDS Query Editor), then run: npx prisma migrate deploy

DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260209132441_add_excess_hours_tables';
