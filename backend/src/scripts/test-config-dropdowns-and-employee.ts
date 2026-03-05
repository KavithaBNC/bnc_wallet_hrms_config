/**
 * Test: Department, Sub-department, Cost Centre dropdowns + Employee add and list
 *
 * Prerequisites:
 * - Backend running (npm run dev)
 * - Config API available (CONFIGURATOR_API_URL)
 * - Org linked to Config (configurator_company_id set)
 * - User logged in via Config (has configuratorAccessToken)
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/test-config-dropdowns-and-employee.ts
 *
 * Or with explicit base URL and token:
 *   API_BASE=http://localhost:5001 TOKEN=<jwt> npx ts-node -r tsconfig-paths/register src/scripts/test-config-dropdowns-and-employee.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = process.env.API_BASE || 'http://localhost:5001';
const TOKEN = process.env.TOKEN || '';
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'superadmin@bncmotors.com';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'SuperAdmin@59';
const COMPANY_ID = parseInt(process.env.COMPANY_ID || '59', 10);

let authToken = TOKEN;

async function api(method: string, url: string, body?: any, useToken = true) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(useToken && authToken && { Authorization: `Bearer ${authToken}` }),
  };
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function login(): Promise<boolean> {
  // Try Config login first (gives configuratorAccessToken for dropdowns)
  if (AUTH_USERNAME && AUTH_PASSWORD) {
    const res = await api('POST', '/api/v1/auth/configurator/login', {
      username: AUTH_USERNAME,
      password: AUTH_PASSWORD,
      company_id: COMPANY_ID,
    }, false);
    if (res.status === 200 && res.data?.data?.tokens?.accessToken) {
      authToken = res.data.data.tokens.accessToken;
      return true;
    }
  }
  // Fallback: HRMS login (email/password) - use AUTH_USERNAME as email if looks like email
  const email = AUTH_USERNAME?.includes('@') ? AUTH_USERNAME : (AUTH_USERNAME || 'admin@example.com');
  const password = AUTH_PASSWORD || 'Admin@123456';
  const res = await api('POST', '/api/v1/auth/login', { email, password }, false);
  if (res.status === 200 && (res.data?.data?.tokens?.accessToken || res.data?.tokens?.accessToken)) {
    authToken = res.data?.data?.tokens?.accessToken ?? res.data?.tokens?.accessToken;
    return true;
  }
  return false;
}

async function main() {
  console.log('\n=== Test Config Dropdowns & Employee ===\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Token: ${authToken ? '***' + authToken.slice(-4) : '(not set)'}\n`);

  if (!authToken) {
    console.log('Attempting login (Config or HRMS)...');
    const ok = await login();
    if (ok) {
      console.log('Login OK, token acquired.\n');
    } else {
      console.log('Login failed. Set TOKEN, or AUTH_USERNAME+AUTH_PASSWORD (and COMPANY_ID for Config).\n');
    }
  }
  if (!authToken) {
    console.log('⚠️  No token. Set TOKEN env or AUTH_USERNAME+AUTH_PASSWORD');
    console.log('   Example: AUTH_USERNAME=admin@example.com AUTH_PASSWORD=Admin@123456 npx ts-node ...\n');
    process.exit(1);
  }

  // Get org for testing - prefer ORGANIZATION_ID, then org with configuratorCompanyId=COMPANY_ID
  const forcedOrgId = process.env.ORGANIZATION_ID;
  let org: any = null;
  if (forcedOrgId) {
    const orgResp = await api('GET', `/api/v1/organizations/${forcedOrgId}`);
    org = orgResp.data?.data?.organization ?? orgResp.data?.organization;
  }
  if (!org) {
    const orgResp = await api('GET', `/api/v1/organizations?page=1&limit=20`);
    const orgs = orgResp.data?.data?.organizations ?? orgResp.data?.organizations ?? [];
    org = orgs.find((o: any) => o.configuratorCompanyId === COMPANY_ID)
      ?? orgs.find((o: any) => o.configuratorCompanyId != null && o.configuratorCompanyId !== 0)
      ?? orgs[0];
  }
  if (!org) {
    console.log('❌ No organization found. Create one and link to Config (configurator_company_id).');
    process.exit(1);
  }
  const orgId = org.id;
  console.log(`Using org: ${org.name} (${orgId}) configuratorCompanyId=${org.configuratorCompanyId ?? 'none'}\n`);

  // 1. Departments (Config API list)
  console.log('1. GET /api/v1/departments?organizationId=...&listView=true&limit=100');
  const deptResp = await api('GET', `/api/v1/departments?organizationId=${orgId}&listView=true&limit=100`);
  const departments = deptResp.data?.data?.departments ?? deptResp.data?.departments ?? [];
  console.log(`   Status: ${deptResp.status} | Count: ${departments.length}`);
  if (departments.length > 0) {
    console.log(`   Sample: ${JSON.stringify(departments[0])}`);
  }
  console.log(deptResp.status === 200 ? '   ✅ PASS' : `   ❌ FAIL: ${JSON.stringify(deptResp.data)}\n`);

  // 2. Sub-departments (Config API list)
  console.log('\n2. GET /api/v1/sub-departments?organizationId=...');
  const subResp = await api('GET', `/api/v1/sub-departments?organizationId=${orgId}`);
  const subDepts = subResp.data?.data?.subDepartments ?? subResp.data?.subDepartments ?? [];
  console.log(`   Status: ${subResp.status} | Count: ${subDepts.length}`);
  if (subDepts.length > 0) {
    console.log(`   Sample: ${JSON.stringify(subDepts[0])}`);
  }
  console.log(subResp.status === 200 ? '   ✅ PASS' : `   ❌ FAIL: ${JSON.stringify(subResp.data)}\n`);

  // 3. Cost Centres (Config API list)
  console.log('\n3. GET /api/v1/cost-centres?organizationId=...');
  const ccResp = await api('GET', `/api/v1/cost-centres?organizationId=${orgId}`);
  const costCentres = ccResp.data?.data?.costCentres ?? ccResp.data?.costCentres ?? [];
  console.log(`   Status: ${ccResp.status} | Count: ${costCentres.length}`);
  if (costCentres.length > 0) {
    console.log(`   Sample: ${JSON.stringify(costCentres[0])}`);
  }
  console.log(ccResp.status === 200 ? '   ✅ PASS' : `   ❌ FAIL: ${JSON.stringify(ccResp.data)}\n`);

  // 4. Employee list
  console.log('\n4. GET /api/v1/employees?organizationId=...&limit=5');
  const empListResp = await api('GET', `/api/v1/employees?organizationId=${orgId}&limit=5`);
  const employees = empListResp.data?.data?.employees ?? empListResp.data?.employees ?? [];
  console.log(`   Status: ${empListResp.status} | Count: ${employees.length}`);
  console.log(empListResp.status === 200 ? '   ✅ PASS' : `   ❌ FAIL: ${JSON.stringify(empListResp.data)}\n`);

  // 5. Employee add (if we have department from Config)
  const deptId = departments[0]?.id;
  const ccId = costCentres[0]?.id;
  const paygroups = await (async () => {
    const r = await api('GET', `/api/v1/paygroups?organizationId=${orgId}`);
    return r.data?.data?.paygroups ?? r.data?.paygroups ?? [];
  })();
  const paygroupId = paygroups[0]?.id;
  const positions = await (async () => {
    const r = await api('GET', `/api/v1/positions?organizationId=${orgId}&limit=50`);
    return r.data?.data?.positions ?? r.data?.positions ?? [];
  })();
  const positionId = positions[0]?.id;

  const testEmail = `test-config-${Date.now()}@example.com`;
  const createPayload = {
    organizationId: orgId,
    firstName: 'TestConfig',
    lastName: 'Employee',
    email: testEmail,
    dateOfJoining: new Date().toISOString().split('T')[0],
    employeeStatus: 'ACTIVE',
    ...(deptId && { departmentId: String(deptId) }),
    ...(ccId && { costCentreId: String(ccId) }),
    ...(paygroupId && { paygroupId }),
    ...(positionId && { positionId }),
  };

  console.log('\n5. POST /api/v1/employees (with Config department/costcentre ids)');
  console.log(`   Payload: ${JSON.stringify(createPayload, null, 2).split('\n').join('\n   ')}`);
  const createResp = await api('POST', '/api/v1/employees', createPayload);
  console.log(`   Status: ${createResp.status}`);
  let createdEmpId: string | null = null;
  if (createResp.status === 201) {
    const emp = createResp.data?.data?.employee ?? createResp.data?.employee;
    createdEmpId = emp?.id;
    console.log(`   Created: ${emp?.employeeCode} ${emp?.firstName} ${emp?.lastName}`);
    console.log(`   departmentConfiguratorId: ${emp?.departmentConfiguratorId ?? 'n/a'}`);
    console.log(`   costCentreConfiguratorId: ${emp?.costCentreConfiguratorId ?? 'n/a'}`);
    console.log('   ✅ PASS');
  } else {
    console.log(`   ❌ FAIL: ${JSON.stringify(createResp.data)}`);
    console.log('   Note: If "Department/Cost centre not found in HRMS", run: npm run sync:config-to-hrms');
  }

  // 6. Employee edit (if we created one or have existing)
  const empIdForEdit = createdEmpId ?? (employees[0]?.id);
  if (empIdForEdit) {
    console.log('\n6. PUT /api/v1/employees/:id (edit with Config department/costcentre ids)');
    const updatePayload: any = {
      firstName: 'TestConfigUpdated',
      lastName: 'EmployeeEdit',
      ...(deptId && { departmentId: String(deptId) }),
      ...(ccId && { costCentreId: String(ccId) }),
    };
    const updateResp = await api('PUT', `/api/v1/employees/${empIdForEdit}`, updatePayload);
    console.log(`   Status: ${updateResp.status}`);
    if (updateResp.status === 200) {
      const emp = updateResp.data?.data?.employee ?? updateResp.data?.employee;
      console.log(`   Updated: ${emp?.firstName} ${emp?.lastName}`);
      console.log('   ✅ PASS');
    } else {
      console.log(`   ❌ FAIL: ${JSON.stringify(updateResp.data)}`);
    }
  } else {
    console.log('\n6. PUT /api/v1/employees/:id - SKIP (no employee to edit)');
  }

  console.log('\n=== Done ===\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
