-- Add Employee Rejoin columns (is_rejoin, previous_employee_id, previous_employee_code)
-- Run this if you are not using Prisma migrations (e.g. prisma migrate dev).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS is_rejoin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_employee_id UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS previous_employee_code VARCHAR(50);

COMMENT ON COLUMN employees.is_rejoin IS 'True when this record was created via Rejoin from a separated employee';
COMMENT ON COLUMN employees.previous_employee_id IS 'Reference to the previous (resigned/terminated) employee record when is_rejoin = true';
COMMENT ON COLUMN employees.previous_employee_code IS 'Employee code of the previous record when is_rejoin = true';
