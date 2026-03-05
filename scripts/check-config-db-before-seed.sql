-- =============================================================================
-- Config DB Check - Run this BEFORE seed to verify setup
-- இதை run பண்ணி companies, projects, project_modules structure பாருங்க
-- =============================================================================

-- 1. Companies (BNC Motors)
SELECT '1. COMPANIES (BNC)' AS check_step;
SELECT id, name, code FROM companies WHERE code = 'BNC' OR name ILIKE '%BNC Motors%';

-- 2. Projects (HRMS for BNC)
SELECT '2. PROJECTS (HRMS)' AS check_step;
SELECT p.id, p.name, p.code, p.company_id 
FROM projects p 
WHERE p.code = 'HRMS';

-- 3. Company-Project mapping
SELECT '3. COMPANY_PROJECT_MAPS' AS check_step;
SELECT cpm.*, p.code AS project_code 
FROM company_project_maps cpm 
JOIN projects p ON p.id = cpm.project_id 
WHERE p.code = 'HRMS';

-- 4. project_modules table structure (column types)
SELECT '4. PROJECT_MODULES COLUMNS' AS check_step;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'project_modules' 
ORDER BY ordinal_position;

-- 5. Unique constraints on project_modules
SELECT '5. UNIQUE CONSTRAINTS' AS check_step;
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'project_modules'::regclass AND contype = 'u';

-- 6. Existing modules (if any)
SELECT '6. EXISTING MODULES' AS check_step;
SELECT COUNT(*) AS module_count FROM project_modules;
