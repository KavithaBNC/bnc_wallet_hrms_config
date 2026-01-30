-- Create employee_change_requests table and enum for Employee Master Approval
-- Run this if the table does not exist: psql -U postgres -d hrms_db -f database/employee_change_requests.sql
-- Or from backend: npx prisma db execute --file ../database/employee_change_requests.sql

-- Ensure we're in the right database (if running manually)
-- \c hrms_db;

-- CreateEnum: employee_change_request_status
DO $$ BEGIN
  CREATE TYPE "employee_change_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: employee_change_requests
CREATE TABLE IF NOT EXISTS "employee_change_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" "employee_change_request_status" NOT NULL DEFAULT 'PENDING',
    "existing_data" JSONB NOT NULL,
    "requested_data" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_change_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: employee_id -> employees(id)
DO $$ BEGIN
  ALTER TABLE "employee_change_requests"
    ADD CONSTRAINT "employee_change_requests_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: submitted_by_id -> users(id)
DO $$ BEGIN
  ALTER TABLE "employee_change_requests"
    ADD CONSTRAINT "employee_change_requests_submitted_by_id_fkey"
    FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: approved_by_id -> users(id)
DO $$ BEGIN
  ALTER TABLE "employee_change_requests"
    ADD CONSTRAINT "employee_change_requests_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: organization_id -> organizations(id)
DO $$ BEGIN
  ALTER TABLE "employee_change_requests"
    ADD CONSTRAINT "employee_change_requests_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

SELECT 'employee_change_requests table ready.' AS message;
