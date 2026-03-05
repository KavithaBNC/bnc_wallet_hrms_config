-- =============================================================================
-- Seed HRMS modules for BNC Motors - V2 (handles UUID or VARCHAR project_id)
-- Config DB-ல் BNC Motors க்கு HRMS project modules insert
--
-- Run: psql $CONFIGURATOR_DATABASE_URL -f seed-hrms-modules-company-59-v2.sql
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
  -- 1. Find company
  SELECT c.id::text INTO v_company_id
  FROM companies c
  WHERE c.code = 'BNC' OR c.name ILIKE '%BNC Motors%'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company BNC Motors not found. Run: SELECT id,name,code FROM companies;';
  END IF;
  RAISE NOTICE 'Company: %', v_company_id;

  -- 2. Find HRMS project
  SELECT p.id::text INTO v_project_id
  FROM projects p
  WHERE p.company_id::text = v_company_id AND p.code = 'HRMS'
  LIMIT 1;

  IF v_project_id IS NULL THEN
    SELECT cpm.project_id::text INTO v_project_id
    FROM company_project_maps cpm
    JOIN projects p ON p.id = cpm.project_id
    WHERE cpm.company_id::text = v_company_id AND p.code = 'HRMS'
    LIMIT 1;
  END IF;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'HRMS project not found for company %. Assign HRMS project to BNC Motors in Configurator first.', v_company_id;
  END IF;
  RAISE NOTICE 'Project: %', v_project_id;

  -- 3. Insert top-level modules (WHERE NOT EXISTS to avoid duplicates)
  -- Note: If "invalid input syntax for type uuid" error, projects.id may be integer - check check-config-db-before-seed.sql
  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Dashboard', 'DASHBOARD', 'Main dashboard', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'DASHBOARD');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Organization Management', 'ORGANIZATIONS', 'Manage organizations', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'ORGANIZATIONS');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Module Permission', 'PERMISSIONS', 'Assign modules to roles', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'PERMISSIONS');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Employees', 'EMPLOYEES', 'Employee management', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'EMPLOYEES');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Department', 'DEPARTMENTS', 'Department management', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'DEPARTMENTS');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Position', 'POSITIONS', 'Job positions', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'POSITIONS');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Core HR', 'CORE_HR', 'Core HR configuration', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'CORE_HR');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Event Configuration', 'EVENT_CONFIGURATION', 'Leave/event configuration', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'EVENT_CONFIGURATION');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'HR Activities', 'HR_ACTIVITIES', 'HR activities', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'HR_ACTIVITIES');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Others Configuration', 'OTHERS_CONFIGURATION', 'Other configurations', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'OTHERS_CONFIGURATION');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Attendance', 'ATTENDANCE', 'Attendance management', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'ATTENDANCE');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Attendance Policy', 'ATTENDANCE_POLICY', 'Attendance policies', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'ATTENDANCE_POLICY');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Event', 'LEAVES', 'Leave / event management', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'LEAVES');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Time Attendance', 'TIME_ATTENDANCE', 'Time and attendance', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'TIME_ATTENDANCE');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Payroll', 'PAYROLL', 'Payroll management', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'PAYROLL');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Salary Structure', 'SALARY_STRUCTURES', 'Salary structures', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'SALARY_STRUCTURES');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Employee Salary', 'EMPLOYEE_SALARIES', 'Employee salaries', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'EMPLOYEE_SALARIES');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'HR Audit Settings', 'HR_AUDIT_SETTINGS', 'HR audit settings', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'HR_AUDIT_SETTINGS');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Employee Master Approval', 'EMPLOYEE_MASTER_APPROVAL', 'Employee master approval', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'EMPLOYEE_MASTER_APPROVAL');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'ESOP', 'ESOP', 'ESOP management', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'ESOP');

  INSERT INTO project_modules (project_id, name, code, description, is_active, created_at, updated_at)
  SELECT v_project_id::uuid, 'Transaction', 'TRANSFER_PROMOTIONS', 'Transfer and promotions', true, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'TRANSFER_PROMOTIONS');

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
  SELECT v_project_id::uuid, 'Component Creation', 'COMPOUND_CREATION', 'Salary components', true, v_parent_core_hr, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'COMPOUND_CREATION');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Rules Engine', 'RULES_ENGINE', 'Payroll rules', true, v_parent_core_hr, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'RULES_ENGINE');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Variable Input', 'VARIABLE_INPUT', 'Variable inputs', true, v_parent_core_hr, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'VARIABLE_INPUT');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Attendance Components', 'ATTENDANCE_COMPONENTS', 'Attendance components', true, v_parent_event, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'ATTENDANCE_COMPONENTS');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Approval Workflow', 'APPROVAL_WORKFLOW', 'Approval workflows', true, v_parent_event, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'APPROVAL_WORKFLOW');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Workflow Mapping', 'WORKFLOW_MAPPING', 'Workflow mappings', true, v_parent_event, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'WORKFLOW_MAPPING');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Rights Allocation', 'RIGHTS_ALLOCATION', 'Rights allocation', true, v_parent_event, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'RIGHTS_ALLOCATION');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Rule Setting', 'RULE_SETTING', 'Rule settings', true, v_parent_event, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'RULE_SETTING');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Auto Credit Setting', 'AUTO_CREDIT_SETTING', 'Auto credit settings', true, v_parent_event, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'AUTO_CREDIT_SETTING');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Encashment / Carry Forward', 'ENCASHMENT_CARRY_FORWARD', 'Leave encashment', true, v_parent_event, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'ENCASHMENT_CARRY_FORWARD');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Validation Process', 'VALIDATION_PROCESS', 'Validation process', true, v_parent_hr_activities, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'VALIDATION_PROCESS');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Validation Process Rule', 'VALIDATION_PROCESS_RULE', 'Validation rules', true, v_parent_others, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'VALIDATION_PROCESS_RULE');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Shifts', 'SHIFTS', 'Shift master and assign', true, v_parent_time, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'SHIFTS');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Employee Separation', 'EMPLOYEE_SEPARATIONS', 'Employee separation', true, v_parent_payroll, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'EMPLOYEE_SEPARATIONS');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Employee Rejoin', 'EMPLOYEE_REJOIN', 'Employee rejoin', true, v_parent_payroll, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'EMPLOYEE_REJOIN');

  INSERT INTO project_modules (project_id, name, code, description, is_active, parent_module_id, created_at, updated_at)
  SELECT v_project_id::uuid, 'Transfer and Promotion Entry', 'TRANSFER_PROMOTION_ENTRY', 'Transfer promotion entry', true, v_parent_transfer, NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM project_modules WHERE project_id::text = v_project_id AND code = 'TRANSFER_PROMOTION_ENTRY');

  RAISE NOTICE 'Done. Modules seeded for company % project %', v_company_id, v_project_id;
END $$;
