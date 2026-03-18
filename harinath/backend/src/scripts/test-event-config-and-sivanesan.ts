/**
 * Test all Event Configuration modules and (optionally) Sivanesan employee.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/test-event-config-and-sivanesan.ts
 * Requires: Backend running on http://localhost:5000
 */

import axios from 'axios';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

interface TestResult {
  module: string;
  endpoint: string;
  status: 'PASS' | 'FAIL';
  statusCode: number;
  count?: number;
  message: string;
}

const results: TestResult[] = [];
let token = '';
let organizationId = '';

function log(module: string, endpoint: string, status: 'PASS' | 'FAIL', statusCode: number, message: string, count?: number) {
  const icon = status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`  [${icon}] ${endpoint} -> ${statusCode} ${message}${count !== undefined ? ` (count: ${count})` : ''}`);
  results.push({ module, endpoint, status, statusCode, message, count });
}

async function api(method: 'GET' | 'POST', url: string, data?: any): Promise<{ status: number; data: any }> {
  try {
    const config: any = {
      method,
      url: `${API_BASE}${url}`,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (data) config.data = data;
    const res = await axios(config);
    return { status: res.status, data: res.data };
  } catch (e: any) {
    const status = e.response?.status ?? 0;
    const data = e.response?.data ?? { message: e.message || e.code || String(e) };
    return { status, data };
  }
}

async function main() {
  console.log('\n=== Event Configuration Modules Test ===\n');
  console.log('API base:', API_BASE);
  console.log('');

  // 1. Login as HR (has access to Event Config)
  console.log('1. Login (hr@hrms.com)...');
  const loginRes = await api('POST', '/auth/login', {
    email: 'hr@hrms.com',
    password: 'Hr@123456',
  });
  if (loginRes.status !== 200) {
    const errMsg =
      loginRes.status === 0
        ? 'Connection failed. Is the backend running? Try: npm run dev (default http://localhost:5000)'
        : typeof loginRes.data?.message === 'string'
          ? loginRes.data.message
          : loginRes.data?.message || JSON.stringify(loginRes.data || 'Unknown error');
    console.log('   FAIL Login:', loginRes.status, errMsg);
    process.exit(1);
  }
  const data = loginRes.data?.data || loginRes.data;
  token = data?.tokens?.accessToken || data?.token;
  if (!token) {
    console.log('   FAIL No token in response');
    process.exit(1);
  }
  organizationId = data?.user?.employee?.organizationId || data?.user?.organizationId || '';
  if (!organizationId) {
    // Try from employees list
    const empRes = await api('GET', '/employees?limit=1');
    const empList = empRes.data?.data?.employees ?? empRes.data?.employees ?? [];
    if (empList.length && empList[0].organizationId) organizationId = empList[0].organizationId;
  }
  if (!organizationId) {
    console.log('   WARN No organizationId from login; using BNC Motors id from LOGIN_CREDENTIALS');
    organizationId = '781e655a-3764-4395-872d-9f1c601bd3cd';
  }
  console.log('   OK Token and orgId obtained\n');

  // 2. Find Sivanesan
  console.log('2. Find employee "Sivanesan"...');
  const empListRes = await api('GET', `/employees?limit=200&organizationId=${organizationId}`);
  const employees = empListRes.data?.data?.employees ?? empListRes.data?.employees ?? [];
  const sivanesan = employees.find(
    (e: any) =>
      (e.firstName && String(e.firstName).toLowerCase().includes('sivanesan')) ||
      (e.lastName && String(e.lastName).toLowerCase().includes('sivanesan')) ||
      (e.firstName && e.lastName && `${e.firstName} ${e.lastName}`.toLowerCase().includes('sivanesan'))
  );
  if (sivanesan) {
    console.log(`   Found: ${sivanesan.firstName} ${sivanesan.lastName} (${sivanesan.employeeCode}) id=${sivanesan.id}`);
  } else {
    console.log('   Not found. Listing first 3 employees:');
    employees.slice(0, 3).forEach((e: any) => console.log(`     - ${e.firstName} ${e.lastName} (${e.employeeCode})`));
  }
  console.log('');

  // 3. Test all Event Configuration modules (GET list)
  console.log('3. Event Configuration modules (GET list with organizationId)...\n');

  const modules: Array<{ name: string; path: string; listKey?: string }> = [
    { name: 'Attendance Components', path: '/attendance-components', listKey: 'components' },
    { name: 'Rule Settings', path: '/rule-settings', listKey: 'ruleSettings' },
    { name: 'Rights Allocations', path: '/rights-allocations', listKey: 'rightsAllocations' },
    { name: 'Workflow Mappings', path: '/workflow-mappings', listKey: 'workflowMappings' },
    { name: 'Approval Workflows', path: '/approval-workflows', listKey: 'approvalWorkflows' },
    { name: 'Shift Assignment Rules', path: '/shift-assignment-rules', listKey: 'shiftAssignmentRules' },
    { name: 'Auto Credit Settings', path: '/auto-credit-settings', listKey: 'autoCreditSettings' },
    { name: 'Encashment Carry Forward', path: '/encashment-carry-forwards', listKey: 'encashmentCarryForwards' },
  ];

  for (const mod of modules) {
    const q = `?organizationId=${organizationId}`;
    const res = await api('GET', `${mod.path}${q}`);
    let count = 0;
    if (res.status === 200) {
      const body = res.data?.data ?? res.data;
      const list =
        body?.data ?? body?.[mod.listKey!] ?? body?.components ?? body?.list ?? (Array.isArray(body) ? body : []);
      count = Array.isArray(list) ? list.length : (body?.pagination?.total ?? 0);
      log(mod.name, `GET ${mod.path}`, 'PASS', res.status, 'OK', count);
    } else {
      log(mod.name, `GET ${mod.path}`, 'FAIL', res.status, res.data?.message || JSON.stringify(res.data).slice(0, 80));
    }
  }

  // 4. Sivanesan: attendance records + monthly summary (if found)
  if (sivanesan) {
    console.log('4. Sivanesan – attendance and monthly summary...\n');
    const empId = sivanesan.id;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = new Date(y, m, 0);
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const recRes = await api('GET', `/attendance/records?organizationId=${organizationId}&employeeId=${empId}&startDate=${startDate}&endDate=${endStr}`);
    if (recRes.status === 200) {
      const recs = recRes.data?.data?.records ?? recRes.data?.records ?? [];
      log('Attendance (Sivanesan)', 'GET /attendance/records', 'PASS', recRes.status, 'OK', recs.length);
    } else {
      log('Attendance (Sivanesan)', 'GET /attendance/records', 'FAIL', recRes.status, recRes.data?.message || '');
    }

    const sumRes = await api('POST', '/monthly-attendance-summary/build', {
      organizationId,
      employeeId: empId,
      year: y,
      month: m,
    });
    if (sumRes.status === 200) {
      const sum = sumRes.data?.data;
      log(
        'Monthly Summary (Sivanesan)',
        'POST /monthly-attendance-summary/build',
        'PASS',
        sumRes.status,
        sum ? `present=${sum.presentDays} paid=${sum.paidDays}` : 'OK'
      );
    } else {
      log('Monthly Summary (Sivanesan)', 'POST /monthly-attendance-summary/build', 'FAIL', sumRes.status, sumRes.data?.message || '');
    }
    console.log('');
  }

  // 5. Summary
  console.log('--- Summary ---');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  if (failed > 0) {
    results.filter((r) => r.status === 'FAIL').forEach((r) => console.log(`  FAIL ${r.module}: ${r.endpoint} -> ${r.message}`));
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
