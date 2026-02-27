-- ADMS / Biometric: companies, devices, attendance_logs
-- Run this if you are not using Prisma migrate (e.g. prisma db push or manual schema).

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  organization_id UUID UNIQUE REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  serial_number VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id VARCHAR(100) NOT NULL,
  punch_timestamp TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_device_id ON attendance_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_punch_timestamp ON attendance_logs(punch_timestamp);
CREATE INDEX IF NOT EXISTS idx_devices_serial_number ON devices(serial_number);
