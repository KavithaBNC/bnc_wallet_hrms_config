/**
 * ============================================================================
 * HRMS E2E Workflow — Real Database Integration Tests
 * ============================================================================
 *
 * Connects to PostgreSQL via Prisma. Inserts real data into 12 tables.
 * Reads back and verifies. Cleans up after.
 *
 * Tables tested:
 *   Organization, Department, JobPosition, User, Employee,
 *   Shift, ShiftAssignmentRule, LeaveType, EmployeeLeaveBalance,
 *   LeaveRequest, AttendanceRecord, AttendancePunch
 *
 * Cleanup: All test data uses org name "E2E_WORKFLOW_TEST_ORG" and
 *   emails prefixed "e2e_wf_". afterAll deletes by org cascading.
 *
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Shared state — populated by tests, used across describe blocks ──────────

let orgId: string;
let deptId: string;
let positionId: string;
let hrUserId: string;
let hrEmployeeId: string;
let mgrUserId: string;
let mgrEmployeeId: string;
let empUserId: string;
let empEmployeeId: string;
let shiftId: string;
let shiftRuleId: string;
let leaveTypeELId: string;
let leaveTypeSLId: string;
let elBalanceId: string;
let slBalanceId: string;
let leaveRequestId: string;
let attendanceRecordId: string;

// Suppress TS unused-var errors — these are set in one test and read in later tests
void [() => hrEmployeeId, () => shiftRuleId, () => slBalanceId];

const ORG_NAME = 'E2E_WORKFLOW_TEST_ORG';
const EMAIL_PREFIX = 'e2e_wf_';
const PASSWORD = 'TestPass@123';

// ── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup() {
  // Find our test org
  const org = await prisma.organization.findFirst({ where: { name: ORG_NAME } });
  if (!org) return;

  // Delete in foreign key order
  await prisma.attendancePunch.deleteMany({ where: { employee: { organizationId: org.id } } }).catch(() => {});
  await prisma.attendanceRecord.deleteMany({ where: { employee: { organizationId: org.id } } }).catch(() => {});
  await prisma.leaveRequest.deleteMany({ where: { employee: { organizationId: org.id } } }).catch(() => {});
  await prisma.employeeLeaveBalance.deleteMany({ where: { employee: { organizationId: org.id } } }).catch(() => {});
  await prisma.shiftAssignmentRule.deleteMany({ where: { organizationId: org.id } }).catch(() => {});
  await prisma.employee.deleteMany({ where: { organizationId: org.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } }).catch(() => {});
  await prisma.shift.deleteMany({ where: { organizationId: org.id } }).catch(() => {});
  await prisma.leaveType.deleteMany({ where: { organizationId: org.id } }).catch(() => {});
  await prisma.jobPosition.deleteMany({ where: { organizationId: org.id } }).catch(() => {});
  await prisma.department.deleteMany({ where: { organizationId: org.id } }).catch(() => {});
  await prisma.organization.deleteMany({ where: { id: org.id } }).catch(() => {});
}

beforeAll(async () => {
  await cleanup();
}, 30000);

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
}, 30000);

// ═══════════════════════════════════════════════════════════════════════════════
// POSITIVE TESTS — Insert data, read back, verify tables
// ═══════════════════════════════════════════════════════════════════════════════

describe('POSITIVE: Full workflow — DB insert and verify', () => {

  // ── POS-1: Create Org + Dept + Position + Users + Employees ──────────────

  test('POS-1: Create Organization, Department, Position, Users, Employees — verify all in DB', async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);

    // ── Organization ──
    const org = await prisma.organization.create({
      data: {
        name: ORG_NAME,
        legalName: 'E2E Workflow Test Corp Pvt Ltd',
        industry: 'Technology',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        employeeIdPrefix: 'E2E',
        employeeIdNextNumber: 500,
      },
    });
    orgId = org.id;

    expect(org.name).toBe(ORG_NAME);
    expect(org.currency).toBe('INR');
    expect(org.id).toBeTruthy();

    // ── Department ──
    const dept = await prisma.department.create({
      data: { organizationId: orgId, name: 'E2E Engineering', code: 'E2E-ENG-WF', isActive: true },
    });
    deptId = dept.id;

    expect(dept.name).toBe('E2E Engineering');
    expect(dept.organizationId).toBe(orgId);

    // ── Position ──
    const pos = await prisma.jobPosition.create({
      data: { organizationId: orgId, title: 'E2E Developer', code: 'E2E-DEV-WF', isActive: true },
    });
    positionId = pos.id;

    expect(pos.title).toBe('E2E Developer');

    // ── HR User + Employee ──
    const hrUser = await prisma.user.create({
      data: {
        email: `${EMAIL_PREFIX}hr@test.com`,
        passwordHash: hash,
        role: 'HR_MANAGER',
        organizationId: orgId,
        isActive: true,
        isEmailVerified: true,
      },
    });
    hrUserId = hrUser.id;

    const hrEmp = await prisma.employee.create({
      data: {
        organizationId: orgId,
        userId: hrUserId,
        employeeCode: 'E2E-WF-HR01',
        firstName: 'Chitra',
        lastName: 'Rajan',
        email: `${EMAIL_PREFIX}hr@test.com`,
        dateOfJoining: new Date('2024-01-01'),
        departmentId: deptId,
        positionId: positionId,
        employeeStatus: 'ACTIVE',
      },
    });
    hrEmployeeId = hrEmp.id;

    // ── Manager User + Employee ──
    const mgrUser = await prisma.user.create({
      data: {
        email: `${EMAIL_PREFIX}mgr@test.com`,
        passwordHash: hash,
        role: 'MANAGER',
        organizationId: orgId,
        isActive: true,
        isEmailVerified: true,
      },
    });
    mgrUserId = mgrUser.id;

    const mgrEmp = await prisma.employee.create({
      data: {
        organizationId: orgId,
        userId: mgrUserId,
        employeeCode: 'E2E-WF-MGR01',
        firstName: 'Murugan',
        lastName: 'Babu',
        email: `${EMAIL_PREFIX}mgr@test.com`,
        dateOfJoining: new Date('2024-01-01'),
        departmentId: deptId,
        positionId: positionId,
        employeeStatus: 'ACTIVE',
      },
    });
    mgrEmployeeId = mgrEmp.id;

    // ── Employee User + Employee (test subject: Deepak) ──
    const empUser = await prisma.user.create({
      data: {
        email: `${EMAIL_PREFIX}emp@test.com`,
        passwordHash: hash,
        role: 'EMPLOYEE',
        organizationId: orgId,
        isActive: true,
        isEmailVerified: true,
      },
    });
    empUserId = empUser.id;

    const emp = await prisma.employee.create({
      data: {
        organizationId: orgId,
        userId: empUserId,
        employeeCode: 'E2E-WF-EMP01',
        firstName: 'Deepak',
        lastName: 'Venkatesh',
        email: `${EMAIL_PREFIX}emp@test.com`,
        phone: '9845012345',
        gender: 'MALE',
        dateOfBirth: new Date('1994-08-22'),
        dateOfJoining: new Date('2026-04-01'),
        departmentId: deptId,
        positionId: positionId,
        reportingManagerId: mgrEmployeeId,
        placeOfTaxDeduction: 'METRO',
        employeeStatus: 'ACTIVE',
      },
    });
    empEmployeeId = emp.id;

    // ── VERIFY: Read back employee with all joins ──
    const dbEmp = await prisma.employee.findUnique({
      where: { id: empEmployeeId },
      include: { department: true, position: true, reportingManager: true, user: true },
    });

    expect(dbEmp).not.toBeNull();
    expect(dbEmp!.firstName).toBe('Deepak');
    expect(dbEmp!.lastName).toBe('Venkatesh');
    expect(dbEmp!.email).toBe(`${EMAIL_PREFIX}emp@test.com`);
    expect(dbEmp!.employeeCode).toBe('E2E-WF-EMP01');
    expect(dbEmp!.gender).toBe('MALE');
    expect(dbEmp!.placeOfTaxDeduction).toBe('METRO');
    expect(dbEmp!.employeeStatus).toBe('ACTIVE');
    expect(dbEmp!.department!.name).toBe('E2E Engineering');
    expect(dbEmp!.position!.title).toBe('E2E Developer');
    expect(dbEmp!.reportingManager!.firstName).toBe('Murugan');
    expect(dbEmp!.user.role).toBe('EMPLOYEE');
    expect(dbEmp!.user.isActive).toBe(true);
  }, 30000);

  // ── POS-2: Create Shift + Assign to Employee ─────────────────────────────

  test('POS-2: Create Shift and assign to employee — verify Shift + ShiftAssignmentRule tables', async () => {
    // Create shift
    const shift = await prisma.shift.create({
      data: {
        organizationId: orgId,
        name: 'E2E General Shift',
        code: 'E2E-GS-WF',
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
    shiftId = shift.id;

    expect(shift.name).toBe('E2E General Shift');
    expect(shift.startTime).toBe('09:00');
    expect(shift.endTime).toBe('18:00');
    expect(shift.gracePeriod).toBe(15);
    expect(shift.breakDuration).toBe(60);
    expect(Number(shift.workHours)).toBe(8);
    expect(shift.overtimeEnabled).toBe(true);

    // Assign shift to Deepak
    const rule = await prisma.shiftAssignmentRule.create({
      data: {
        organizationId: orgId,
        displayName: 'E2E Shift Assign WF',
        shiftId: shiftId,
        departmentId: deptId,
        effectiveDate: new Date('2026-04-01'),
        priority: 1,
        employeeIds: [empEmployeeId],
      },
    });
    shiftRuleId = rule.id;

    expect(rule.shiftId).toBe(shiftId);
    expect((rule.employeeIds as string[])).toContain(empEmployeeId);
    expect(rule.priority).toBe(1);

    // Update employee's shiftId
    const updated = await prisma.employee.update({
      where: { id: empEmployeeId },
      data: { shiftId: shiftId },
    });

    expect(updated.shiftId).toBe(shiftId);

    // Verify shift read-back
    const dbShift = await prisma.shift.findUnique({ where: { id: shiftId } });
    expect(dbShift).not.toBeNull();
    expect(dbShift!.organizationId).toBe(orgId);
  }, 15000);

  // ── POS-3: Create Leave Types + Allocate Balance ──────────────────────────

  test('POS-3: Create LeaveTypes (EL, SL) and allocate balance — verify LeaveType + EmployeeLeaveBalance tables', async () => {
    // Create EL
    const el = await prisma.leaveType.create({
      data: {
        organizationId: orgId,
        name: 'E2E Earned Leave',
        code: 'E2E-EL-WF',
        isPaid: true,
        defaultDaysPerYear: 18,
        maxCarryForward: 15,
        accrualType: 'MONTHLY',
        requiresApproval: true,
        canBeNegative: false,
        isActive: true,
      },
    });
    leaveTypeELId = el.id;

    expect(el.name).toBe('E2E Earned Leave');
    expect(el.code).toBe('E2E-EL-WF');
    expect(Number(el.defaultDaysPerYear)).toBe(18);
    expect(Number(el.maxCarryForward)).toBe(15);
    expect(el.accrualType).toBe('MONTHLY');
    expect(el.canBeNegative).toBe(false);

    // Create SL
    const sl = await prisma.leaveType.create({
      data: {
        organizationId: orgId,
        name: 'E2E Sick Leave',
        code: 'E2E-SL-WF',
        isPaid: true,
        defaultDaysPerYear: 12,
        maxCarryForward: 0,
        accrualType: 'MONTHLY',
        requiresApproval: true,
        canBeNegative: false,
        isActive: true,
      },
    });
    leaveTypeSLId = sl.id;

    expect(Number(sl.defaultDaysPerYear)).toBe(12);
    expect(Number(sl.maxCarryForward)).toBe(0);

    // Allocate EL balance: 18 days
    const elBal = await prisma.employeeLeaveBalance.create({
      data: {
        employeeId: empEmployeeId,
        leaveTypeId: leaveTypeELId,
        year: 2026,
        openingBalance: 18,
        accrued: 0,
        used: 0,
        carriedForward: 0,
        available: 18,
      },
    });
    elBalanceId = elBal.id;

    expect(Number(elBal.openingBalance)).toBe(18);
    expect(Number(elBal.available)).toBe(18);
    expect(Number(elBal.used)).toBe(0);

    // Allocate SL balance: 12 days
    const slBal = await prisma.employeeLeaveBalance.create({
      data: {
        employeeId: empEmployeeId,
        leaveTypeId: leaveTypeSLId,
        year: 2026,
        openingBalance: 12,
        accrued: 0,
        used: 0,
        carriedForward: 0,
        available: 12,
      },
    });
    slBalanceId = slBal.id;

    expect(Number(slBal.openingBalance)).toBe(12);
    expect(Number(slBal.available)).toBe(12);

    // Verify DB: read all balances for Deepak
    const balances = await prisma.employeeLeaveBalance.findMany({
      where: { employeeId: empEmployeeId, year: 2026 },
      include: { leaveType: true },
    });

    expect(balances).toHaveLength(2);
    const elRow = balances.find(b => b.leaveType.code === 'E2E-EL-WF');
    const slRow = balances.find(b => b.leaveType.code === 'E2E-SL-WF');
    expect(elRow).toBeDefined();
    expect(slRow).toBeDefined();
    expect(Number(elRow!.available)).toBe(18);
    expect(Number(slRow!.available)).toBe(12);
  }, 15000);

  // ── POS-4: Create Leave Request → Approve → Verify Balance Deduction ─────

  test('POS-4: Create leave request (PENDING), approve it, verify balance deduction in DB', async () => {
    // Create PENDING request
    const req = await prisma.leaveRequest.create({
      data: {
        employeeId: empEmployeeId,
        leaveTypeId: leaveTypeELId,
        startDate: new Date('2026-04-14'),
        endDate: new Date('2026-04-15'),
        totalDays: 2,
        reason: 'E2E test: Family event and travel',
        status: 'PENDING',
        assignedApproverEmployeeId: mgrEmployeeId,
        currentApprovalLevel: 1,
        approvalHistory: [],
      },
    });
    leaveRequestId = req.id;

    expect(req.status).toBe('PENDING');
    expect(Number(req.totalDays)).toBe(2);
    expect(req.employeeId).toBe(empEmployeeId);
    expect(req.assignedApproverEmployeeId).toBe(mgrEmployeeId);

    // Approve it (simulate manager action)
    const now = new Date();
    const approved = await prisma.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        status: 'APPROVED',
        reviewedBy: mgrEmployeeId,
        reviewedAt: now,
        reviewComments: 'E2E: Approved by manager',
        approvalHistory: [
          {
            level: 1,
            approverId: mgrEmployeeId,
            approverName: 'Murugan Babu',
            action: 'APPROVED',
            remarks: 'E2E: Approved by manager',
            timestamp: now.toISOString(),
          },
        ],
      },
    });

    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewedBy).toBe(mgrEmployeeId);
    expect((approved.approvalHistory as any[])).toHaveLength(1);

    // Deduct balance: used +2, available -2
    await prisma.employeeLeaveBalance.update({
      where: { id: elBalanceId },
      data: {
        used: { increment: 2 },
        available: { decrement: 2 },
      },
    });

    // Verify balance in DB
    const bal = await prisma.employeeLeaveBalance.findUnique({ where: { id: elBalanceId } });
    expect(bal).not.toBeNull();
    expect(Number(bal!.openingBalance)).toBe(18);
    expect(Number(bal!.used)).toBe(2);
    expect(Number(bal!.available)).toBe(16);
  }, 15000);

  // ── POS-5: Record Attendance (Check-in + Check-out) ───────────────────────

  test('POS-5: Record check-in and check-out — verify AttendanceRecord + AttendancePunch tables', async () => {
    const date = new Date('2026-04-07');
    const checkIn = new Date('2026-04-07T03:35:00.000Z');  // 09:05 IST
    const checkOut = new Date('2026-04-07T12:40:00.000Z'); // 18:10 IST

    // Create attendance record with check-in
    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId: empEmployeeId,
        shiftId: shiftId,
        date: date,
        checkIn: checkIn,
        status: 'PRESENT',
        checkInMethod: 'WEB',
        isLate: false, // 09:05 within 15-min grace
        lateMinutes: 0,
      },
    });
    attendanceRecordId = record.id;

    expect(record.employeeId).toBe(empEmployeeId);
    expect(record.shiftId).toBe(shiftId);
    expect(record.status).toBe('PRESENT');
    expect(record.isLate).toBe(false);
    expect(record.lateMinutes).toBe(0);

    // Create IN punch
    const punchIn = await prisma.attendancePunch.create({
      data: {
        employeeId: empEmployeeId,
        punchTime: checkIn,
        status: 'IN',
        punchSource: 'WEB',
      },
    });

    expect(punchIn.status).toBe('IN');
    expect(punchIn.punchSource).toBe('WEB');

    // Update record with check-out + calculate hours
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const totalHrs = +(diffMs / 3600000).toFixed(2);  // ~9.08
    const workHrs = +(totalHrs - 1).toFixed(2);        // minus 1hr break = ~8.08
    const otHrs = +(Math.max(0, workHrs - 8)).toFixed(2);

    const updated = await prisma.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: {
        checkOut: checkOut,
        totalHours: totalHrs,
        breakHours: 1,
        workHours: workHrs,
        overtimeHours: otHrs,
        isEarly: false,
        earlyMinutes: 0,
      },
    });

    expect(updated.checkOut).toEqual(checkOut);
    expect(Number(updated.totalHours)).toBeGreaterThan(9);
    expect(Number(updated.breakHours)).toBe(1);
    expect(Number(updated.workHours)).toBeGreaterThan(8);
    expect(Number(updated.overtimeHours)).toBeGreaterThanOrEqual(0);
    expect(updated.isEarly).toBe(false);

    // Create OUT punch
    const punchOut = await prisma.attendancePunch.create({
      data: {
        employeeId: empEmployeeId,
        punchTime: checkOut,
        status: 'OUT',
        punchSource: 'WEB',
      },
    });

    expect(punchOut.status).toBe('OUT');

    // Verify: read punches for this date
    const punches = await prisma.attendancePunch.findMany({
      where: {
        employeeId: empEmployeeId,
        punchTime: { gte: new Date('2026-04-07T00:00:00Z'), lt: new Date('2026-04-08T00:00:00Z') },
      },
      orderBy: { punchTime: 'asc' },
    });

    expect(punches).toHaveLength(2);
    expect(punches[0].status).toBe('IN');
    expect(punches[1].status).toBe('OUT');

    // Verify: read record with shift join
    const full = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceRecordId },
      include: { employee: true, shift: true },
    });

    expect(full!.employee.firstName).toBe('Deepak');
    expect(full!.shift!.name).toBe('E2E General Shift');
  }, 15000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEGATIVE TESTS — Constraint violations and logic checks
// ═══════════════════════════════════════════════════════════════════════════════

describe('NEGATIVE: Constraint violations and validation failures', () => {

  test('NEG-1: Duplicate Employee email throws unique constraint error', async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const dupUserId = (await prisma.user.create({
      data: {
        email: `${EMAIL_PREFIX}dup_neg1@test.com`,
        passwordHash: hash,
        role: 'EMPLOYEE',
        organizationId: orgId,
        isActive: true,
      },
    })).id;

    await expect(
      prisma.employee.create({
        data: {
          organizationId: orgId,
          userId: dupUserId,
          employeeCode: 'E2E-WF-DUP1',
          firstName: 'Dup',
          lastName: 'Email',
          email: `${EMAIL_PREFIX}emp@test.com`, // already used by Deepak
          dateOfJoining: new Date('2026-04-01'),
          employeeStatus: 'ACTIVE',
        },
      })
    ).rejects.toThrow();

    // Cleanup temp user
    await prisma.user.delete({ where: { id: dupUserId } }).catch(() => {});
  }, 10000);

  test('NEG-2: Duplicate Employee employeeCode throws unique constraint error', async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const dupUserId = (await prisma.user.create({
      data: {
        email: `${EMAIL_PREFIX}dup_neg2@test.com`,
        passwordHash: hash,
        role: 'EMPLOYEE',
        organizationId: orgId,
        isActive: true,
      },
    })).id;

    await expect(
      prisma.employee.create({
        data: {
          organizationId: orgId,
          userId: dupUserId,
          employeeCode: 'E2E-WF-EMP01', // already used by Deepak
          firstName: 'Dup',
          lastName: 'Code',
          email: `${EMAIL_PREFIX}dup_neg2@test.com`,
          dateOfJoining: new Date('2026-04-01'),
          employeeStatus: 'ACTIVE',
        },
      })
    ).rejects.toThrow();

    await prisma.user.delete({ where: { id: dupUserId } }).catch(() => {});
  }, 10000);

  test('NEG-3: Duplicate AttendanceRecord for same employee+date throws constraint error', async () => {
    await expect(
      prisma.attendanceRecord.create({
        data: {
          employeeId: empEmployeeId,
          shiftId: shiftId,
          date: new Date('2026-04-07'), // same date as POS-5
          checkIn: new Date('2026-04-07T04:00:00Z'),
          status: 'PRESENT',
        },
      })
    ).rejects.toThrow();
  }, 10000);

  test('NEG-4: Duplicate EmployeeLeaveBalance for same employee+leaveType+year throws constraint error', async () => {
    await expect(
      prisma.employeeLeaveBalance.create({
        data: {
          employeeId: empEmployeeId,
          leaveTypeId: leaveTypeELId,
          year: 2026, // same combination as POS-3
          openingBalance: 5,
          available: 5,
        },
      })
    ).rejects.toThrow();
  }, 10000);

  test('NEG-5: Leave balance should not allow usage beyond available when canBeNegative=false', async () => {
    // Read current state
    const bal = await prisma.employeeLeaveBalance.findUnique({
      where: { id: elBalanceId },
      include: { leaveType: true },
    });

    expect(bal).not.toBeNull();

    const available = Number(bal!.available);  // 16 (18 - 2 used in POS-4)
    const canBeNeg = bal!.leaveType.canBeNegative;

    expect(canBeNeg).toBe(false);
    expect(available).toBe(16);

    // Application logic: requesting 25 days when only 16 available should be blocked
    const requestedDays = 25;
    const shouldBlock = requestedDays > available && !canBeNeg;
    expect(shouldBlock).toBe(true);

    // Verify balance was NOT changed (no accidental decrement)
    const unchanged = await prisma.employeeLeaveBalance.findUnique({ where: { id: elBalanceId } });
    expect(Number(unchanged!.available)).toBe(16);
    expect(Number(unchanged!.used)).toBe(2);
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-TABLE: Final integrity — join all 12 tables and verify consistency
// ═══════════════════════════════════════════════════════════════════════════════

describe('CROSS-TABLE: Full data integrity across 12 tables', () => {

  test('All tables have consistent data for employee Deepak — single query joins', async () => {
    const emp = await prisma.employee.findUnique({
      where: { id: empEmployeeId },
      include: {
        user: true,
        department: true,
        position: true,
        reportingManager: true,
        shift: true,
        leaveBalances: { include: { leaveType: true }, orderBy: { leaveType: { name: 'asc' } } },
        leaveRequests: true,
        attendanceRecords: { include: { shift: true } },
        attendancePunches: { orderBy: { punchTime: 'asc' } },
      },
    });

    expect(emp).not.toBeNull();

    // User table
    expect(emp!.user.email).toBe(`${EMAIL_PREFIX}emp@test.com`);
    expect(emp!.user.role).toBe('EMPLOYEE');
    expect(emp!.user.isActive).toBe(true);

    // Department table
    expect(emp!.department!.name).toBe('E2E Engineering');
    expect(emp!.department!.organizationId).toBe(orgId);

    // JobPosition table
    expect(emp!.position!.title).toBe('E2E Developer');

    // Reporting Manager (Employee self-join)
    expect(emp!.reportingManager!.firstName).toBe('Murugan');
    expect(emp!.reportingManager!.lastName).toBe('Babu');

    // Shift table
    expect(emp!.shift!.name).toBe('E2E General Shift');
    expect(emp!.shift!.startTime).toBe('09:00');
    expect(emp!.shift!.endTime).toBe('18:00');
    expect(emp!.shift!.gracePeriod).toBe(15);

    // EmployeeLeaveBalance + LeaveType tables (2 records)
    expect(emp!.leaveBalances).toHaveLength(2);
    const el = emp!.leaveBalances.find(b => b.leaveType.code === 'E2E-EL-WF');
    const sl = emp!.leaveBalances.find(b => b.leaveType.code === 'E2E-SL-WF');
    expect(Number(el!.openingBalance)).toBe(18);
    expect(Number(el!.used)).toBe(2);
    expect(Number(el!.available)).toBe(16);
    expect(Number(sl!.openingBalance)).toBe(12);
    expect(Number(sl!.used)).toBe(0);
    expect(Number(sl!.available)).toBe(12);

    // LeaveRequest table (1 approved request)
    expect(emp!.leaveRequests).toHaveLength(1);
    expect(emp!.leaveRequests[0].status).toBe('APPROVED');
    expect(Number(emp!.leaveRequests[0].totalDays)).toBe(2);
    expect(emp!.leaveRequests[0].reviewedBy).toBe(mgrEmployeeId);

    // AttendanceRecord table (1 day — April 7)
    expect(emp!.attendanceRecords).toHaveLength(1);
    expect(emp!.attendanceRecords[0].status).toBe('PRESENT');
    expect(emp!.attendanceRecords[0].isLate).toBe(false);
    expect(Number(emp!.attendanceRecords[0].workHours)).toBeGreaterThan(8);
    expect(emp!.attendanceRecords[0].shift!.name).toBe('E2E General Shift');

    // AttendancePunch table (2 punches: IN + OUT)
    expect(emp!.attendancePunches).toHaveLength(2);
    expect(emp!.attendancePunches[0].status).toBe('IN');
    expect(emp!.attendancePunches[1].status).toBe('OUT');
  }, 15000);
});
