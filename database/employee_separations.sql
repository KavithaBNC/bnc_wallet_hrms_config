-- Employee Separation table (Payroll sub-module)
-- Run after Prisma schema update. Or use: npx prisma db push

CREATE TYPE separation_type AS ENUM (
  'RESIGNATION',
  'TERMINATION',
  'RETIREMENT',
  'CONTRACT_END',
  'ABSONDING',
  'OTHER'
);

CREATE TABLE IF NOT EXISTS employee_separations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resignation_apply_date DATE NOT NULL,
  notice_period INTEGER NOT NULL,
  notice_period_reason VARCHAR(255),
  relieving_date DATE NOT NULL,
  reason_of_leaving VARCHAR(255),
  separation_type separation_type NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_separations_organization_id ON employee_separations(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_separations_employee_id ON employee_separations(employee_id);
