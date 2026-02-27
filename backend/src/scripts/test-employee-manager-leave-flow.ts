/**
 * End-to-end API test for:
 * 1) Employee applies Leave / Permission / WFH
 * 2) Manager approves requests
 * 3) Approved requests are visible in leave calendar
 * 4) Employee applies Forgot Punch (attendance regularization)
 * 5) Manager approves regularization
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/scripts/test-employee-manager-leave-flow.ts
 */

import axios, { AxiosRequestConfig, Method } from 'axios';
import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

type HttpResult = { status: number; data: any };

type TestStep = {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
};

const steps: TestStep[] = [];

function logStep(name: string, status: TestStep['status'], details: string) {
  steps.push({ name, status, details });
  const icon = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'SKIP';
  console.log(`[${icon}] ${name} -> ${details}`);
}

async function apiCall(
  method: Method,
  path: string,
  token?: string,
  data?: unknown
): Promise<HttpResult> {
  const config: AxiosRequestConfig = {
    method,
    url: `${API_BASE}${path}`,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    data,
    validateStatus: () => true,
  };
  const res = await axios(config);
  return { status: res.status, data: res.data };
}

function fmtDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function login(email: string, password: string): Promise<{ ok: boolean; token?: string; body?: any }> {
  const res = await apiCall('POST', '/auth/login', undefined, { email, password });
  if (res.status !== 200) return { ok: false, body: res.data };
  const body = res.data?.data || res.data;
  const token = body?.tokens?.accessToken || body?.token;
  if (!token) return { ok: false, body: res.data };
  return { ok: true, token, body };
}

function pickLeaveTypeByKeywords(
  leaveTypes: Array<{ id: string; name: string }>,
  keywords: string[]
): { id: string; name: string } | null {
  const normalized = leaveTypes.map((lt) => ({
    ...lt,
    n: lt.name.toLowerCase().replace(/\s+/g, ' ').trim(),
  }));
  for (const keyword of keywords) {
    const k = keyword.toLowerCase();
    const found = normalized.find((lt) => lt.n.includes(k));
    if (found) return { id: found.id, name: found.name };
  }
  return null;
}

async function ensureLeaveTypeFromAttendanceComponent(
  organizationId: string,
  keywords: string[]
): Promise<{ id: string; name: string } | null> {
  const existing = await prisma.leaveType.findFirst({
    where: {
      organizationId,
      OR: keywords.map((k) => ({
        name: { contains: k, mode: 'insensitive' },
      })),
    },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  const component = await prisma.attendanceComponent.findFirst({
    where: {
      organizationId,
      OR: keywords.flatMap((k) => ([
        { eventName: { contains: k, mode: 'insensitive' } },
        { shortName: { contains: k, mode: 'insensitive' } },
      ])),
    },
    select: { eventName: true, shortName: true },
  });
  if (!component?.eventName) return null;

  const created = await prisma.leaveType.create({
    data: {
      organizationId,
      name: component.eventName.trim(),
      code: component.shortName?.trim() || null,
      isPaid: true,
      isActive: true,
      canBeNegative: true,
    },
    select: { id: true, name: true },
  });
  return created;
}

async function applyAndApproveLeave(params: {
  employeeToken: string;
  managerToken: string;
  organizationId: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  date: string;
  reason: string;
}): Promise<{ ok: boolean; requestId?: string; reason?: string }> {
  let chosenDate = params.date;
  let createRes: HttpResult | null = null;
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(params.date);
    d.setDate(d.getDate() + i);
    chosenDate = fmtDate(d);
    createRes = await apiCall('POST', '/leaves/requests', params.employeeToken, {
      leaveTypeId: params.leaveTypeId,
      startDate: chosenDate,
      endDate: chosenDate,
      totalDays: 1,
      reason: params.reason,
    });
    if (createRes.status === 201) break;
    const msg = String(createRes.data?.message || '').toLowerCase();
    const retryable = msg.includes('already have a') || msg.includes('week-off') || msg.includes('holiday');
    if (!retryable) break;
  }

  if (!createRes) {
    return { ok: false, reason: 'apply did not execute' };
  }

  if (createRes.status !== 201) {
    return {
      ok: false,
      reason: `apply failed (${createRes.status}): ${JSON.stringify(createRes.data?.message || createRes.data)}`,
    };
  }

  const request = createRes.data?.data?.leaveRequest || createRes.data?.leaveRequest || createRes.data?.data;
  const requestId: string | undefined = request?.id;
  if (!requestId) {
    return { ok: false, reason: 'apply succeeded but leave request id missing' };
  }

  const approveRes = await apiCall('PUT', `/leaves/requests/${requestId}/approve`, params.managerToken, {
    reviewComments: `Approved in E2E test for ${params.leaveTypeName}`,
  });

  if (approveRes.status !== 200) {
    return {
      ok: false,
      requestId,
      reason: `approve failed (${approveRes.status}): ${JSON.stringify(approveRes.data?.message || approveRes.data)}`,
    };
  }

  const calRes = await apiCall(
    'GET',
    `/leaves/calendar?organizationId=${params.organizationId}&startDate=${chosenDate}&endDate=${chosenDate}`,
    params.managerToken
  );
  if (calRes.status !== 200) {
    return {
      ok: false,
      requestId,
      reason: `calendar fetch failed (${calRes.status}): ${JSON.stringify(calRes.data?.message || calRes.data)}`,
    };
  }
  const leaveRequests = calRes.data?.data?.leaveRequests || [];
  const reflected = Array.isArray(leaveRequests) && leaveRequests.some((r: any) => r.id === requestId);
  if (!reflected) {
    return {
      ok: false,
      requestId,
      reason: 'approved request not found in leave calendar for that date',
    };
  }

  return { ok: true, requestId };
}

async function applyAndApproveForgotPunch(params: {
  employeeToken: string;
  managerToken: string;
  targetDate: string;
}): Promise<{ ok: boolean; regularizationId?: string; reason?: string }> {
  const randomRecordId = '11111111-1111-1111-1111-111111111111';
  let chosenDate = params.targetDate;
  let createRes: HttpResult | null = null;

  // Try a few dates in case one date already has approved/pending regularization.
  for (let i = 0; i < 10; i += 1) {
    const d = new Date(params.targetDate);
    d.setDate(d.getDate() - i);
    chosenDate = fmtDate(d);
    createRes = await apiCall('POST', '/attendance/regularization', params.employeeToken, {
      attendanceRecordId: randomRecordId,
      date: chosenDate,
      checkIn: `${chosenDate}T09:15:00`,
      checkOut: `${chosenDate}T18:05:00`,
      reason: 'Forgot punch test request from automated E2E flow',
    });
    if (createRes.status === 201) break;
    const msg = String(createRes.data?.message || '');
    if (!msg.includes('pending or approved regularization')) break;
  }

  if (!createRes) {
    return { ok: false, reason: 'forgot punch apply did not execute' };
  }

  if (createRes.status !== 201) {
    return {
      ok: false,
      reason: `forgot punch apply failed (${createRes.status}): ${JSON.stringify(createRes.data?.message || createRes.data)}`,
    };
  }

  const regularization = createRes.data?.data?.regularization || createRes.data?.regularization || createRes.data?.data;
  const regularizationId: string | undefined = regularization?.id;
  if (!regularizationId) {
    return { ok: false, reason: 'forgot punch apply succeeded but id missing' };
  }

  const approveRes = await apiCall('PUT', `/attendance/regularization/${regularizationId}/approve`, params.managerToken, {
    reviewComments: 'Approved in automated E2E flow',
  });
  if (approveRes.status !== 200) {
    return {
      ok: false,
      regularizationId,
      reason: `forgot punch approve failed (${approveRes.status}): ${JSON.stringify(approveRes.data?.message || approveRes.data)}`,
    };
  }

  const getRes = await apiCall('GET', `/attendance/regularization/${regularizationId}`, params.managerToken);
  if (getRes.status !== 200) {
    return {
      ok: false,
      regularizationId,
      reason: `forgot punch fetch failed (${getRes.status}): ${JSON.stringify(getRes.data?.message || getRes.data)}`,
    };
  }
  const current = getRes.data?.data?.regularization || getRes.data?.regularization || getRes.data?.data;
  if (current?.status !== 'APPROVED') {
    return {
      ok: false,
      regularizationId,
      reason: `forgot punch status is ${current?.status || 'UNKNOWN'} instead of APPROVED`,
    };
  }

  return { ok: true, regularizationId };
}

async function main() {
  console.log('\n=== Employee -> Manager Approval E2E Test ===');
  console.log(`API base: ${API_BASE}\n`);

  const candidates = await prisma.employee.findMany({
    where: {},
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      userId: true,
      reportingManagerId: true,
    },
    orderBy: [{ firstName: 'asc' }],
    take: 300,
  });

  const allLeaveTypes = await prisma.leaveType.findMany({
    select: { id: true, name: true, organizationId: true },
  });
  const leaveTypesByOrg = new Map<string, { names: string[]; count: number }>();
  for (const lt of allLeaveTypes) {
    const rec = leaveTypesByOrg.get(lt.organizationId) || { names: [], count: 0 };
    rec.names.push(lt.name.toLowerCase());
    rec.count += 1;
    leaveTypesByOrg.set(lt.organizationId, rec);
  }

  const orgEntries = Array.from(leaveTypesByOrg.entries()).sort((a, b) => b[1].count - a[1].count);
  if (orgEntries.length === 0) {
    throw new Error('No leave types available in any organization');
  }

  const targetOrgId = orgEntries[0][0];
  const orgEmployees = candidates.filter((e) => e.organizationId === targetOrgId && typeof e.userId === 'string' && e.userId.length > 0);
  if (orgEmployees.length < 2) {
    throw new Error(`Not enough user-linked employees in org ${targetOrgId} to build manager flow`);
  }

  const candidate = orgEmployees.find((e) => !!e.reportingManagerId && orgEmployees.some((m) => m.id === e.reportingManagerId)) || orgEmployees[0];
  let managerEmployee = candidate.reportingManagerId
    ? orgEmployees.find((m) => m.id === candidate.reportingManagerId) || null
    : null;

  if (!managerEmployee) {
    managerEmployee = orgEmployees.find((m) => m.id !== candidate.id) || null;
    if (!managerEmployee) {
      throw new Error('Unable to choose manager employee');
    }
    await prisma.employee.update({
      where: { id: candidate.id },
      data: { reportingManagerId: managerEmployee.id },
    });
  }

  const employeeUser = await prisma.user.findUnique({ where: { id: candidate.userId as string } });
  const managerUser = await prisma.user.findUnique({ where: { id: managerEmployee.userId as string } });
  if (!employeeUser?.email || !managerUser?.email) {
    throw new Error('Selected employee/manager user is missing email');
  }

  let managerRole = managerUser.role as UserRole;
  if (!['MANAGER', 'HR_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(managerRole)) {
    await prisma.user.update({
      where: { id: managerUser.id },
      data: { role: 'MANAGER' },
    });
    managerRole = 'MANAGER';
  }

  const organizationId = targetOrgId;

  const employeePassword = 'EmpFlow@123';
  const managerPassword = 'MgrFlow@123';

  await prisma.user.update({
    where: { id: employeeUser.id },
    data: {
      passwordHash: await hashPassword(employeePassword),
      refreshToken: null,
    },
  });
  await prisma.user.update({
    where: { id: managerUser.id },
    data: {
      passwordHash: await hashPassword(managerPassword),
      refreshToken: null,
    },
  });

  logStep(
    'Credentials prepared',
    'PASS',
    `employee=${employeeUser.email}, manager=${managerUser.email} (${managerRole})`
  );

  const employeeLogin = await login(employeeUser.email, employeePassword);
  if (!employeeLogin.ok || !employeeLogin.token) {
    throw new Error(`Employee login failed: ${JSON.stringify(employeeLogin.body)}`);
  }
  logStep('Employee login', 'PASS', employeeUser.email);

  const managerLogin = await login(managerUser.email, managerPassword);
  if (!managerLogin.ok || !managerLogin.token) {
    throw new Error(`Manager login failed: ${JSON.stringify(managerLogin.body)}`);
  }
  logStep('Manager login', 'PASS', `${managerUser.email} (${managerRole})`);

  const permissionEnsured = await ensureLeaveTypeFromAttendanceComponent(organizationId, ['permission']);
  if (permissionEnsured) {
    logStep('Permission leave type mapping', 'PASS', `Available as ${permissionEnsured.name}`);
  } else {
    logStep('Permission leave type mapping', 'SKIP', 'No attendance component found to map');
  }

  const wfhEnsured = await ensureLeaveTypeFromAttendanceComponent(organizationId, ['work from home', 'wfh']);
  if (wfhEnsured) {
    logStep('WFH leave type mapping', 'PASS', `Available as ${wfhEnsured.name}`);
  } else {
    logStep('WFH leave type mapping', 'SKIP', 'No attendance component found to map');
  }

  const typesRes = await apiCall('GET', `/leaves/types?organizationId=${organizationId}&limit=200`, employeeLogin.token);
  if (typesRes.status !== 200) {
    throw new Error(`Leave types fetch failed: ${typesRes.status} ${JSON.stringify(typesRes.data)}`);
  }
  const leaveTypes: Array<{ id: string; name: string }> =
    typesRes.data?.data?.leaveTypes ||
    typesRes.data?.leaveTypes ||
    [];

  const leaveType = pickLeaveTypeByKeywords(leaveTypes, ['earned leave', 'sick leave', 'casual leave', 'leave']);
  const permissionType = pickLeaveTypeByKeywords(leaveTypes, ['permission']);
  const wfhType = pickLeaveTypeByKeywords(leaveTypes, ['work from home', 'wfh']);

  if (!leaveType) {
    logStep('Leave type selection', 'FAIL', 'No generic leave type found');
  } else {
    logStep('Leave type selection', 'PASS', `Using ${leaveType.name}`);
  }
  if (!permissionType) {
    logStep('Permission type selection', 'SKIP', 'Permission leave type not found');
  } else {
    logStep('Permission type selection', 'PASS', `Using ${permissionType.name}`);
  }
  if (!wfhType) {
    logStep('WFH type selection', 'SKIP', 'Work from Home leave type not found');
  } else {
    logStep('WFH type selection', 'PASS', `Using ${wfhType.name}`);
  }

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + 5);
  const leaveDate = fmtDate(baseDate);
  const permissionDate = fmtDate(new Date(baseDate.getTime() + 24 * 3600 * 1000));
  const wfhDate = fmtDate(new Date(baseDate.getTime() + 2 * 24 * 3600 * 1000));
  const forgotPunchDate = fmtDate(new Date(baseDate.getTime() - 2 * 24 * 3600 * 1000));

  if (leaveType) {
    const result = await applyAndApproveLeave({
      employeeToken: employeeLogin.token,
      managerToken: managerLogin.token,
      organizationId,
      employeeId: candidate.id,
      leaveTypeId: leaveType.id,
      leaveTypeName: leaveType.name,
      date: leaveDate,
      reason: 'Applying leave for end to end manager approval test flow',
    });
    logStep(
      'Employee Leave -> Manager Approve -> Calendar reflect',
      result.ok ? 'PASS' : 'FAIL',
      result.ok ? `requestId=${result.requestId}` : result.reason || 'Unknown error'
    );
  } else {
    logStep('Employee Leave -> Manager Approve -> Calendar reflect', 'SKIP', 'No leave type found');
  }

  if (permissionType) {
    const result = await applyAndApproveLeave({
      employeeToken: employeeLogin.token,
      managerToken: managerLogin.token,
      organizationId,
      employeeId: candidate.id,
      leaveTypeId: permissionType.id,
      leaveTypeName: permissionType.name,
      date: permissionDate,
      reason: 'Applying permission for end to end manager approval test flow',
    });
    logStep(
      'Employee Permission -> Manager Approve -> Calendar reflect',
      result.ok ? 'PASS' : 'FAIL',
      result.ok ? `requestId=${result.requestId}` : result.reason || 'Unknown error'
    );
  } else {
    logStep('Employee Permission -> Manager Approve -> Calendar reflect', 'SKIP', 'Permission type not found');
  }

  if (wfhType) {
    const result = await applyAndApproveLeave({
      employeeToken: employeeLogin.token,
      managerToken: managerLogin.token,
      organizationId,
      employeeId: candidate.id,
      leaveTypeId: wfhType.id,
      leaveTypeName: wfhType.name,
      date: wfhDate,
      reason: 'Applying WFH for end to end manager approval test flow',
    });
    logStep(
      'Employee WFH -> Manager Approve -> Calendar reflect',
      result.ok ? 'PASS' : 'FAIL',
      result.ok ? `requestId=${result.requestId}` : result.reason || 'Unknown error'
    );
  } else {
    logStep('Employee WFH -> Manager Approve -> Calendar reflect', 'SKIP', 'WFH type not found');
  }

  const forgotPunchResult = await applyAndApproveForgotPunch({
    employeeToken: employeeLogin.token,
    managerToken: managerLogin.token,
    targetDate: forgotPunchDate,
  });
  logStep(
    'Employee Forgot Punch -> Manager Approve',
    forgotPunchResult.ok ? 'PASS' : 'FAIL',
    forgotPunchResult.ok
      ? `regularizationId=${forgotPunchResult.regularizationId}`
      : forgotPunchResult.reason || 'Unknown error'
  );

  console.log('\n--- Detailed Result Summary ---');
  for (const step of steps) {
    console.log(`- ${step.status}: ${step.name} :: ${step.details}`);
  }

  const passCount = steps.filter((s) => s.status === 'PASS').length;
  const failCount = steps.filter((s) => s.status === 'FAIL').length;
  const skipCount = steps.filter((s) => s.status === 'SKIP').length;
  console.log(`\nTotal: ${steps.length}, PASS: ${passCount}, FAIL: ${failCount}, SKIP: ${skipCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: any) => {
    console.error('\nFatal error in E2E flow test:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
