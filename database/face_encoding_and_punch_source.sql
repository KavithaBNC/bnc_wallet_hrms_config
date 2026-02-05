-- Add face_encoding to employees (JSON array of 128 floats)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS face_encoding JSONB;

-- Add punch_source to attendance_logs ('BIOMETRIC' | 'FACE')
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS punch_source VARCHAR(20);

-- Allow device_id to be null for face punches
ALTER TABLE attendance_logs ALTER COLUMN device_id DROP NOT NULL;

-- Add FACE to check_in_method enum (if your DB uses enum type; otherwise handled by Prisma)
-- PostgreSQL: ALTER TYPE check_in_method ADD VALUE IF NOT EXISTS 'FACE';
