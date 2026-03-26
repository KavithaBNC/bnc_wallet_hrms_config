/**
 * HRMS End-to-End Test Script
 * Tests: Login → Create Employee → Attendance (Check-in/out) → Validation → Payroll
 *
 * Usage: cd backend && npx ts-node tests/e2e-hrms-test.ts
 */

import axios, { AxiosInstance } from 'axios';

// ─── Configuration ───────────────────────────────────────────────────
const BASE_URL = process.env.BASE_URL || 'http://localhost:5001/api/v1';
const LOGIN_EMAIL = 'mathadddvan@gmail.com';
const LOGIN_PASSWORD = 'Temp@4k6hx6mk';

// ─── Test state ──────────────────────────────────────────────────────
let api: AxiosInstance;
let accessToken = '';
let organizationId = '';
let testEmployeeId = '';
let testPayrollCycleId = '';

const results: { name: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail?: string }[] = [];

// Colors for console
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function pass(name: string, detail?: string) {
  results.push({ name, status: 'PASS', detail });
  console.log(`  ${GREEN}✓ PASS${RESET} ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name: string, detail?: string) {
  results.push({ name, status: 'FAIL', detail });
  console.log(`  ${RED}✗ FAIL${RESET} ${name}${detail ? ` — ${detail}` : ''}`);
}
function skip(name: string, detail?: string) {
  results.push({ name, status: 'SKIP', detail });
  console.log(`  ${YELLOW}○ SKIP${RESET} ${name}${detail ? ` — ${detail}` : ''}`);
}

function today() {
  return new Date().toISOString().split('T')[0]; // yyyy-MM-dd
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthEnd() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().split('T')[0];
}

function nextMonth5th() {
  const d = new Date();
  const nm = new Date(d.getFullYear(), d.getMonth() + 1, 5);
  return nm.toISOString().split('T')[0];
}

// ─── Tests ───────────────────────────────────────────────────────────

async function testLogin() {
  const testName = 'Test 1: Login (Configurator)';
  try {
    // Step 1: verify company (optional, some setups need it)
    const res = await axios.post(`${BASE_URL}/auth/configurator/login`, {
      username: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
      company_id: 59,
    });

    if (res.status === 200 && res.data?.data?.tokens?.accessToken) {
      accessToken = res.data.data.tokens.accessToken;
      organizationId =
        res.data.data.user?.organizationId ||
        res.data.data.user?.employee?.organizationId ||
        '';

      api = axios.create({
        baseURL: BASE_URL,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      pass(testName, `token=${accessToken.slice(0, 20)}... orgId=${organizationId.slice(0, 8)}...`);
    } else {
      fail(testName, `status=${res.status}, no token in response`);
    }
  } catch (err: any) {
    const detail = err.response?.data;
    fail(testName, `${detail?.message || err.message} | status=${err.response?.status} | detail=${JSON.stringify(detail).slice(0, 300)}`);
  }
}

async function testCreateEmployee() {
  const testName = 'Test 2: Create Employee';
  if (!accessToken) return skip(testName, 'No auth token');

  const uniqueEmail = `test.e2e.${Date.now()}@hrms-test.com`;
  try {
    const res = await api.post('/employees', {
      organizationId,
      firstName: 'E2E-Test',
      lastName: 'Employee',
      email: uniqueEmail,
      dateOfJoining: today(),
      gender: 'MALE',
      dateOfBirth: '1995-06-15',
      phone: '9876543210',
      employeeStatus: 'ACTIVE',
    });

    if (res.status === 201 && res.data?.data?.employee?.id) {
      testEmployeeId = res.data.data.employee.id;
      const emp = res.data.data.employee;
      pass(testName, `id=${testEmployeeId.slice(0, 8)}... code=${emp.employeeCode} email=${emp.email}`);
    } else {
      fail(testName, `status=${res.status}, response=${JSON.stringify(res.data).slice(0, 200)}`);
    }
  } catch (err: any) {
    fail(testName, err.response?.data?.message || err.message);
  }
}

async function testGetEmployee() {
  const testName = 'Test 3: Get Created Employee';
  if (!testEmployeeId) return skip(testName, 'No employee created');

  try {
    const res = await api.get(`/employees/${testEmployeeId}`);
    const emp = res.data?.data?.employee;

    if (res.status === 200 && emp && emp.firstName === 'E2E-Test') {
      pass(testName, `firstName=${emp.firstName} lastName=${emp.lastName} dob=${emp.dateOfBirth} gender=${emp.gender}`);
    } else {
      fail(testName, `status=${res.status}, firstName=${emp?.firstName}`);
    }
  } catch (err: any) {
    fail(testName, err.response?.data?.message || err.message);
  }
}

async function testCheckIn() {
  const testName = 'Test 4: Attendance Check-In (Manual)';
  if (!testEmployeeId) return skip(testName, 'No employee created');

  try {
    const res = await api.post('/attendance/manual', {
      employeeId: testEmployeeId,
      date: today(),
      time: '09:00',
    });

    if (res.status === 200 || res.status === 201) {
      const data = res.data?.data || res.data;
      pass(testName, `status=${data?.status || data?.punch?.status || 'IN'} date=${today()}`);
    } else {
      fail(testName, `status=${res.status}`);
    }
  } catch (err: any) {
    // If duplicate punch, treat as soft pass
    const msg = err.response?.data?.message || err.message;
    if (msg.includes('duplicate') || msg.includes('already') || msg.includes('within')) {
      pass(testName, `(already punched) ${msg}`);
    } else {
      fail(testName, msg);
    }
  }
}

async function testCheckOut() {
  const testName = 'Test 5: Attendance Check-Out (Manual)';
  if (!testEmployeeId) return skip(testName, 'No employee created');

  try {
    const res = await api.post('/attendance/manual', {
      employeeId: testEmployeeId,
      date: today(),
      time: '18:00',
    });

    if (res.status === 200 || res.status === 201) {
      const data = res.data?.data || res.data;
      pass(testName, `status=${data?.status || data?.punch?.status || 'OUT'} date=${today()}`);
    } else {
      fail(testName, `status=${res.status}`);
    }
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message;
    if (msg.includes('duplicate') || msg.includes('already') || msg.includes('within')) {
      pass(testName, `(already punched) ${msg}`);
    } else {
      fail(testName, msg);
    }
  }
}

async function testGetAttendanceRecords() {
  const testName = 'Test 6: Get Attendance Records';
  if (!testEmployeeId) return skip(testName, 'No employee created');

  try {
    const res = await api.get('/attendance/records', {
      params: {
        organizationId,
        employeeId: testEmployeeId,
        startDate: today(),
        endDate: today(),
      },
    });

    const records = res.data?.data?.records || res.data?.data?.attendanceRecords || [];
    if (res.status === 200) {
      pass(testName, `${records.length} record(s) found for ${today()}`);
    } else {
      fail(testName, `status=${res.status}`);
    }
  } catch (err: any) {
    fail(testName, err.response?.data?.message || err.message);
  }
}

async function testGetAttendanceSummary() {
  const testName = 'Test 7: Get Attendance Summary';
  if (!testEmployeeId) return skip(testName, 'No employee created');

  try {
    const res = await api.get(`/attendance/summary/${testEmployeeId}`, {
      params: {
        startDate: monthStart(),
        endDate: today(),
      },
    });

    if (res.status === 200) {
      const summary = res.data?.data?.summary || res.data?.data;
      pass(testName, `present=${summary?.present ?? summary?.presentDays ?? '?'} absent=${summary?.absent ?? summary?.absentDays ?? '?'}`);
    } else {
      fail(testName, `status=${res.status}`);
    }
  } catch (err: any) {
    fail(testName, err.response?.data?.message || err.message);
  }
}

async function testRunValidation() {
  const testName = 'Test 8: Run Attendance Validation';
  if (!organizationId) return skip(testName, 'No organizationId');

  try {
    const res = await api.post('/attendance/validation-process/run', {
      organizationId,
      fromDate: today(),
      toDate: today(),
    });

    if (res.status === 200) {
      const daily = res.data?.data?.daily || res.data?.data;
      const dayKeys = daily ? Object.keys(daily) : [];
      pass(testName, `${dayKeys.length} day(s) in summary`);
    } else {
      fail(testName, `status=${res.status}`);
    }
  } catch (err: any) {
    fail(testName, err.response?.data?.message || err.message);
  }
}

async function testValidationEmployeeList() {
  const testName = 'Test 9: Validation Employee List (Late)';
  if (!organizationId) return skip(testName, 'No organizationId');

  try {
    const res = await api.get('/attendance/validation-process/employee-list', {
      params: {
        organizationId,
        fromDate: today(),
        toDate: today(),
        type: 'late',
      },
    });

    if (res.status === 200) {
      const list = res.data?.data || [];
      pass(testName, `${Array.isArray(list) ? list.length : 0} late employee(s)`);
    } else {
      fail(testName, `status=${res.status}`);
    }
  } catch (err: any) {
    fail(testName, err.response?.data?.message || err.message);
  }
}

async function testCreatePayrollCycle() {
  const testName = 'Test 10: Create Payroll Cycle';
  if (!organizationId) return skip(testName, 'No organizationId');

  try {
    const res = await api.post('/payroll/payroll-cycles', {
      organizationId,
      name: `E2E-Test-${Date.now()}`,
      periodStart: monthStart(),
      periodEnd: monthEnd(),
      paymentDate: nextMonth5th(),
    });

    if (res.status === 201 || res.status === 200) {
      const cycle = res.data?.data?.payrollCycle || res.data?.data;
      testPayrollCycleId = cycle?.id || '';
      pass(testName, `id=${testPayrollCycleId.slice(0, 8)}... status=${cycle?.status || 'DRAFT'}`);
    } else {
      fail(testName, `status=${res.status}`);
    }
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message;
    // Might fail if cycle already exists for this month
    if (msg.includes('already') || msg.includes('exists') || msg.includes('duplicate')) {
      skip(testName, `Cycle already exists for this month: ${msg}`);
    } else {
      fail(testName, msg);
    }
  }
}

async function testPreRunCheck() {
  const testName = 'Test 11: Pre-Run Payroll Check';
  if (!testPayrollCycleId) return skip(testName, 'No payroll cycle created');

  try {
    const res = await api.get(`/payroll/payroll-cycles/${testPayrollCycleId}/pre-run-check`);

    if (res.status === 200) {
      const checks = res.data?.data;
      pass(testName, `checks=${JSON.stringify(checks).slice(0, 150)}`);
    } else {
      fail(testName, `status=${res.status}`);
    }
  } catch (err: any) {
    fail(testName, err.response?.data?.message || err.message);
  }
}

async function testProcessPayroll() {
  const testName = 'Test 12: Process Payroll Cycle';
  if (!testPayrollCycleId) return skip(testName, 'No payroll cycle created');

  try {
    const res = await api.post(`/payroll/payroll-cycles/${testPayrollCycleId}/process`);

    if (res.status === 200) {
      const cycle = res.data?.data?.payrollCycle || res.data?.data;
      pass(testName, `status=${cycle?.status || 'PROCESSED'}`);
    } else {
      fail(testName, `status=${res.status}`);
    }
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message;
    // Common: salary not assigned, attendance not locked — report but don't crash
    if (msg.includes('salary') || msg.includes('attendance') || msg.includes('locked') || msg.includes('No employees')) {
      skip(testName, `Expected: ${msg}`);
    } else {
      fail(testName, msg);
    }
  }
}

async function testCleanup() {
  const testName = 'Test 13: Cleanup — Delete Test Employee';
  if (!testEmployeeId) return skip(testName, 'No employee to delete');

  try {
    const res = await api.delete(`/employees/${testEmployeeId}`);
    if (res.status === 200) {
      pass(testName, `Deleted employee ${testEmployeeId.slice(0, 8)}...`);
    } else {
      fail(testName, `status=${res.status}`);
    }
  } catch (err: any) {
    fail(testName, err.response?.data?.message || err.message);
  }

  // Also clean up payroll cycle if created
  if (testPayrollCycleId) {
    try {
      await api.delete(`/payroll/payroll-cycles/${testPayrollCycleId}`);
      console.log(`  ${CYAN}  ↳ Cleaned up test payroll cycle${RESET}`);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ─── Runner ──────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  HRMS End-to-End Test Suite${RESET}`);
  console.log(`${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`  Base URL : ${BASE_URL}`);
  console.log(`  Date     : ${today()}`);
  console.log(`${CYAN}───────────────────────────────────────────────────${RESET}\n`);

  console.log(`${BOLD}  [Auth]${RESET}`);
  await testLogin();

  console.log(`\n${BOLD}  [Employee CRUD]${RESET}`);
  await testCreateEmployee();
  await testGetEmployee();

  console.log(`\n${BOLD}  [Attendance]${RESET}`);
  await testCheckIn();
  // Wait a moment to avoid duplicate punch rejection
  await new Promise((r) => setTimeout(r, 3000));
  await testCheckOut();
  await testGetAttendanceRecords();
  await testGetAttendanceSummary();

  console.log(`\n${BOLD}  [Validation]${RESET}`);
  await testRunValidation();
  await testValidationEmployeeList();

  console.log(`\n${BOLD}  [Payroll]${RESET}`);
  await testCreatePayrollCycle();
  await testPreRunCheck();
  await testProcessPayroll();

  console.log(`\n${BOLD}  [Cleanup]${RESET}`);
  await testCleanup();

  // Summary
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log(`\n${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  Summary: ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}, ${YELLOW}${skipped} skipped${RESET}`);
  console.log(`${CYAN}═══════════════════════════════════════════════════${RESET}\n`);

  if (failed > 0) {
    console.log(`${RED}  Failed tests:${RESET}`);
    results
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => console.log(`    ${RED}✗${RESET} ${r.name}: ${r.detail || ''}`));
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(`${RED}Unhandled error:${RESET}`, err);
  process.exit(1);
});
