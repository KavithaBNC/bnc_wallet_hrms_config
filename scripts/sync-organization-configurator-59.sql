-- =============================================================================
-- Sync HRMS Organization with Configurator Company 59 (BNC Motors)
-- Run this on HRMS DB to fix "Organization for company 59 not found" / 500 login
-- =============================================================================

-- 1. Add configurator_company_id to organizations if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'configurator_company_id'
  ) THEN
    ALTER TABLE organizations ADD COLUMN configurator_company_id INT UNIQUE;
  END IF;
END $$;

-- 2. Set configurator_company_id = 59 for BNC Motors organization
--    (Match by name; adjust WHERE clause if your org name differs)
UPDATE organizations 
SET configurator_company_id = 59 
WHERE name ILIKE '%BNC Motors%' OR name ILIKE '%BNC%'
  AND (configurator_company_id IS NULL OR configurator_company_id != 59);

-- If no org matched above, set for the first organization
UPDATE organizations 
SET configurator_company_id = 59 
WHERE id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
  AND (configurator_company_id IS NULL OR configurator_company_id != 59);

-- 3. Verify
SELECT id, name, configurator_company_id 
FROM organizations 
WHERE configurator_company_id = 59;
