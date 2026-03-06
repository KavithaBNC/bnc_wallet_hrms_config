-- =============================================================================
-- Seed HRMS modules to Configurator project_modules table
-- BNC Motors + HRMS project க்கு எல்லா modules-ஐயும் add பண்ணும்
--
-- STEP 1: Get HRMS project ID for BNC Motors
--   SELECT id FROM projects WHERE code = 'HRMS' LIMIT 1;
--   (Or: SELECT p.id FROM projects p
--        JOIN company_project_maps cpm ON cpm.project_id = p.id
--        JOIN companies c ON c.id = cpm.company_id
--        WHERE c.code = 'BNC' AND p.code = 'HRMS' LIMIT 1;)
--
-- STEP 2: Replace YOUR_HRMS_PROJECT_ID in the DO block below
--   If projects.id is UUID: use 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
--   If projects.id is integer: use 6 (and change v_pid::uuid to v_pid::text or remove cast in WHERE clauses)
--
-- STEP 3: Run: psql $CONFIGURATOR_DATABASE_URL -v hrms_project_id='YOUR_PROJECT_ID' -f seed-hrms-modules-to-config.sql
--   Or run in pgAdmin / DBeaver after replacing :hrms_project_id
-- =============================================================================

-- Use this to set project_id (replace with actual value before running):
-- \set hrms_project_id 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

-- For psql, you can pass: -v hrms_project_id='your-uuid-here'
-- Then use :'hrms_project_id' in the query

-- Alternative: Use subquery to find HRMS project (uncomment if you have single HRMS project)
-- DO $$
-- DECLARE
--   v_project_id TEXT;
-- BEGIN
--   SELECT id::text INTO v_project_id FROM projects WHERE code = 'HRMS' LIMIT 1;
--   IF v_project_id IS NULL THEN
--     RAISE EXCEPTION 'HRMS project not found. Create it first in Configurator.';
--   END IF;
--   -- Store in temp table for use in inserts
--   CREATE TEMP TABLE IF NOT EXISTS _seed_vars (key text, val text);
--   DELETE FROM _seed_vars WHERE key = 'project_id';
--   INSERT INTO _seed_vars VALUES ('project_id', v_project_id);
-- END $$;

-- =============================================================================
-- INSERT MODULES (run after setting project_id)
-- Replace 'YOUR_HRMS_PROJECT_ID' with actual UUID from projects table
-- =============================================================================

DO $$
DECLARE
  v_pid TEXT := 'YOUR_HRMS_PROJECT_ID';  -- <<<< REPLACE THIS with project id from: SELECT id FROM projects WHERE code = 'HRMS'
  v_id INT;
  v_parent_core_hr INT;
  v_parent_event INT;
  v_parent_hr_activities INT;
  v_parent_others INT;
  v_parent_time INT;
  v_parent_payroll INT;
  v_parent_transfer INT;
BEGIN
  -- Validate project exists
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id::text = v_pid) THEN
    RAISE EXCEPTION 'Project % not found. Set v_pid to valid HRMS project ID.', v_pid;
  END IF;

  -- Top-level modules (parent_module_id = NULL)
  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Dashboard', 'DASHBOARD', 'Main dashboard', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Organization Management', 'ORGANIZATIONS', 'Manage organizations', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Module Permission', 'PERMISSIONS', 'Assign modules to roles', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Employees', 'EMPLOYEES', 'Employee management', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Department', 'DEPARTMENTS', 'Department management', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Position', 'POSITIONS', 'Job positions', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Core HR', 'CORE_HR', 'Core HR configuration', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_parent_core_hr;

  SELECT id INTO v_parent_core_hr FROM project_modules WHERE project_id::text = v_pid AND code = 'CORE_HR' LIMIT 1;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_pid::uuid, 'Component Creation', 'COMPOUND_CREATION', 'Salary components', true, v_parent_core_hr, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_pid::uuid, 'Rules Engine', 'RULES_ENGINE', 'Payroll rules', true, v_parent_core_hr, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_pid::uuid, 'Variable Input', 'VARIABLE_INPUT', 'Variable inputs', true, v_parent_core_hr, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Event Configuration', 'EVENT_CONFIGURATION', 'Leave/event configuration', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  SELECT id INTO v_parent_event FROM project_modules WHERE project_id::text = v_pid AND code = 'EVENT_CONFIGURATION' LIMIT 1;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_pid::uuid, 'Attendance Components', 'ATTENDANCE_COMPONENTS', 'Attendance components', true, v_parent_event, NOW(), NOW()),
         (v_pid::uuid, 'Approval Workflow', 'APPROVAL_WORKFLOW', 'Approval workflows', true, v_parent_event, NOW(), NOW()),
         (v_pid::uuid, 'Workflow Mapping', 'WORKFLOW_MAPPING', 'Workflow mappings', true, v_parent_event, NOW(), NOW()),
         (v_pid::uuid, 'Rights Allocation', 'RIGHTS_ALLOCATION', 'Rights allocation', true, v_parent_event, NOW(), NOW()),
         (v_pid::uuid, 'Rule Setting', 'RULE_SETTING', 'Rule settings', true, v_parent_event, NOW(), NOW()),
         (v_pid::uuid, 'Auto Credit Setting', 'AUTO_CREDIT_SETTING', 'Auto credit settings', true, v_parent_event, NOW(), NOW()),
         (v_pid::uuid, 'Encashment / Carry Forward', 'ENCASHMENT_CARRY_FORWARD', 'Leave encashment', true, v_parent_event, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'HR Activities', 'HR_ACTIVITIES', 'HR activities', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  SELECT id INTO v_parent_hr_activities FROM project_modules WHERE project_id::text = v_pid AND code = 'HR_ACTIVITIES' LIMIT 1;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_pid::uuid, 'Validation Process', 'VALIDATION_PROCESS', 'Validation process', true, v_parent_hr_activities, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Others Configuration', 'OTHERS_CONFIGURATION', 'Other configurations', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  SELECT id INTO v_parent_others FROM project_modules WHERE project_id::text = v_pid AND code = 'OTHERS_CONFIGURATION' LIMIT 1;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_pid::uuid, 'Validation Process Rule', 'VALIDATION_PROCESS_RULE', 'Validation rules', true, v_parent_others, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Attendance', 'ATTENDANCE', 'Attendance management', true, NOW(), NOW()),
         (v_pid::uuid, 'Attendance Policy', 'ATTENDANCE_POLICY', 'Attendance policies', true, NOW(), NOW()),
         (v_pid::uuid, 'Event', 'LEAVES', 'Leave / event management', true, NOW(), NOW()),
         (v_pid::uuid, 'Time Attendance', 'TIME_ATTENDANCE', 'Time and attendance', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  SELECT id INTO v_parent_time FROM project_modules WHERE project_id::text = v_pid AND code = 'TIME_ATTENDANCE' LIMIT 1;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_pid::uuid, 'Shifts', 'SHIFTS', 'Shift master and assign', true, v_parent_time, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Payroll', 'PAYROLL', 'Payroll management', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  SELECT id INTO v_parent_payroll FROM project_modules WHERE project_id::text = v_pid AND code = 'PAYROLL' LIMIT 1;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_pid::uuid, 'Employee Separation', 'EMPLOYEE_SEPARATIONS', 'Employee separation', true, v_parent_payroll, NOW(), NOW()),
         (v_pid::uuid, 'Employee Rejoin', 'EMPLOYEE_REJOIN', 'Employee rejoin', true, v_parent_payroll, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES (v_pid::uuid, 'Salary Structure', 'SALARY_STRUCTURES', 'Salary structures', true, NOW(), NOW()),
         (v_pid::uuid, 'Employee Salary', 'EMPLOYEE_SALARIES', 'Employee salaries', true, NOW(), NOW()),
         (v_pid::uuid, 'HR Audit Settings', 'HR_AUDIT_SETTINGS', 'HR audit settings', true, NOW(), NOW()),
         (v_pid::uuid, 'Employee Master Approval', 'EMPLOYEE_MASTER_APPROVAL', 'Employee master approval', true, NOW(), NOW()),
         (v_pid::uuid, 'ESOP', 'ESOP', 'ESOP management', true, NOW(), NOW()),
         (v_pid::uuid, 'Transaction', 'TRANSFER_PROMOTIONS', 'Transfer and promotions', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  SELECT id INTO v_parent_transfer FROM project_modules WHERE project_id::text = v_pid AND code = 'TRANSFER_PROMOTIONS' LIMIT 1;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_pid::uuid, 'Transfer and Promotion Entry', 'TRANSFER_PROMOTION_ENTRY', 'Transfer promotion entry', true, v_parent_transfer, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  RAISE NOTICE 'HRMS modules seeded successfully for project %', v_pid;
END $$;
