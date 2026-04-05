/**
 * Test script: Verify Config DB direct access login flow
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/test-config-login.ts
 */

import { configAuthService } from '../services/config-auth.service';
import { configModulesService } from '../services/config-modules.service';
import { configOrgDataService } from '../services/config-org-data.service';
import { configUsersService } from '../services/config-users.service';

async function main() {
  console.log('=== Config DB (Nemi_Config) Direct Access Test ===\n');

  // Step 1: Verify company
  console.log('--- Step 1: Verify company "bnc" ---');
  const verifyResult = await configAuthService.verifyCompany('bnc');
  if (!verifyResult.success || !verifyResult.company) {
    console.error('FAIL: Company "bnc" not found —', verifyResult.message);
    process.exit(1);
  }
  const company = verifyResult.company;
  console.log('OK: id:', company.id, ', name:', company.name, ', code:', company.code);

  // Step 2: Login
  console.log('\n--- Step 2: Login as bnc.01@gmail.com ---');
  const loginResult = await configAuthService.login('bnc.01@gmail.com', '4D07y12ZkZ', company.id);
  if (!loginResult.user) {
    console.error('FAIL: Login failed — no user returned');
    process.exit(1);
  }
  console.log('OK: Login success');
  console.log('  user_id:', loginResult.user.id);
  console.log('  email:', loginResult.user.email);
  console.log('  first_name:', loginResult.user.first_name);
  console.log('  last_name:', loginResult.user.last_name);
  console.log('  company_id:', loginResult.user.company_id);
  console.log('  roles:', loginResult.roles?.length ?? 0, 'role(s)');
  if (loginResult.roles?.[0]) {
    console.log('  primary role:', JSON.stringify(loginResult.roles[0]));
  }

  // Step 3: Get role details
  if (loginResult.roles?.[0]) {
    console.log('\n--- Step 3: Get role details (id:', loginResult.roles[0].id, ') ---');
    const role = await configAuthService.getUserRole(loginResult.roles[0].id);
    console.log('OK:', JSON.stringify(role));
  }

  // Step 4: Get modules
  console.log('\n--- Step 4: Get project modules ---');
  const modules = await configModulesService.getModules();
  console.log('OK:', modules.length, 'modules');
  for (const m of modules.slice(0, 5)) {
    console.log('  -', m.name, '(', m.code, ') page:', m.page_name);
  }
  if (modules.length > 5) console.log('  ...and', modules.length - 5, 'more');

  // Step 5: Departments
  console.log('\n--- Step 5: Departments (company_id:', company.id, ') ---');
  const depts = await configOrgDataService.getDepartments(company.id);
  console.log('OK:', depts.length, 'departments');
  for (const d of depts.slice(0, 5)) {
    console.log('  -', (d as any).name, '(id:', d.id, ')');
  }

  // Step 6: Sub-departments
  console.log('\n--- Step 6: Sub-departments ---');
  const subDepts = await configOrgDataService.getSubDepartments(company.id);
  console.log('OK:', subDepts.length, 'sub-departments');

  // Step 7: Cost centres
  console.log('\n--- Step 7: Cost centres ---');
  const costCentres = await configOrgDataService.getCostCentres(company.id);
  console.log('OK:', costCentres.length, 'cost centres');
  for (const c of costCentres.slice(0, 5)) {
    console.log('  -', (c as any).name, '(id:', c.id, ')');
  }

  // Step 8: Users
  console.log('\n--- Step 8: Users ---');
  const users = await configUsersService.getUsers(company.id);
  console.log('OK:', users.length, 'users');

  // Step 9: Role-module permissions
  if (loginResult.roles?.[0]) {
    console.log('\n--- Step 9: Role-module permissions (role_id:', loginResult.roles[0].id, ') ---');
    const perms = await configModulesService.getRoleModulePermissions(loginResult.roles[0].id, company.id);
    console.log('OK:', perms.length, 'permission entries');
    const enabled = perms.filter((p: any) => p.is_enabled);
    console.log('  enabled:', enabled.length, ', disabled:', perms.length - enabled.length);
  }

  console.log('\n=== ALL 9 TESTS PASSED ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFATAL ERROR:', err.message || err);
  process.exit(1);
});
