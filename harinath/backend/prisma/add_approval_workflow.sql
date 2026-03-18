-- Manual migration: Add approval_workflows table
-- Run this if prisma migrate dev fails due to shadow database issues
-- Usage: psql -h <host> -U <user> -d hrms_db -f add_approval_workflow.sql

CREATE TABLE IF NOT EXISTS "approval_workflows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "workflow_type" VARCHAR(50) NOT NULL,
    "short_name" VARCHAR(255) NOT NULL,
    "long_name" VARCHAR(255) NOT NULL,
    "remarks" TEXT,
    "attendance_events" JSONB,
    "excess_time_events" JSONB,
    "request_type_events" JSONB,
    "validation_group_events" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index for common queries
CREATE INDEX IF NOT EXISTS "approval_workflows_organization_id_idx" ON "approval_workflows"("organization_id");
CREATE INDEX IF NOT EXISTS "approval_workflows_workflow_type_idx" ON "approval_workflows"("workflow_type");
