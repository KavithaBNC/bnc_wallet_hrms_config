/**
 * Seed HRMS modules to Configurator DB (project_modules table)
 *
 * BNC Motors company + HRMS project க்கு எல்லா HRMS modules-ஐயும் Config DB-ல் add பண்ணும்.
 *
 * Usage:
 *   1. Set env: CONFIGURATOR_API_URL, CONFIGURATOR_AUTH_TOKEN (Super Admin token)
 *   2. Set HRMS_PROJECT_ID (e.g. 6 from projects table)
 *   3. Run: npx ts-node scripts/seed-hrms-modules-to-config.ts
 *
 * Or use SQL script: scripts/seed-hrms-modules-to-config.sql (direct DB insert)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
// Load backend/.env (has CONFIGURATOR_* vars)
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const CONFIGURATOR_API_URL = process.env.CONFIGURATOR_API_URL || 'http://localhost:3000';
const CONFIGURATOR_AUTH_TOKEN = process.env.CONFIGURATOR_AUTH_TOKEN || '';
const HRMS_PROJECT_ID = process.env.HRMS_PROJECT_ID || '6';

/**
 * HRMS modules from APP_MODULES - unique by resource.
 * code = resource (for permission matching), name = display label.
 * parentResource = parent module's resource (null = top-level).
 */
const HRMS_MODULES: Array<{
  code: string;
  name: string;
  description: string;
  parentResource: string | null;
}> = [
  { code: 'dashboard', name: 'Dashboard', description: 'Main dashboard', parentResource: null },
  { code: 'organizations', name: 'Organization Management', description: 'Manage organizations', parentResource: null },
  { code: 'permissions', name: 'Module Permission', description: 'Assign modules to roles', parentResource: null },
  { code: 'employees', name: 'Employees', description: 'Employee management', parentResource: null },
  { code: 'departments', name: 'Department', description: 'Department management', parentResource: null },
  { code: 'positions', name: 'Position', description: 'Job positions', parentResource: null },
  { code: 'core_hr', name: 'Core HR', description: 'Core HR configuration', parentResource: null },
  { code: 'compound_creation', name: 'Component Creation', description: 'Salary components', parentResource: 'core_hr' },
  { code: 'rules_engine', name: 'Rules Engine', description: 'Payroll rules', parentResource: 'core_hr' },
  { code: 'variable_input', name: 'Variable Input', description: 'Variable inputs', parentResource: 'core_hr' },
  { code: 'event_configuration', name: 'Event Configuration', description: 'Leave/event configuration', parentResource: null },
  { code: 'attendance_components', name: 'Attendance Components', description: 'Attendance components', parentResource: 'event_configuration' },
  { code: 'approval_workflow', name: 'Approval Workflow', description: 'Approval workflows', parentResource: 'event_configuration' },
  { code: 'workflow_mapping', name: 'Workflow Mapping', description: 'Workflow mappings', parentResource: 'event_configuration' },
  { code: 'rights_allocation', name: 'Rights Allocation', description: 'Rights allocation', parentResource: 'event_configuration' },
  { code: 'rule_setting', name: 'Rule Setting', description: 'Rule settings', parentResource: 'event_configuration' },
  { code: 'auto_credit_setting', name: 'Auto Credit Setting', description: 'Auto credit settings', parentResource: 'event_configuration' },
  { code: 'encashment_carry_forward', name: 'Encashment / Carry Forward', description: 'Leave encashment', parentResource: 'event_configuration' },
  { code: 'hr_activities', name: 'HR Activities', description: 'HR activities', parentResource: null },
  { code: 'validation_process', name: 'Validation Process', description: 'Validation process', parentResource: 'hr_activities' },
  { code: 'others_configuration', name: 'Others Configuration', description: 'Other configurations', parentResource: null },
  { code: 'validation_process_rule', name: 'Validation Process Rule', description: 'Validation rules', parentResource: 'others_configuration' },
  { code: 'attendance', name: 'Attendance', description: 'Attendance management', parentResource: null },
  { code: 'attendance_policy', name: 'Attendance Policy', description: 'Attendance policies', parentResource: null },
  { code: 'leaves', name: 'Event', description: 'Leave / event management', parentResource: null },
  { code: 'time_attendance', name: 'Time Attendance', description: 'Time and attendance', parentResource: null },
  { code: 'shifts', name: 'Shifts', description: 'Shift master and assign', parentResource: 'time_attendance' },
  { code: 'payroll', name: 'Payroll', description: 'Payroll management', parentResource: null },
  { code: 'employee_separations', name: 'Employee Separation', description: 'Employee separation', parentResource: 'payroll' },
  { code: 'employee_rejoin', name: 'Employee Rejoin', description: 'Employee rejoin', parentResource: 'payroll' },
  { code: 'salary_structures', name: 'Salary Structure', description: 'Salary structures', parentResource: null },
  { code: 'employee_salaries', name: 'Employee Salary', description: 'Employee salaries', parentResource: null },
  { code: 'hr_audit_settings', name: 'HR Audit Settings', description: 'HR audit settings', parentResource: null },
  { code: 'employee_master_approval', name: 'Employee Master Approval', description: 'Employee master approval', parentResource: null },
  { code: 'esop', name: 'ESOP', description: 'ESOP management', parentResource: null },
  { code: 'transfer_promotions', name: 'Transaction', description: 'Transfer and promotions', parentResource: null },
  { code: 'transfer_promotion_entry', name: 'Transfer and Promotion Entry', description: 'Transfer promotion entry', parentResource: 'transfer_promotions' },
];

async function main() {
  const axios = (await import('axios')).default;

  if (!CONFIGURATOR_AUTH_TOKEN) {
    console.error('CONFIGURATOR_AUTH_TOKEN required. Login as Super Admin and set token in .env');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${CONFIGURATOR_AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // 1. Get existing modules to avoid duplicates and resolve parent IDs
  let existingModules: Array<{ id: number; code: string }> = [];
  try {
    const res = await axios.get(`${CONFIGURATOR_API_URL}/projects/${HRMS_PROJECT_ID}/modules`, { headers });
    existingModules = (res.data?.data?.modules || []).map((m: { id: number; code: string }) => ({ id: m.id, code: m.code }));
    console.log(`Found ${existingModules.length} existing modules in HRMS project`);
  } catch (err: unknown) {
    console.warn('Could not fetch existing modules:', (err as { response?: { status: number } })?.response?.status);
  }

  const codeToId = new Map(existingModules.map((m) => [m.code, m.id]));
  const createdIds: Array<{ code: string; id: number }> = [];

  // 2. Create modules in order: parents first, then children
  const topLevel = HRMS_MODULES.filter((m) => !m.parentResource);
  const withParent = HRMS_MODULES.filter((m) => m.parentResource);

  const toCreate = [...topLevel, ...withParent];

  for (const mod of toCreate) {
    if (codeToId.has(mod.code)) {
      console.log(`  Skip (exists): ${mod.code}`);
      continue;
    }

    let parentModuleId: number | null = null;
    if (mod.parentResource) {
      parentModuleId = codeToId.get(mod.parentResource) ?? null;
      if (!parentModuleId) {
        console.warn(`  Skip ${mod.code}: parent ${mod.parentResource} not found yet`);
        continue;
      }
    }

    try {
      const payload = {
        name: mod.name,
        code: mod.code,
        description: mod.description,
        parentModuleId,
      };

      const res = await axios.post(
        `${CONFIGURATOR_API_URL}/projects/${HRMS_PROJECT_ID}/modules`,
        payload,
        { headers }
      );

      const created = res.data?.data?.module;
      if (created?.id) {
        codeToId.set(mod.code, created.id);
        createdIds.push({ code: mod.code, id: created.id });
        console.log(`  Created: ${mod.code} (id=${created.id})`);
      }
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: unknown; status?: number } };
      console.error(`  Failed ${mod.code}:`, axErr.response?.data ?? axErr);
    }
  }

  console.log(`\nDone. Created ${createdIds.length} modules.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
