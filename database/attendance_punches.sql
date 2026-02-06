-- Multiple punch records per day per employee (IN/OUT with timestamp).
-- Run this if you are not using Prisma db push (e.g. manual schema).
-- Requires: employees table.

CREATE TABLE IF NOT EXISTS attendance_punches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  punch_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(10) NOT NULL,
  punch_source VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_punches_employee_time
  ON attendance_punches(employee_id, punch_time);
