-- =============================================================================
-- Seed HRMS modules for BNC Motors - Direct SQL
-- Config DB-ல் BNC Motors company க்கு HRMS project-ன் modules insert பண்ணும்
-- v_company_id auto-fetch: code='BNC' or name ILIKE '%BNC Motors%'
--
-- Run: psql $CONFIGURATOR_DATABASE_URL -f seed-hrms-modules-company-59.sql
-- Or run in pgAdmin / DBeaver
-- =============================================================================

DO $$
DECLARE
  v_company_id TEXT;
  v_project_id TEXT;
  v_parent_core_hr INT;
  v_parent_event INT;
  v_parent_hr_activities INT;
  v_parent_others INT;
  v_parent_time INT;
  v_parent_payroll INT;
  v_parent_transfer INT;
BEGIN
  -- Auto-fetch company id: BNC Motors (code='BNC' or name contains 'BNC Motors')
  SELECT c.id::text INTO v_company_id
  FROM companies c
  WHERE c.code = 'BNC' OR c.name ILIKE '%BNC Motors%'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company BNC Motors not found. Check companies table for code=BNC or name like BNC Motors.';
  END IF;

  RAISE NOTICE 'Found company_id % (BNC Motors)', v_company_id;

  -- Find HRMS project for this company
  SELECT p.id::text INTO v_project_id
  FROM projects p
  WHERE p.company_id::text = v_company_id
    AND p.code = 'HRMS'
  LIMIT 1;

  -- Fallback: from company_project_maps (when project linked via map)
  IF v_project_id IS NULL THEN
    SELECT cpm.project_id::text INTO v_project_id
    FROM company_project_maps cpm
    JOIN projects p ON p.id = cpm.project_id
    WHERE cpm.company_id::text = v_company_id
      AND p.code = 'HRMS'
    LIMIT 1;
  END IF;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'HRMS project not found for company %. Create HRMS project for this company first.', v_company_id;
  END IF;

  RAISE NOTICE 'Using project_id % for company %', v_project_id, v_company_id;

  -- Top-level modules
  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  VALUES 
    (v_project_id::uuid, 'Dashboard', 'DASHBOARD', 'Main dashboard', true, NOW(), NOW()),
    (v_project_id::uuid, 'Organization Management', 'ORGANIZATIONS', 'Manage organizations', true, NOW(), NOW()),
    (v_project_id::uuid, 'Module Permission', 'PERMISSIONS', 'Assign modules to roles', true, NOW(), NOW()),
    (v_project_id::uuid, 'Employees', 'EMPLOYEES', 'Employee management', true, NOW(), NOW()),
    (v_project_id::uuid, 'Department', 'DEPARTMENTS', 'Department management', true, NOW(), NOW()),
    (v_project_id::uuid, 'Position', 'POSITIONS', 'Job positions', true, NOW(), NOW()),
    (v_project_id::uuid, 'Core HR', 'CORE_HR', 'Core HR configuration', true, NOW(), NOW()),
    (v_project_id::uuid, 'Event Configuration', 'EVENT_CONFIGURATION', 'Leave/event configuration', true, NOW(), NOW()),
    (v_project_id::uuid, 'HR Activities', 'HR_ACTIVITIES', 'HR activities', true, NOW(), NOW()),
    (v_project_id::uuid, 'Others Configuration', 'OTHERS_CONFIGURATION', 'Other configurations', true, NOW(), NOW()),
    (v_project_id::uuid, 'Attendance', 'ATTENDANCE', 'Attendance management', true, NOW(), NOW()),
    (v_project_id::uuid, 'Attendance Policy', 'ATTENDANCE_POLICY', 'Attendance policies', true, NOW(), NOW()),
    (v_project_id::uuid, 'Event', 'LEAVES', 'Leave / event management', true, NOW(), NOW()),
    (v_project_id::uuid, 'Time Attendance', 'TIME_ATTENDANCE', 'Time and attendance', true, NOW(), NOW()),
    (v_project_id::uuid, 'Payroll', 'PAYROLL', 'Payroll management', true, NOW(), NOW()),
    (v_project_id::uuid, 'Salary Structure', 'SALARY_STRUCTURES', 'Salary structures', true, NOW(), NOW()),
    (v_project_id::uuid, 'Employee Salary', 'EMPLOYEE_SALARIES', 'Employee salaries', true, NOW(), NOW()),
    (v_project_id::uuid, 'HR Audit Settings', 'HR_AUDIT_SETTINGS', 'HR audit settings', true, NOW(), NOW()),
    (v_project_id::uuid, 'Employee Master Approval', 'EMPLOYEE_MASTER_APPROVAL', 'Employee master approval', true, NOW(), NOW()),
    (v_project_id::uuid, 'ESOP', 'ESOP', 'ESOP management', true, NOW(), NOW()),
    (v_project_id::uuid, 'Transaction', 'TRANSFER_PROMOTIONS', 'Transfer and promotions', true, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  -- Get parent IDs
  SELECT id INTO v_parent_core_hr FROM project_modules WHERE project_id::text = v_project_id AND code = 'CORE_HR' LIMIT 1;
  SELECT id INTO v_parent_event FROM project_modules WHERE project_id::text = v_project_id AND code = 'EVENT_CONFIGURATION' LIMIT 1;
  SELECT id INTO v_parent_hr_activities FROM project_modules WHERE project_id::text = v_project_id AND code = 'HR_ACTIVITIES' LIMIT 1;
  SELECT id INTO v_parent_others FROM project_modules WHERE project_id::text = v_project_id AND code = 'OTHERS_CONFIGURATION' LIMIT 1;
  SELECT id INTO v_parent_time FROM project_modules WHERE project_id::text = v_project_id AND code = 'TIME_ATTENDANCE' LIMIT 1;
  SELECT id INTO v_parent_payroll FROM project_modules WHERE project_id::text = v_project_id AND code = 'PAYROLL' LIMIT 1;
  SELECT id INTO v_parent_transfer FROM project_modules WHERE project_id::text = v_project_id AND code = 'TRANSFER_PROMOTIONS' LIMIT 1;

  -- Child modules
  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES 
    (v_project_id::uuid, 'Component Creation', 'COMPOUND_CREATION', 'Salary components', true, v_parent_core_hr, NOW(), NOW()),
    (v_project_id::uuid, 'Rules Engine', 'RULES_ENGINE', 'Payroll rules', true, v_parent_core_hr, NOW(), NOW()),
    (v_project_id::uuid, 'Variable Input', 'VARIABLE_INPUT', 'Variable inputs', true, v_parent_core_hr, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES 
    (v_project_id::uuid, 'Attendance Components', 'ATTENDANCE_COMPONENTS', 'Attendance components', true, v_parent_event, NOW(), NOW()),
    (v_project_id::uuid, 'Approval Workflow', 'APPROVAL_WORKFLOW', 'Approval workflows', true, v_parent_event, NOW(), NOW()),
    (v_project_id::uuid, 'Workflow Mapping', 'WORKFLOW_MAPPING', 'Workflow mappings', true, v_parent_event, NOW(), NOW()),
    (v_project_id::uuid, 'Rights Allocation', 'RIGHTS_ALLOCATION', 'Rights allocation', true, v_parent_event, NOW(), NOW()),
    (v_project_id::uuid, 'Rule Setting', 'RULE_SETTING', 'Rule settings', true, v_parent_event, NOW(), NOW()),
    (v_project_id::uuid, 'Auto Credit Setting', 'AUTO_CREDIT_SETTING', 'Auto credit settings', true, v_parent_event, NOW(), NOW()),
    (v_project_id::uuid, 'Encashment / Carry Forward', 'ENCASHMENT_CARRY_FORWARD', 'Leave encashment', true, v_parent_event, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_project_id::uuid, 'Validation Process', 'VALIDATION_PROCESS', 'Validation process', true, v_parent_hr_activities, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_project_id::uuid, 'Validation Process Rule', 'VALIDATION_PROCESS_RULE', 'Validation rules', true, v_parent_others, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_project_id::uuid, 'Shifts', 'SHIFTS', 'Shift master and assign', true, v_parent_time, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES 
    (v_project_id::uuid, 'Employee Separation', 'EMPLOYEE_SEPARATIONS', 'Employee separation', true, v_parent_payroll, NOW(), NOW()),
    (v_project_id::uuid, 'Employee Rejoin', 'EMPLOYEE_REJOIN', 'Employee rejoin', true, v_parent_payroll, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  VALUES (v_project_id::uuid, 'Transfer and Promotion Entry', 'TRANSFER_PROMOTION_ENTRY', 'Transfer promotion entry', true, v_parent_transfer, NOW(), NOW())
  ON CONFLICT (project_id, code) DO NOTHING;

  RAISE NOTICE 'HRMS modules seeded for company % (project %)', v_company_id, v_project_id;
END $$;
