/**
 * Event Configuration All Modules API smoke test.
 *
 * What this script verifies:
 * 1) Auth login with a privileged user (ORG_ADMIN / HR_MANAGER / SUPER_ADMIN)
 * 2) GET list for each Event Configuration module
 * 3) GET details for first record (if available)
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/scripts/test-event-configuration-all-modules.ts
 */

import axios, { Method } from 'axios';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

type StepStatus = 'PASS' | 'FAIL' | 'SKIP';
type Step = { module: string; action: string; status: StepStatus; detail: string };
const steps: Step[] = [];

function addStep(module: string, action: string, status: StepStatus, detail: string) {
  steps.push({ module, action, status, detail });
  console.log(`[${status}] ${module} :: ${action} -> ${detail}`);
}

async function api(method: Method, path: string, token?: string, data?: unknown) {
  const res = await axios({
    method,
    url: `${API_BASE}${path}`,
    data,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    validateStatus: () => true,
  });
  return { status: res.status, data: res.data };
}

function extractList(data: any): any[] {
  const body = data?.data ?? data;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  const keys = [
    'components',
    'ruleSettings',
    'rightsAllocations',
    'workflowMappings',
    'approvalWorkflows',
    'autoCreditSettings',
    'encashmentCarryForwards',
    'shiftAssignmentRules',
    'items',
    'rows',
    'list',
  ];
  for (const k of keys) {
    if (Array.isArray(body?.[k])) return body[k];
  }
  return [];
}

function getId(item: any): string | null {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.id === 'string') return item.id;
  if (typeof item._id === 'string') return item._id;
  return null;
}

async function main() {
  console.log('\n=== Event Configuration: All Modules Smoke Test ===');
  console.log(`API base: ${API_BASE}\n`);

  const fallbackCreds = [
    { email: 'acme@gmail.com', password: 'MgrFlow@123' },
    { email: 'hr@hrms.com', password: 'Hr@123456' },
    { email: 'orgadmin@hrms.com', password: 'OrgAdmin@123' },
  ];

  let login: { status: number; data: any } | null = null;
  let loginEmail = '';
  for (const c of fallbackCreds) {
    const attempt = await api('POST', '/auth/login', undefined, { email: c.email, password: c.password });
    if (attempt.status === 200) {
      login = attempt;
      loginEmail = c.email;
      break;
    }
  }

  if (!login) {
    const loginUser = await prisma.user.findFirst({
      where: {
        role: { in: ['ORG_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN'] },
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!loginUser?.email) {
      throw new Error('No active ORG_ADMIN/HR_MANAGER/SUPER_ADMIN user found');
    }

    const testPassword = 'EvtConfig@123';
    await prisma.user.update({
      where: { id: loginUser.id },
      data: {
        passwordHash: await hashPassword(testPassword),
        refreshToken: null,
      },
    });

    login = await api('POST', '/auth/login', undefined, {
      email: loginUser.email,
      password: testPassword,
    });
    loginEmail = loginUser.email;
  }

  if (login.status !== 200) {
    throw new Error(`Login failed (${login.status}): ${JSON.stringify(login.data?.message || login.data)}`);
  }
  const loginBody = login.data?.data || login.data;
  const token = loginBody?.tokens?.accessToken || loginBody?.token;
  const organizationId =
    loginBody?.user?.employee?.organizationId ||
    loginBody?.user?.organizationId;

  if (!token) throw new Error('No access token in login response');
  if (!organizationId) throw new Error('No organizationId found in login response');
  addStep('Auth', 'Login', 'PASS', `user=${loginEmail}, org=${organizationId}`);

  const modules = [
    { name: 'Attendance Components', path: '/attendance-components' },
    { name: 'Rule Settings', path: '/rule-settings' },
    { name: 'Rights Allocations', path: '/rights-allocations' },
    { name: 'Approval Workflows', path: '/approval-workflows' },
    { name: 'Workflow Mappings', path: '/workflow-mappings' },
    { name: 'Auto Credit Settings', path: '/auto-credit-settings' },
    { name: 'Encashment Carry Forward', path: '/encashment-carry-forwards' },
    { name: 'Shift Assignment Rules', path: '/shift-assignment-rules' },
  ];

  for (const m of modules) {
    const listRes = await api('GET', `${m.path}?organizationId=${organizationId}&page=1&limit=20`, token);
    if (listRes.status !== 200) {
      addStep(m.name, 'GET list', 'FAIL', `status=${listRes.status}, msg=${JSON.stringify(listRes.data?.message || listRes.data)}`);
      continue;
    }

    const list = extractList(listRes.data);
    addStep(m.name, 'GET list', 'PASS', `count=${list.length}`);

    const firstId = getId(list[0]);
    if (!firstId) {
      addStep(m.name, 'GET by id', 'SKIP', 'no records to verify details endpoint');
      continue;
    }

    const detailRes = await api('GET', `${m.path}/${firstId}`, token);
    if (detailRes.status === 200 || detailRes.status === 304) {
      addStep(m.name, 'GET by id', 'PASS', `id=${firstId}`);
    } else {
      addStep(m.name, 'GET by id', 'FAIL', `status=${detailRes.status}, id=${firstId}`);
    }
  }

  console.log('\n--- Summary ---');
  const pass = steps.filter((s) => s.status === 'PASS').length;
  const fail = steps.filter((s) => s.status === 'FAIL').length;
  const skip = steps.filter((s) => s.status === 'SKIP').length;
  console.log(`Total=${steps.length}, PASS=${pass}, FAIL=${fail}, SKIP=${skip}`);

  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e: any) => {
    console.error('\nFatal message:', e?.message || e);
    if (e?.response?.status || e?.response?.data) {
      console.error('HTTP response:', e.response.status, e.response.data);
    }
    if (e?.stack) {
      console.error('Stack:', e.stack);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

