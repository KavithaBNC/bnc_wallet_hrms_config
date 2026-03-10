/**
 * seed-acme-demo-data.ts
 * ----------------------
 * Populates Acme Corporation with realistic demo data for every HRMS frontend module.
 *
 * Run: cd backend && npx ts-node --transpile-only src/scripts/seed-acme-demo-data.ts
 *
 * Creates:
 *  • 5 Departments (Engineering, HR, Finance, Sales, Operations)
 *  • 13 Job Positions
 *  • 3 Branches (Chennai, Coimbatore, Bangalore) under one Entity
 *  • 4 Salary Structures (Junior / Mid / Senior / Manager tiers)
 *  • 15 new Employees with bank accounts, salaries, leave balances
 *  • Feb 2026 attendance summaries + individual day records for all new employees
 *  • 4 approved leave requests (Feb 2026) + 3 pending (Mar 2026)
 *  • Resets existing Feb 2026 payroll cycle → re-processes all 16 employees
 *  • Finalizes and marks payroll as PAID
 *
 * Idempotency: Departments/positions/locations/salary structures use findFirst→create.
 * Employees are skipped if their code already exists in the DB.
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';
import { payrollService } from '../services/payroll.service';

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────
const ORG_ID = 'a08c6e1a-5217-4cac-8d61-0c0e4be0e784';
const ADMIN_USER_ID = '7437d8a8-6f94-4c53-9720-b4e4e2a93051';
const FEB_CYCLE_ID = '7312c0ee-9961-4bb2-93ec-1e0ed602dcf5';
const RAJESH_KUMAR_ID = '5d60812e-b9af-460f-a185-e308f27f69d1';
const YEAR = 2026;
const MONTH = 2;
const DEMO_PASSWORD = 'Demo@2024!';

// Feb 2026: Mon 2 → Fri 27 (20 weekdays, 8 weekend days)
const FEB_2026_WEEKDAYS = [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27];

// ──────────────────────────────────────────────────────────────
// Logging
// ──────────────────────────────────────────────────────────────
let passCount = 0;
let skipCount = 0;

function log(step: string, status: 'OK' | 'SKIP' | 'WARN', detail = '') {
  const icon = status === 'OK' ? '✓' : status === 'SKIP' ? '→' : '⚠';
  console.log(`  [${icon}] ${step}${detail ? ': ' + detail : ''}`);
  if (status === 'OK') passCount++;
  else skipCount++;
}

// ──────────────────────────────────────────────────────────────
// Static data
// ──────────────────────────────────────────────────────────────
const DEPT_DATA = [
  { name: 'Engineering', code: 'ENG' },
  { name: 'HR', code: 'HRD' },
  { name: 'Finance', code: 'FIN' },
  { name: 'Sales', code: 'SAL' },
  { name: 'Operations', code: 'OPS' },
];

const POSITION_TITLES = [
  'Senior Engineer', 'Software Engineer', 'Junior Engineer',
  'HR Manager', 'HR Executive',
  'Finance Manager', 'Finance Analyst', 'Accounts Executive',
  'Sales Manager', 'Sales Executive',
  'Operations Manager', 'Operations Analyst', 'Operations Executive',
];

const SALARY_TIERS: Record<string, { basic: number; hra: number; special: number; gross: number }> = {
  junior:  { basic: 20000, hra: 8000,  special: 5000,  gross: 33000  },
  mid:     { basic: 35000, hra: 14000, special: 9000,  gross: 58000  },
  senior:  { basic: 60000, hra: 24000, special: 16000, gross: 100000 },
  manager: { basic: 80000, hra: 32000, special: 20000, gross: 132000 },
};

const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank'];

interface EmpDef {
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  dept: string;
  position: string;
  location: string;
  tier: 'junior' | 'mid' | 'senior' | 'manager';
  pan: string;
  joiningDate: string;
  presentDays: number;
  lopDays: number[];    // Feb day-numbers that are ABSENT (LOP)
  leaveDays: number;    // count of approved paid-leave days
  paidDays: number;     // presentDays + leaveDays
}

const EMPLOYEE_DATA: EmpDef[] = [
  {
    code: 'ACME3',  firstName: 'Arjun',   lastName: 'Sharma',    email: 'arjun.sharma@acme.com',
    dept: 'Engineering', position: 'Senior Engineer',      location: 'Chennai',
    tier: 'senior',  pan: 'ARJNS1234A', joiningDate: '2020-06-15',
    presentDays: 20, lopDays: [],       leaveDays: 0, paidDays: 20,
  },
  {
    code: 'ACME4',  firstName: 'Priya',   lastName: 'Nair',      email: 'priya.nair@acme.com',
    dept: 'Engineering', position: 'Software Engineer',    location: 'Chennai',
    tier: 'mid',     pan: 'PRYNA5678B', joiningDate: '2021-03-01',
    presentDays: 19, lopDays: [],       leaveDays: 1, paidDays: 20, // CL Feb 3
  },
  {
    code: 'ACME5',  firstName: 'Karthik', lastName: 'Rajan',     email: 'karthik.rajan@acme.com',
    dept: 'Engineering', position: 'Software Engineer',    location: 'Chennai',
    tier: 'mid',     pan: 'KRTHR9012C', joiningDate: '2022-01-10',
    presentDays: 20, lopDays: [],       leaveDays: 0, paidDays: 20,
  },
  {
    code: 'ACME6',  firstName: 'Divya',   lastName: 'Menon',     email: 'divya.menon@acme.com',
    dept: 'Engineering', position: 'Junior Engineer',      location: 'Chennai',
    tier: 'junior',  pan: 'DVYMN3456D', joiningDate: '2023-07-01',
    presentDays: 18, lopDays: [4, 5],   leaveDays: 0, paidDays: 18, // LOP Feb 4,5
  },
  {
    code: 'ACME7',  firstName: 'Sunita',  lastName: 'Patel',     email: 'sunita.patel@acme.com',
    dept: 'HR',          position: 'HR Manager',           location: 'Chennai',
    tier: 'senior',  pan: 'SNTPT7890E', joiningDate: '2019-09-01',
    presentDays: 19, lopDays: [],       leaveDays: 1, paidDays: 20, // SL Feb 17
  },
  {
    code: 'ACME8',  firstName: 'Anand',   lastName: 'Kumar',     email: 'anand.kumar@acme.com',
    dept: 'HR',          position: 'HR Executive',         location: 'Chennai',
    tier: 'mid',     pan: 'ANDKM2345F', joiningDate: '2022-05-15',
    presentDays: 19, lopDays: [11],     leaveDays: 0, paidDays: 19, // LOP Feb 11
  },
  {
    code: 'ACME9',  firstName: 'Ramesh',  lastName: 'Iyer',      email: 'ramesh.iyer@acme.com',
    dept: 'Finance',     position: 'Finance Manager',      location: 'Bangalore',
    tier: 'manager', pan: 'RMSHR6789G', joiningDate: '2018-11-01',
    presentDays: 20, lopDays: [],       leaveDays: 0, paidDays: 20,
  },
  {
    code: 'ACME10', firstName: 'Meera',   lastName: 'Krishnan',  email: 'meera.krishnan@acme.com',
    dept: 'Finance',     position: 'Finance Analyst',      location: 'Bangalore',
    tier: 'mid',     pan: 'MRAKN0123H', joiningDate: '2021-08-16',
    presentDays: 19, lopDays: [],       leaveDays: 1, paidDays: 20, // SL Feb 10
  },
  {
    code: 'ACME11', firstName: 'Suresh',  lastName: 'Babu',      email: 'suresh.babu@acme.com',
    dept: 'Finance',     position: 'Accounts Executive',   location: 'Bangalore',
    tier: 'junior',  pan: 'SRSHB4567I', joiningDate: '2023-02-01',
    presentDays: 18, lopDays: [18, 19], leaveDays: 0, paidDays: 18, // LOP Feb 18,19
  },
  {
    code: 'ACME12', firstName: 'Vijay',   lastName: 'Anand',     email: 'vijay.anand@acme.com',
    dept: 'Sales',       position: 'Sales Manager',        location: 'Coimbatore',
    tier: 'senior',  pan: 'VJYND8901J', joiningDate: '2020-01-06',
    presentDays: 19, lopDays: [],       leaveDays: 1, paidDays: 20, // CL Feb 24
  },
  {
    code: 'ACME13', firstName: 'Lakshmi', lastName: 'Devi',      email: 'lakshmi.devi@acme.com',
    dept: 'Sales',       position: 'Sales Executive',      location: 'Coimbatore',
    tier: 'mid',     pan: 'LKSMD2345K', joiningDate: '2022-09-12',
    presentDays: 19, lopDays: [23],     leaveDays: 0, paidDays: 19, // LOP Feb 23
  },
  {
    code: 'ACME14', firstName: 'Murugan', lastName: 'Selvam',    email: 'murugan.selvam@acme.com',
    dept: 'Sales',       position: 'Sales Executive',      location: 'Coimbatore',
    tier: 'junior',  pan: 'MRGNS6789L', joiningDate: '2024-01-08',
    presentDays: 17, lopDays: [25, 26, 27], leaveDays: 0, paidDays: 17, // LOP Feb 25,26,27
  },
  {
    code: 'ACME15', firstName: 'Ravi',    lastName: 'Kumar',     email: 'ravi.kumar@acme.com',
    dept: 'Operations',  position: 'Operations Manager',   location: 'Bangalore',
    tier: 'manager', pan: 'RVKMR0123M', joiningDate: '2019-03-18',
    presentDays: 20, lopDays: [],       leaveDays: 0, paidDays: 20,
  },
  {
    code: 'ACME16', firstName: 'Nisha',   lastName: 'Singh',     email: 'nisha.singh@acme.com',
    dept: 'Operations',  position: 'Operations Analyst',   location: 'Bangalore',
    tier: 'mid',     pan: 'NSHSN4567N', joiningDate: '2021-11-22',
    presentDays: 20, lopDays: [],       leaveDays: 0, paidDays: 20,
  },
  {
    code: 'ACME17', firstName: 'Ganesh',  lastName: 'Rao',       email: 'ganesh.rao@acme.com',
    dept: 'Operations',  position: 'Operations Executive', location: 'Chennai',
    tier: 'junior',  pan: 'GNSHP8901O', joiningDate: '2023-04-03',
    presentDays: 19, lopDays: [6],      leaveDays: 0, paidDays: 19, // LOP Feb 6
  },
];

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────
async function main() {
  console.log('\n======================================================');
  console.log('  Acme Corporation Demo Data Seeder');
  console.log('======================================================\n');

  // ── STEP 1: Preflight ──────────────────────────────────────
  console.log('STEP 1 — Preflight');
  const org = await prisma.organization.findUnique({ where: { id: ORG_ID } });
  if (!org) throw new Error(`Organization ${ORG_ID} not found!`);
  log('Acme org found', 'OK', org.name);

  const adminUser = await prisma.user.findUnique({ where: { id: ADMIN_USER_ID } });
  if (!adminUser) throw new Error(`Admin user ${ADMIN_USER_ID} not found!`);
  log('Admin user found', 'OK', adminUser.email);

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // ── STEP 2: Departments ────────────────────────────────────
  console.log('\nSTEP 2 — Departments');
  const deptMap: Record<string, string> = {};
  for (const d of DEPT_DATA) {
    let dept = await prisma.department.findFirst({ where: { organizationId: ORG_ID, name: d.name } });
    if (!dept) {
      dept = await prisma.department.create({
        data: { organizationId: ORG_ID, name: d.name, code: d.code, isActive: true } as any,
      });
      log(`Dept: ${d.name}`, 'OK', dept.id);
    } else {
      log(`Dept: ${d.name}`, 'SKIP', dept.id);
    }
    deptMap[d.name] = dept.id;
  }

  // ── STEP 3: Job Positions ──────────────────────────────────
  console.log('\nSTEP 3 — Job Positions');
  const posMap: Record<string, string> = {};
  for (const title of POSITION_TITLES) {
    let pos = await prisma.jobPosition.findFirst({ where: { organizationId: ORG_ID, title } });
    if (!pos) {
      pos = await prisma.jobPosition.create({
        data: { organizationId: ORG_ID, title, isActive: true } as any,
      });
      log(`Position: ${title}`, 'OK', pos.id);
    } else {
      log(`Position: ${title}`, 'SKIP', pos.id);
    }
    posMap[title] = pos.id;
  }

  // ── STEP 4: Entity + Locations (Branches) ─────────────────
  console.log('\nSTEP 4 — Entity + Branch Locations');
  let entity = await prisma.entity.findFirst({ where: { organizationId: ORG_ID } });
  if (!entity) {
    entity = await prisma.entity.create({
      data: { organizationId: ORG_ID, name: 'Acme Corporation', code: 'ACME', isActive: true } as any,
    });
    log('Entity created', 'OK', entity.id);
  } else {
    log('Entity found', 'SKIP', entity.id);
  }
  const entityId = entity.id;

  const locationMap: Record<string, string> = {};
  for (const branchName of ['Chennai', 'Coimbatore', 'Bangalore']) {
    let loc = await prisma.location.findFirst({ where: { organizationId: ORG_ID, name: branchName } });
    if (!loc) {
      loc = await prisma.location.create({
        data: { organizationId: ORG_ID, entityId, name: branchName, isActive: true } as any,
      });
      log(`Location: ${branchName}`, 'OK', loc.id);
    } else {
      log(`Location: ${branchName}`, 'SKIP', loc.id);
    }
    locationMap[branchName] = loc.id;
  }

  // ── STEP 5: Salary Structures ──────────────────────────────
  console.log('\nSTEP 5 — Salary Structures');
  const structMap: Record<string, string> = {};
  const tierNames: Record<string, string> = {
    junior: 'Acme Junior', mid: 'Acme Mid', senior: 'Acme Senior', manager: 'Acme Manager',
  };
  for (const [tier, name] of Object.entries(tierNames)) {
    const { basic, hra, special } = SALARY_TIERS[tier];
    let struct = await prisma.salaryStructure.findFirst({ where: { organizationId: ORG_ID, name } });
    if (!struct) {
      struct = await prisma.salaryStructure.create({
        data: {
          organizationId: ORG_ID,
          name,
          description: `${tier.charAt(0).toUpperCase() + tier.slice(1)}-level salary structure`,
          isActive: true,
          components: [
            { name: 'Basic Salary',       code: 'BASIC',   type: 'EARNING', calculationType: 'FIXED', value: basic,   isTaxable: true,  isStatutory: false },
            { name: 'HRA',                code: 'HRA',     type: 'EARNING', calculationType: 'FIXED', value: hra,     isTaxable: false, isStatutory: false },
            { name: 'Special Allowance',  code: 'SPECIAL', type: 'EARNING', calculationType: 'FIXED', value: special, isTaxable: true,  isStatutory: false },
          ],
        } as any,
      });
      log(`Structure: ${name}`, 'OK', struct.id);
    } else {
      log(`Structure: ${name}`, 'SKIP', struct.id);
    }
    structMap[tier] = struct.id;
  }

  // ── STEP 6: Employees ──────────────────────────────────────
  console.log('\nSTEP 6 — Employees');
  const newEmpIds: string[] = []; // track newly created IDs
  // Map employee code → emp ID (including already-existing ones we need for leave/attendance)
  const empIdByCode: Record<string, string> = {};
  empIdByCode['ACME2'] = RAJESH_KUMAR_ID; // existing

  for (let i = 0; i < EMPLOYEE_DATA.length; i++) {
    const e = EMPLOYEE_DATA[i];
    const existing = await prisma.employee.findFirst({ where: { organizationId: ORG_ID, employeeCode: e.code } });
    if (existing) {
      log(`Employee ${e.code} (${e.firstName} ${e.lastName})`, 'SKIP', existing.id);
      empIdByCode[e.code] = existing.id;
      continue;
    }

    // a) User record
    const user = await prisma.user.create({
      data: {
        email: e.email,
        passwordHash,
        role: 'EMPLOYEE',
        organizationId: ORG_ID,
        isActive: true,
        isEmailVerified: true,
      },
    });

    // b) Employee (raw SQL bypasses Prisma JSON field type confusion)
    const taxInfoJson = JSON.stringify({ panNumber: e.pan, taxRegime: 'NEW', ptaxLocation: 'Maharashtra' });
    const joiningDate = new Date(e.joiningDate);
    const deptId = deptMap[e.dept];
    const posId = posMap[e.position];
    const locId = locationMap[e.location];

    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO employees (
        organization_id, employee_code, user_id,
        first_name, last_name, email,
        date_of_joining, employee_status,
        department_id, position_id, location_id, entity_id,
        tax_information, created_at, updated_at
      ) VALUES (
        ${ORG_ID}::uuid, ${e.code}, ${user.id}::uuid,
        ${e.firstName}, ${e.lastName}, ${e.email},
        ${joiningDate}, 'ACTIVE',
        ${deptId}::uuid, ${posId}::uuid, ${locId}::uuid, ${entityId}::uuid,
        ${taxInfoJson}::jsonb, NOW(), NOW()
      ) RETURNING id
    `;
    const empId = rows[0]?.id;
    if (!empId) throw new Error(`Failed to create employee ${e.code}`);
    newEmpIds.push(empId);
    empIdByCode[e.code] = empId;

    // c) Bank Account
    const bankName = BANKS[i % BANKS.length];
    const accountNumber = `5010${String(i + 3).padStart(11, '0')}`;
    await prisma.employeeBankAccount.create({
      data: {
        employeeId: empId,
        bankName,
        accountNumber,
        accountType: 'SAVINGS',
        isPrimary: true,
        isActive: true,
      } as any,
    });

    // d) Employee Salary
    const tier = SALARY_TIERS[e.tier];
    await prisma.employeeSalary.create({
      data: {
        employeeId: empId,
        salaryStructureId: structMap[e.tier],
        basicSalary: tier.basic,
        grossSalary: tier.gross,
        netSalary: tier.gross, // net = gross before deductions (engine calculates actual net)
        currency: 'INR',
        paymentFrequency: 'MONTHLY',
        effectiveDate: new Date('2024-01-01'),
        isActive: true,
        components: { BASIC: tier.basic, HRA: tier.hra, SPECIAL: tier.special } as any,
      } as any,
    });

    log(`Employee ${e.code} (${e.firstName} ${e.lastName})`, 'OK', empId);
  }

  // ── STEP 7: Leave Types ────────────────────────────────────
  console.log('\nSTEP 7 — Leave Types');
  const leaveTypeMap: Record<string, string> = {};
  // LeaveType.code is GLOBALLY unique, so search by name+org; use org-prefixed codes on create
  const leaveTypeDefs = [
    { key: 'CL', name: 'Casual Leave', isPaid: true },
    { key: 'SL', name: 'Sick Leave',   isPaid: true },
    { key: 'EL', name: 'Earned Leave', isPaid: true },
  ];
  for (const lt of leaveTypeDefs) {
    let leaveType = await prisma.leaveType.findFirst({ where: { organizationId: ORG_ID, name: lt.name } });
    if (!leaveType) {
      leaveType = await prisma.leaveType.create({
        data: {
          organizationId: ORG_ID,
          name: lt.name,
          code: `ACME_${lt.key}_${Date.now()}`,
          isPaid: lt.isPaid,
          defaultDaysPerYear: 12,
          requiresApproval: true,
          isActive: true,
        } as any,
      });
      log(`Leave type: ${lt.name}`, 'OK', leaveType.id);
    } else {
      log(`Leave type: ${lt.name}`, 'SKIP', leaveType.id);
    }
    leaveTypeMap[lt.key] = leaveType.id;
  }
  const clTypeId = leaveTypeMap['CL'];
  const slTypeId = leaveTypeMap['SL'];

  // ── STEP 8: Leave Balances (for new employees) ─────────────
  console.log('\nSTEP 8 — Leave Balances');
  for (const empId of newEmpIds) {
    for (const ltId of [clTypeId, slTypeId, leaveTypeMap['EL']]) {
      const existing = await prisma.employeeLeaveBalance.findFirst({
        where: { employeeId: empId, leaveTypeId: ltId, year: YEAR },
      });
      if (!existing) {
        await prisma.employeeLeaveBalance.create({
          data: {
            employeeId: empId,
            leaveTypeId: ltId,
            openingBalance: 12,
            accrued: 0,
            used: 0,
            carriedForward: 0,
            available: 12,
            year: YEAR,
          },
        });
      }
    }
  }
  log(`Leave balances created for ${newEmpIds.length} employees`, 'OK');

  // ── STEP 9: Attendance (Feb 2026) ─────────────────────────
  console.log('\nSTEP 9 — Feb 2026 Attendance');
  for (const e of EMPLOYEE_DATA) {
    const empId = empIdByCode[e.code];
    if (!empId) continue;

    // 9a: Monthly Summary (skip if already exists)
    const existingSummary = await prisma.monthlyAttendanceSummary.findFirst({
      where: { organizationId: ORG_ID, employeeId: empId, year: YEAR, month: MONTH },
    });
    if (!existingSummary) {
      await prisma.monthlyAttendanceSummary.create({
        data: {
          organizationId: ORG_ID,
          employeeId: empId,
          year: YEAR,
          month: MONTH,
          presentDays: e.presentDays,
          absentDays: e.lopDays.length,
          leaveDays: e.leaveDays,
          lopDays: e.lopDays.length,
          halfDays: 0,
          holidayDays: 0,
          weekendDays: 8,
          overtimeHours: 0,
          totalWorkingDays: 20,
          paidDays: e.paidDays,
          status: 'FINALIZED',
          finalizedAt: new Date('2026-03-01'),
          finalizedBy: ADMIN_USER_ID,
        } as any,
      });
    }

    // 9b: Individual day records (skip Rajesh Kumar — already has records)
    if (e.code === 'ACME2') continue;
    for (const day of FEB_2026_WEEKDAYS) {
      const date = new Date(`2026-02-${String(day).padStart(2, '0')}`);
      const isLOP = e.lopDays.includes(day);
      const existing = await prisma.attendanceRecord.findFirst({ where: { employeeId: empId, date } });
      if (!existing) {
        await prisma.attendanceRecord.create({
          data: {
            employeeId: empId,
            date,
            status: isLOP ? 'ABSENT' : 'PRESENT',
            checkIn: isLOP ? null : new Date(`2026-02-${String(day).padStart(2, '0')}T09:00:00`),
            checkOut: isLOP ? null : new Date(`2026-02-${String(day).padStart(2, '0')}T18:00:00`),
            workHours: isLOP ? null : 9 as any,
          } as any,
        });
      }
    }
    log(`Attendance: ${e.code} (${e.presentDays} present, ${e.lopDays.length} LOP, ${e.leaveDays} leave)`, 'OK');
  }

  // ── STEP 10: Leave Requests ────────────────────────────────
  console.log('\nSTEP 10 — Leave Requests');

  // Approved requests in Feb 2026
  const approvedRequests = [
    { code: 'ACME4',  ltId: clTypeId, start: '2026-02-03', end: '2026-02-03', days: 1, reason: 'Personal work'    },
    { code: 'ACME7',  ltId: slTypeId, start: '2026-02-17', end: '2026-02-17', days: 1, reason: 'Fever, not well'  },
    { code: 'ACME10', ltId: slTypeId, start: '2026-02-10', end: '2026-02-10', days: 1, reason: 'Medical appointment' },
    { code: 'ACME12', ltId: clTypeId, start: '2026-02-24', end: '2026-02-24', days: 1, reason: 'Family function'  },
  ];

  for (const req of approvedRequests) {
    const empId = empIdByCode[req.code];
    if (!empId) { log(`Leave request for ${req.code}`, 'SKIP', 'employee not found'); continue; }
    const startDate = new Date(req.start);
    const existing = await prisma.leaveRequest.findFirst({
      where: { employeeId: empId, leaveTypeId: req.ltId, startDate },
    });
    if (!existing) {
      await prisma.leaveRequest.create({
        data: {
          employeeId: empId,
          leaveTypeId: req.ltId,
          startDate,
          endDate: new Date(req.end),
          totalDays: req.days,
          reason: req.reason,
          status: 'APPROVED',
          appliedOn: startDate,
          reviewedAt: new Date(`${req.start.slice(0, 7)}-01`),
          reviewedBy: ADMIN_USER_ID,
          reviewComments: 'Approved',
        } as any,
      });
      log(`Leave APPROVED: ${req.code} (${req.start})`, 'OK');
    } else {
      log(`Leave APPROVED: ${req.code} (${req.start})`, 'SKIP', 'already exists');
    }
  }

  // Pending requests in March 2026
  const pendingRequests = [
    { code: 'ACME5',  ltId: clTypeId, start: '2026-03-15', end: '2026-03-15', days: 1, reason: 'Personal errand'   },
    { code: 'ACME8',  ltId: slTypeId, start: '2026-03-10', end: '2026-03-10', days: 1, reason: 'Doctor visit'      },
    { code: 'ACME13', ltId: clTypeId, start: '2026-03-20', end: '2026-03-21', days: 2, reason: 'Family event'      },
  ];

  for (const req of pendingRequests) {
    const empId = empIdByCode[req.code];
    if (!empId) { log(`Leave request for ${req.code}`, 'SKIP', 'employee not found'); continue; }
    const startDate = new Date(req.start);
    const existing = await prisma.leaveRequest.findFirst({
      where: { employeeId: empId, leaveTypeId: req.ltId, startDate },
    });
    if (!existing) {
      await prisma.leaveRequest.create({
        data: {
          employeeId: empId,
          leaveTypeId: req.ltId,
          startDate,
          endDate: new Date(req.end),
          totalDays: req.days,
          reason: req.reason,
          status: 'PENDING',
          appliedOn: new Date(),
        } as any,
      });
      log(`Leave PENDING: ${req.code} (${req.start})`, 'OK');
    } else {
      log(`Leave PENDING: ${req.code} (${req.start})`, 'SKIP', 'already exists');
    }
  }

  // ── STEP 11: Reset Payroll Cycle ───────────────────────────
  console.log('\nSTEP 11 — Reset Feb 2026 Payroll Cycle');
  const existingPayslipCount = await prisma.payslip.count({ where: { payrollCycleId: FEB_CYCLE_ID } });
  if (existingPayslipCount >= 15) {
    log(`Payroll already has ${existingPayslipCount} payslips — resetting for reprocess`, 'OK');
  }
  await prisma.payrollCycle.update({
    where: { id: FEB_CYCLE_ID },
    data: { status: 'DRAFT', isLocked: false as any } as any,
  });
  await prisma.payslip.updateMany({
    where: { payrollCycleId: FEB_CYCLE_ID },
    data: { status: 'DRAFT' } as any,
  });
  log('Payroll cycle reset to DRAFT, payslips reset to DRAFT', 'OK');

  // ── STEP 12: Process Payroll ───────────────────────────────
  console.log('\nSTEP 12 — Process Payroll (all employees)');
  const processResult = await payrollService.processPayrollCycle(
    FEB_CYCLE_ID,
    { recalculate: true } as any,
    ADMIN_USER_ID,
  );
  log(`Payroll processed`, 'OK', `payslips=${(processResult as any).payslipsCount ?? 'N/A'}, gross=INR ${(processResult as any).totalGross ?? 'N/A'}`);

  // ── STEP 13: Finalize + Mark Paid ─────────────────────────
  console.log('\nSTEP 13 — Finalize and Mark as Paid');
  await payrollService.finalizePayrollCycle(FEB_CYCLE_ID, ADMIN_USER_ID);
  log('Payroll cycle FINALIZED', 'OK');

  await payrollService.markAsPaid(FEB_CYCLE_ID, ADMIN_USER_ID);
  log('Payroll cycle marked as PAID', 'OK');

  // ── SUMMARY ────────────────────────────────────────────────
  console.log('\n======================================================');
  console.log('  DEMO DATA SEEDING COMPLETE');
  console.log('======================================================');
  console.log(`  ✓ Actions:  ${passCount}`);
  console.log(`  → Skipped:  ${skipCount}`);
  console.log(`  Employees created: ${newEmpIds.length}`);
  console.log(`  Total employees in org: ~${newEmpIds.length + 1} (incl. Rajesh Kumar)`);
  console.log('\n  Frontend modules ready for demo:');
  console.log('  • Organizations  → Acme Corporation');
  console.log('  • Employees      → 16 employees across 5 departments');
  console.log('  • Attendance     → Feb 2026 records (present/absent/leave)');
  console.log('  • Leave          → 4 approved (Feb) + 3 pending (Mar)');
  console.log('  • Payroll        → Feb 2026 cycle, PAID, 16 payslips');
  console.log('  • Reports        → Payroll register, PF, PT, TDS all populated');
  console.log('  • Bank Transfer  → 16 rows with HDFC/ICICI/SBI/Axis/Kotak accounts');
  console.log('======================================================\n');
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch((err) => {
    console.error('\n[ERROR]', err.message ?? err);
    prisma.$disconnect().then(() => process.exit(1));
  });
