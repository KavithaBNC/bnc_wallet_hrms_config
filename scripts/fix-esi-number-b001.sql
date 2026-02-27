-- Add esiNumber to tax_information for B001 employee
-- Run in pgAdmin or: psql -U postgres -d hrms_db -f scripts/fix-esi-number-b001.sql

UPDATE employees
SET tax_information = COALESCE(tax_information, '{}'::jsonb) || '{"esiNumber": "31-12345-67-890"}'::jsonb
WHERE employee_code = 'B001'
  AND organization_id = (SELECT id FROM organizations WHERE name ILIKE '%BNC Motors%' LIMIT 1);
