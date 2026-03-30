/**
 * ============================================================================
 * HRMS — Seed 4 Test Employees into Infosys Organization
 * ============================================================================
 *
 * PURPOSE: Insert 4 real employees into the existing Infosys org so you can
 *          manually test the frontend flow (login, attendance, leave, etc.)
 *
 * DATA IS NOT DELETED — employees stay in the DB for manual flow testing.
 *
 * Employees created:
 *   1. Ravi Kumar       (EMPLOYEE)   — flowtest.ravi@testmail.com
 *   2. Priya Sharma     (EMPLOYEE)   — flowtest.priya@testmail.com
 *   3. Karthik Raj      (MANAGER)    — flowtest.karthik@testmail.com
 *   4. Divya Nair       (EMPLOYEE)   — flowtest.divya@testmail.com
 *
 * Password for all: FlowTest@123
 *
 * Also creates:
 *   - Shift: "Flow Test General Shift" (09:00–18:00, 15min grace)
 *   - Leave Types: "Flow Test EL" (18 days), "Flow Test SL" (12 days)
 *   - Leave Balance for all 4 employees
 *   - Shift assignment for all 4
 *
 * Run: npx jest src/tests/hrms-seed-test-employees.test.ts --forceExit --verbose
 *
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.warn('⚠ DATABASE_URL not set — skipping seed test');
}
const describeDB = DB_URL ? describe : describe.skip;

const prisma = new PrismaClient();

const PASSWORD = 'FlowTest@123';
const EMAIL_PREFIX = 'flowtest.';
const CODE_PREFIX = 'FLOW-TEST-';

const EMPLOYEES = [
  { firstName: 'Ravi',    lastName: 'Kumar',  email: `${EMAIL_PREFIX}ravi@testmail.com`,    code: `${CODE_PREFIX}001`, role: 'EMPLOYEE' as const, gender: 'MALE' as const, dob: '1995-03-15', phone: '9800100001' },
  { firstName: 'Priya',   lastName: 'Sharma', email: `${EMAIL_PREFIX}priya@testmail.com`,   code: `${CODE_PREFIX}002`, role: 'EMPLOYEE' as const, gender: 'FEMALE' as const, dob: '1996-07-22', phone: '9800100002' },
  { firstName: 'Karthik', lastName: 'Raj',    email: `${EMAIL_PREFIX}karthik@testmail.com`, code: `${CODE_PREFIX}003`, role: 'MANAGER' as const,  gender: 'MALE' as const, dob: '1992-11-08', phone: '9800100003' },
  { firstName: 'Divya',   lastName: 'Nair',   email: `${EMAIL_PREFIX}divya@testmail.com`,   code: `${CODE_PREFIX}004`, role: 'EMPLOYEE' as const, gender: 'FEMALE' as const, dob: '1997-01-30', phone: '9800100004' },
];

// ── Shared IDs populated during tests ──
let orgId: string;
let deptId: string;
let positionId: string;
let reportingManagerId: string;
let shiftId: string;
let leaveTypeELId: string;
let leaveTypeSLId: string;
const createdEmployeeIds: string[] = [];
const createdUserIds: string[] = [];

afterAll(async () => {
  await prisma.$disconnect();
});

// ═══════════════════════════════════════════════════════════════════════════════
describeDB('SEED: Create 4 test employees in Infosys org (NO DELETE)', () => {

  // ── Step 1: Find the Infosys organization ──────────────────────────────────
  test('Step 1: Find Infosys organization from existing HR user', async () => {
    // Find Chitra's user to get the org ID
    const hrUser = await prisma.user.findFirst({
      where: { email: { contains: 'chitra.rajan' } },
      select: { organizationId: true },
    });

    if (!hrUser?.organizationId) {
      // Fallback: try finding by manager email
      const mgrUser = await prisma.user.findFirst({
        where: { email: { contains: 'murugan.babu' } },
        select: { organizationId: true },
      });
      orgId = mgrUser?.organizationId || '';
    } else {
      orgId = hrUser.organizationId;
    }

    expect(orgId).toBeTruthy();
    console.log('  ✓ Infosys org ID:', orgId);

    // Get org details
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    expect(org).not.toBeNull();
    console.log('  ✓ Organization name:', org!.name);
  }, 15000);

  // ── Step 2: Find existing department and position ──────────────────────────
  test('Step 2: Find existing department, position, and reporting manager', async () => {
    // Find a department in this org
    const dept = await prisma.department.findFirst({
      where: { organizationId: orgId, isActive: true },
      orderBy: { name: 'asc' },
    });
    expect(dept).not.toBeNull();
    deptId = dept!.id;
    console.log('  ✓ Department:', dept!.name, '(' + deptId + ')');

    // Find a position in this org
    const pos = await prisma.jobPosition.findFirst({
      where: { organizationId: orgId, isActive: true },
      orderBy: { title: 'asc' },
    });
    expect(pos).not.toBeNull();
    positionId = pos!.id;
    console.log('  ✓ Position:', pos!.title, '(' + positionId + ')');

    // Find Murugan (Manager) as reporting manager
    const mgr = await prisma.employee.findFirst({
      where: {
        organizationId: orgId,
        email: { contains: 'murugan.babu' },
        employeeStatus: 'ACTIVE',
      },
    });

    if (mgr) {
      reportingManagerId = mgr.id;
      console.log('  ✓ Reporting Manager:', mgr.firstName, mgr.lastName, '(' + reportingManagerId + ')');
    } else {
      // Fallback: use any active manager
      const anyMgr = await prisma.employee.findFirst({
        where: { organizationId: orgId, employeeStatus: 'ACTIVE' },
      });
      reportingManagerId = anyMgr?.id || '';
      console.log('  ✓ Reporting Manager (fallback):', anyMgr?.firstName, '(' + reportingManagerId + ')');
    }

    expect(reportingManagerId).toBeTruthy();
  }, 15000);

  // ── Step 3: Create 4 Users + 4 Employees ──────────────────────────────────
  test('Step 3: Create 4 test employees (skip if already exist)', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    for (const emp of EMPLOYEES) {
      // Check if already exists (idempotent — safe to re-run)
      const existingUser = await prisma.user.findUnique({ where: { email: emp.email } });
      if (existingUser) {
        console.log(`  ⏭ ${emp.firstName} ${emp.lastName} already exists — skipping`);
        const existingEmp = await prisma.employee.findFirst({ where: { email: emp.email } });
        if (existingEmp) {
          createdEmployeeIds.push(existingEmp.id);
          createdUserIds.push(existingUser.id);
        }
        continue;
      }

      // Create User
      const user = await prisma.user.create({
        data: {
          email: emp.email,
          passwordHash,
          role: emp.role,
          organizationId: orgId,
          isActive: true,
          isEmailVerified: true,
        },
      });
      createdUserIds.push(user.id);

      // Create Employee
      const employee = await prisma.employee.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          employeeCode: emp.code,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          phone: emp.phone,
          gender: emp.gender,
          dateOfBirth: new Date(emp.dob),
          dateOfJoining: new Date('2026-04-01'),
          departmentId: deptId,
          positionId: positionId,
          reportingManagerId: reportingManagerId,
          placeOfTaxDeduction: 'METRO',
          employeeStatus: 'ACTIVE',
        },
      });
      createdEmployeeIds.push(employee.id);

      console.log(`  ✓ Created: ${emp.firstName} ${emp.lastName} (${emp.email}) — ${emp.role} — code: ${emp.code}`);
    }

    expect(createdEmployeeIds.length).toBe(4);
  }, 30000);

  // ── Step 4: Create Shift and assign to all 4 ──────────────────────────────
  test('Step 4: Create shift and assign to all 4 employees', async () => {
    const SHIFT_CODE = 'FT-GS-001';

    // Check if shift already exists
    let shift = await prisma.shift.findFirst({
      where: { organizationId: orgId, code: SHIFT_CODE },
    });

    if (!shift) {
      shift = await prisma.shift.create({
        data: {
          organizationId: orgId,
          name: 'Flow Test General Shift',
          code: SHIFT_CODE,
          startTime: '09:00',
          endTime: '18:00',
          firstHalfEnd: '13:00',
          secondHalfStart: '14:00',
          breakDuration: 60,
          workHours: 8,
          gracePeriod: 15,
          overtimeEnabled: true,
          isActive: true,
        },
      });
      console.log('  ✓ Created shift: Flow Test General Shift (09:00-18:00)');
    } else {
      console.log('  ⏭ Shift already exists — skipping');
    }
    shiftId = shift.id;

    // Assign shift to all 4 employees
    for (const empId of createdEmployeeIds) {
      await prisma.employee.update({
        where: { id: empId },
        data: { shiftId },
      });
    }
    console.log('  ✓ Shift assigned to all 4 employees');

    // Create shift assignment rule
    const existingRule = await prisma.shiftAssignmentRule.findFirst({
      where: { organizationId: orgId, displayName: 'Flow Test Shift Assignment' },
    });
    if (!existingRule) {
      await prisma.shiftAssignmentRule.create({
        data: {
          organizationId: orgId,
          displayName: 'Flow Test Shift Assignment',
          shiftId,
          departmentId: deptId,
          effectiveDate: new Date('2026-04-01'),
          priority: 1,
          employeeIds: createdEmployeeIds,
        },
      });
      console.log('  ✓ Shift assignment rule created');
    }
  }, 15000);

  // ── Step 5: Create Leave Types and allocate balance ────────────────────────
  test('Step 5: Create leave types (EL, SL) and allocate balance to all 4', async () => {
    // EL
    let el = await prisma.leaveType.findFirst({
      where: { organizationId: orgId, code: 'FT-EL' },
    });
    if (!el) {
      el = await prisma.leaveType.create({
        data: {
          organizationId: orgId,
          name: 'Flow Test Earned Leave',
          code: 'FT-EL',
          isPaid: true,
          defaultDaysPerYear: 18,
          maxCarryForward: 15,
          accrualType: 'MONTHLY',
          requiresApproval: true,
          canBeNegative: false,
          isActive: true,
        },
      });
      console.log('  ✓ Created EL leave type (18 days/year)');
    } else {
      console.log('  ⏭ EL leave type already exists');
    }
    leaveTypeELId = el.id;

    // SL
    let sl = await prisma.leaveType.findFirst({
      where: { organizationId: orgId, code: 'FT-SL' },
    });
    if (!sl) {
      sl = await prisma.leaveType.create({
        data: {
          organizationId: orgId,
          name: 'Flow Test Sick Leave',
          code: 'FT-SL',
          isPaid: true,
          defaultDaysPerYear: 12,
          maxCarryForward: 0,
          accrualType: 'MONTHLY',
          requiresApproval: true,
          canBeNegative: false,
          isActive: true,
        },
      });
      console.log('  ✓ Created SL leave type (12 days/year)');
    } else {
      console.log('  ⏭ SL leave type already exists');
    }
    leaveTypeSLId = sl.id;

    // Allocate balance to all 4 employees
    for (const empId of createdEmployeeIds) {
      // EL balance
      const existingEL = await prisma.employeeLeaveBalance.findFirst({
        where: { employeeId: empId, leaveTypeId: leaveTypeELId, year: 2026 },
      });
      if (!existingEL) {
        await prisma.employeeLeaveBalance.create({
          data: {
            employeeId: empId,
            leaveTypeId: leaveTypeELId,
            year: 2026,
            openingBalance: 18,
            accrued: 0,
            used: 0,
            carriedForward: 0,
            available: 18,
          },
        });
      }

      // SL balance
      const existingSL = await prisma.employeeLeaveBalance.findFirst({
        where: { employeeId: empId, leaveTypeId: leaveTypeSLId, year: 2026 },
      });
      if (!existingSL) {
        await prisma.employeeLeaveBalance.create({
          data: {
            employeeId: empId,
            leaveTypeId: leaveTypeSLId,
            year: 2026,
            openingBalance: 12,
            accrued: 0,
            used: 0,
            carriedForward: 0,
            available: 12,
          },
        });
      }
    }
    console.log('  ✓ Leave balance allocated: EL=18, SL=12 for all 4 employees');
  }, 20000);

  // ── Step 6: Verify all data in DB ──────────────────────────────────────────
  test('Step 6: Verify all 4 employees exist with correct data', async () => {
    for (const emp of EMPLOYEES) {
      const dbEmp = await prisma.employee.findFirst({
        where: { email: emp.email },
        include: {
          user: true,
          department: true,
          position: true,
          reportingManager: true,
          shift: true,
          leaveBalances: { where: { year: 2026 }, include: { leaveType: true } },
        },
      });

      expect(dbEmp).not.toBeNull();
      expect(dbEmp!.firstName).toBe(emp.firstName);
      expect(dbEmp!.lastName).toBe(emp.lastName);
      expect(dbEmp!.employeeCode).toBe(emp.code);
      expect(dbEmp!.employeeStatus).toBe('ACTIVE');
      expect(dbEmp!.user.role).toBe(emp.role);
      expect(dbEmp!.user.isActive).toBe(true);
      expect(dbEmp!.department).not.toBeNull();
      expect(dbEmp!.position).not.toBeNull();
      expect(dbEmp!.reportingManager).not.toBeNull();
      expect(dbEmp!.shift).not.toBeNull();
      expect(dbEmp!.shift!.startTime).toBe('09:00');
      expect(dbEmp!.shift!.endTime).toBe('18:00');
      expect(dbEmp!.leaveBalances).toHaveLength(2);

      const elBal = dbEmp!.leaveBalances.find(b => b.leaveType.code === 'FT-EL');
      const slBal = dbEmp!.leaveBalances.find(b => b.leaveType.code === 'FT-SL');
      expect(Number(elBal!.available)).toBe(18);
      expect(Number(slBal!.available)).toBe(12);

      console.log(`  ✓ Verified: ${emp.firstName} ${emp.lastName} — ${emp.role} — EL:18 SL:12 — Shift:09:00-18:00`);
    }
  }, 20000);

  // ── Final summary ──────────────────────────────────────────────────────────
  test('Step 7: Print login credentials for manual testing', async () => {
    console.log('\n' + '='.repeat(70));
    console.log('  FLOW TEST EMPLOYEES — LOGIN CREDENTIALS');
    console.log('='.repeat(70));
    console.log(`  Password for all: ${PASSWORD}`);
    console.log('-'.repeat(70));

    for (const emp of EMPLOYEES) {
      console.log(`  ${emp.firstName.padEnd(10)} ${emp.lastName.padEnd(10)} | ${emp.email.padEnd(35)} | ${emp.role}`);
    }

    console.log('-'.repeat(70));
    console.log('  Shift    : Flow Test General Shift (09:00-18:00, 15min grace)');
    console.log('  Leave    : EL=18 days, SL=12 days (year 2026)');
    console.log('  Reports to: Murugan Babu (existing manager)');
    console.log('  Status   : ACTIVE');
    console.log('  DATA IS KEPT IN DB — NOT DELETED');
    console.log('='.repeat(70));

    expect(true).toBe(true); // always pass
  });
});
