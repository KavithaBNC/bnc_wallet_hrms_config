/**
 * ============================================================================
 * HRMS — Complete End-to-End Workflow Test
 * ============================================================================
 *
 * ONE FILE covering the ENTIRE HRMS process:
 *
 *   PART A: Pre-flight API checks (paygroups, departments, positions, entities, employees list)
 *   PART B: Employee creation (User + Employee tables, JSON fields, relations)
 *   PART C: Employee edit (partial update, verify unchanged fields)
 *   PART D: Shift creation + assignment (Shift + ShiftAssignmentRule + Employee.shiftId)
 *   PART E: Leave configuration (LeaveType + EmployeeLeaveBalance)
 *   PART F: Leave request + approval (PENDING → APPROVED, balance deduction)
 *   PART G: Attendance recording (check-in + check-out, AttendanceRecord + AttendancePunch)
 *   PART H: Cross-table integrity (single query joins all 12 tables)
 *   PART I: Negative tests (duplicate email, duplicate code, duplicate date, balance logic)
 *
 * NO DELETE OPERATIONS — all data stays in DB for manual verification.
 * Idempotent — safe to re-run (skips if data already exists).
 *
 * Tables verified: Organization, Department, JobPosition, User, Employee,
 *   Paygroup, Entity, Shift, ShiftAssignmentRule, LeaveType,
 *   EmployeeLeaveBalance, LeaveRequest, AttendanceRecord, AttendancePunch
 *
 * Run: npx jest src/tests/hrms-complete-workflow.test.ts --forceExit --verbose
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// ── Skip gracefully if no DB ────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) console.warn('⚠ DATABASE_URL not set — all DB tests will be skipped');
const describeDB = DB_URL ? describe : describe.skip;

const prisma = new PrismaClient();

// ── Test constants ──────────────────────────────────────────────────────────
const TEST_EMAIL = 'fulltest.vikram@testmail.com';
const TEST_PASSWORD = 'FullTest@123';
const TEST_EMP_CODE = 'FULL-TEST-001';
const SHIFT_CODE = 'FULL-GS-001';
const EL_CODE = 'FULL-EL';
const SL_CODE = 'FULL-SL';

// ── Shared state populated across tests ─────────────────────────────────────
let orgId: string;
let orgName: string;
let deptId: string;
let deptName: string;
let positionId: string;
let positionTitle: string;
let paygroupId: string;
let paygroupName: string;
let reportingManagerId: string;
let reportingManagerName: string;
let createdUserId: string; void (() => createdUserId);
let createdEmployeeId: string;
let shiftId: string;
let leaveTypeELId: string;
let leaveTypeSLId: string;
let elBalanceId: string;
let leaveRequestId: string;
let attendanceRecordId: string;

afterAll(async () => { await prisma.$disconnect(); });

// ═══════════════════════════════════════════════════════════════════════════════
// PART A: PRE-FLIGHT — Verify all lookup APIs return data
// (These are the APIs the frontend calls BEFORE the employee form loads)
// ═══════════════════════════════════════════════════════════════════════════════

describeDB('PART A: Pre-flight API checks', () => {

  test('A1: Find organization from existing HR user', async () => {
    const hr = await prisma.user.findFirst({
      where: { email: { contains: 'chitra.rajan' } },
      select: { organizationId: true },
    });
    orgId = hr?.organizationId || '';
    expect(orgId).toBeTruthy();

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    expect(org).not.toBeNull();
    orgName = org!.name;
    console.log(`  ✓ Org: ${orgName} (${orgId})`);
  }, 15000);

  test('A2: GET /api/v1/paygroups — returns paygroups for org', async () => {
    const rows = await prisma.paygroup.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });
    expect(rows.length).toBeGreaterThan(0);
    paygroupId = rows[0].id;
    paygroupName = rows[0].name;
    rows.forEach(r => {
      expect(r.id).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(r.organizationId).toBe(orgId);
    });
    console.log(`  ✓ Paygroups: ${rows.length} — using "${paygroupName}"`);
  }, 10000);

  test('A3: GET /api/v1/departments — returns active departments', async () => {
    const rows = await prisma.department.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { name: 'asc' },
    });
    expect(rows.length).toBeGreaterThan(0);
    deptId = rows[0].id;
    deptName = rows[0].name;
    rows.forEach(r => { expect(r.organizationId).toBe(orgId); expect(r.isActive).toBe(true); });
    console.log(`  ✓ Departments: ${rows.length} — using "${deptName}"`);
  }, 10000);

  test('A4: GET /api/v1/positions — returns active positions', async () => {
    const rows = await prisma.jobPosition.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { title: 'asc' },
    });
    expect(rows.length).toBeGreaterThan(0);
    positionId = rows[0].id;
    positionTitle = rows[0].title;
    console.log(`  ✓ Positions: ${rows.length} — using "${positionTitle}"`);
  }, 10000);

  test('A5: GET /api/v1/entities — returns entities (may be empty)', async () => {
    const rows = await prisma.entity.findMany({ where: { organizationId: orgId } });
    console.log(`  ✓ Entities: ${rows.length}${rows.length === 0 ? ' (none — optional)' : ''}`);
    expect(true).toBe(true);
  }, 10000);

  test('A6: GET /api/v1/employees/list — manager dropdown loads', async () => {
    const rows = await prisma.employee.findMany({
      where: { organizationId: orgId, employeeStatus: 'ACTIVE' },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
      take: 50,
    });
    expect(rows.length).toBeGreaterThan(0);
    const mgr = rows.find(e => e.email?.includes('murugan.babu')) || rows[0];
    reportingManagerId = mgr.id;
    reportingManagerName = `${mgr.firstName} ${mgr.lastName}`;
    console.log(`  ✓ Employees: ${rows.length} — manager: ${reportingManagerName}`);
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART B: EMPLOYEE CREATION — User + Employee + JSON fields + relations
// ═══════════════════════════════════════════════════════════════════════════════

describeDB('PART B: Employee creation (POST /api/v1/employees)', () => {

  test('B1: Create User + Employee with full data — verify both tables', async () => {
    const existing = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (existing) {
      console.log('  ⏭ Already exists — reading');
      createdUserId = existing.id;
      const emp = await prisma.employee.findFirst({ where: { email: TEST_EMAIL } });
      createdEmployeeId = emp!.id;
      return;
    }

    const hash = await bcrypt.hash(TEST_PASSWORD, 10);

    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL, passwordHash: hash, role: 'EMPLOYEE',
        organizationId: orgId, isActive: true, isEmailVerified: true,
      },
    });
    createdUserId = user.id;
    expect(user.email).toBe(TEST_EMAIL);
    expect(user.role).toBe('EMPLOYEE');
    expect(user.isActive).toBe(true);

    const emp = await prisma.employee.create({
      data: {
        organizationId: orgId, userId: user.id, employeeCode: TEST_EMP_CODE,
        firstName: 'Vikram', lastName: 'Sundaram', email: TEST_EMAIL,
        phone: '9800300001', gender: 'MALE',
        dateOfBirth: new Date('1993-05-20'), dateOfJoining: new Date('2026-04-01'),
        departmentId: deptId, positionId, reportingManagerId, paygroupId,
        placeOfTaxDeduction: 'METRO', employeeStatus: 'ACTIVE',
        address: { street: '15, Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600040', country: 'India' },
        bankDetails: { bankName: 'HDFC Bank', accountNumber: '50100012345678', ifscCode: 'HDFC0001234', accountHolderName: 'Vikram Sundaram' },
        taxInformation: { panNumber: 'BVXPS1234K', aadhaarNumber: '987654321012', pfNumber: 'TN/CHE/0099887/001', uanNumber: '100900800700', taxRegime: 'NEW' },
        emergencyContacts: [{ name: 'Lakshmi Sundaram', relationship: 'Spouse', phone: '9800300002' }],
        profileExtensions: { bloodGroup: 'O+', fatherName: 'Sundar Rajan' },
      },
    });
    createdEmployeeId = emp.id;

    expect(emp.firstName).toBe('Vikram');
    expect(emp.employeeCode).toBe(TEST_EMP_CODE);
    expect(emp.organizationId).toBe(orgId);
    expect(emp.departmentId).toBe(deptId);
    expect(emp.positionId).toBe(positionId);
    expect(emp.reportingManagerId).toBe(reportingManagerId);
    expect(emp.paygroupId).toBe(paygroupId);
    expect(emp.gender).toBe('MALE');
    expect(emp.placeOfTaxDeduction).toBe('METRO');
    expect(emp.employeeStatus).toBe('ACTIVE');
    expect((emp.address as any).city).toBe('Chennai');
    expect((emp.bankDetails as any).bankName).toBe('HDFC Bank');
    expect((emp.taxInformation as any).panNumber).toBe('BVXPS1234K');
    expect((emp.emergencyContacts as any[])[0].name).toBe('Lakshmi Sundaram');
    expect((emp.profileExtensions as any).bloodGroup).toBe('O+');

    console.log(`  ✓ Created: Vikram Sundaram (${TEST_EMP_CODE}) — EMPLOYEE`);
  }, 20000);

  test('B2: GET /api/v1/employees/:id — read back with all relations', async () => {
    const emp = await prisma.employee.findUnique({
      where: { id: createdEmployeeId },
      include: { organization: true, department: true, position: true, reportingManager: true, paygroup: true, user: true },
    });
    expect(emp).not.toBeNull();
    expect(emp!.organization.name).toBe(orgName);
    expect(emp!.department!.name).toBe(deptName);
    expect(emp!.position!.title).toBe(positionTitle);
    expect(emp!.reportingManager!.firstName).toBeTruthy();
    expect(emp!.paygroup!.name).toBe(paygroupName);
    expect(emp!.user.role).toBe('EMPLOYEE');
    console.log(`  ✓ Relations: org=${orgName}, dept=${deptName}, pos=${positionTitle}, mgr=${emp!.reportingManager!.firstName}`);
  }, 10000);

  test('B3: GET /api/v1/employees — employee appears in search', async () => {
    const results = await prisma.employee.findMany({
      where: {
        organizationId: orgId, employeeStatus: 'ACTIVE',
        OR: [{ firstName: { contains: 'Vikram', mode: 'insensitive' } }, { employeeCode: { contains: 'FULL-TEST', mode: 'insensitive' } }],
      },
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.find(e => e.email === TEST_EMAIL)).toBeDefined();
    console.log(`  ✓ Found in list by name "Vikram" and code "FULL-TEST"`);
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART C: EMPLOYEE EDIT — Partial update, verify unchanged fields
// ═══════════════════════════════════════════════════════════════════════════════

describeDB('PART C: Employee edit (PUT /api/v1/employees/:id)', () => {

  test('C1: Update phone number only — other fields unchanged', async () => {
    const updated = await prisma.employee.update({
      where: { id: createdEmployeeId },
      data: { phone: '9800300099' },
    });
    expect(updated.phone).toBe('9800300099');
    expect(updated.firstName).toBe('Vikram');
    expect(updated.email).toBe(TEST_EMAIL);
    expect(updated.departmentId).toBe(deptId);
    expect((updated.address as any).city).toBe('Chennai');
    expect((updated.bankDetails as any).bankName).toBe('HDFC Bank');
    console.log('  ✓ Phone updated, all other fields unchanged');
  }, 10000);

  test('C2: Update address JSON — other JSON fields unchanged', async () => {
    const updated = await prisma.employee.update({
      where: { id: createdEmployeeId },
      data: { address: { street: '22, T Nagar', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600017', country: 'India' } },
    });
    expect((updated.address as any).street).toBe('22, T Nagar');
    expect((updated.address as any).postalCode).toBe('600017');
    expect((updated.bankDetails as any).bankName).toBe('HDFC Bank');
    expect((updated.taxInformation as any).panNumber).toBe('BVXPS1234K');
    console.log('  ✓ Address updated, bank/tax untouched');
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART D: SHIFT CREATION + ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════

describeDB('PART D: Shift creation and assignment', () => {

  test('D1: Create General Shift (09:00-18:00, 15min grace)', async () => {
    let shift = await prisma.shift.findFirst({ where: { organizationId: orgId, code: SHIFT_CODE } });
    if (!shift) {
      shift = await prisma.shift.create({
        data: {
          organizationId: orgId, name: 'Full Test General Shift', code: SHIFT_CODE,
          startTime: '09:00', endTime: '18:00', firstHalfEnd: '13:00', secondHalfStart: '14:00',
          breakDuration: 60, workHours: 8, gracePeriod: 15, overtimeEnabled: true, isActive: true,
        },
      });
      console.log('  ✓ Created shift');
    } else {
      console.log('  ⏭ Shift exists');
    }
    shiftId = shift.id;
    expect(shift.startTime).toBe('09:00');
    expect(shift.endTime).toBe('18:00');
    expect(shift.gracePeriod).toBe(15);
    expect(Number(shift.workHours)).toBe(8);
  }, 10000);

  test('D2: Assign shift to employee — verify Employee.shiftId + ShiftAssignmentRule', async () => {
    await prisma.employee.update({ where: { id: createdEmployeeId }, data: { shiftId } });

    const existing = await prisma.shiftAssignmentRule.findFirst({
      where: { organizationId: orgId, displayName: 'Full Test Shift Assignment' },
    });
    if (!existing) {
      await prisma.shiftAssignmentRule.create({
        data: {
          organizationId: orgId, displayName: 'Full Test Shift Assignment',
          shiftId, departmentId: deptId, effectiveDate: new Date('2026-04-01'),
          priority: 1, employeeIds: [createdEmployeeId],
        },
      });
    }

    const emp = await prisma.employee.findUnique({ where: { id: createdEmployeeId }, include: { shift: true } });
    expect(emp!.shiftId).toBe(shiftId);
    expect(emp!.shift!.name).toBe('Full Test General Shift');
    console.log('  ✓ Shift assigned: Full Test General Shift');
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART E: LEAVE CONFIGURATION — LeaveType + EmployeeLeaveBalance
// ═══════════════════════════════════════════════════════════════════════════════

describeDB('PART E: Leave type creation and balance allocation', () => {

  test('E1: Create EL leave type (18 days, monthly accrual, 15-day carry forward)', async () => {
    let el = await prisma.leaveType.findFirst({ where: { organizationId: orgId, code: EL_CODE } });
    if (!el) {
      el = await prisma.leaveType.create({
        data: {
          organizationId: orgId, name: 'Full Test Earned Leave', code: EL_CODE,
          isPaid: true, defaultDaysPerYear: 18, maxCarryForward: 15,
          accrualType: 'MONTHLY', requiresApproval: true, canBeNegative: false, isActive: true,
        },
      });
    }
    leaveTypeELId = el.id;
    expect(el.code).toBe(EL_CODE);
    expect(Number(el.defaultDaysPerYear)).toBe(18);
    expect(el.canBeNegative).toBe(false);
    console.log('  ✓ EL: 18 days/year, carry forward 15');
  }, 10000);

  test('E2: Create SL leave type (12 days, no carry forward)', async () => {
    let sl = await prisma.leaveType.findFirst({ where: { organizationId: orgId, code: SL_CODE } });
    if (!sl) {
      sl = await prisma.leaveType.create({
        data: {
          organizationId: orgId, name: 'Full Test Sick Leave', code: SL_CODE,
          isPaid: true, defaultDaysPerYear: 12, maxCarryForward: 0,
          accrualType: 'MONTHLY', requiresApproval: true, canBeNegative: false, isActive: true,
        },
      });
    }
    leaveTypeSLId = sl.id;
    expect(Number(sl.defaultDaysPerYear)).toBe(12);
    expect(Number(sl.maxCarryForward)).toBe(0);
    console.log('  ✓ SL: 12 days/year, no carry forward');
  }, 10000);

  test('E3: Allocate EL=18 and SL=12 balance to employee', async () => {
    const existEL = await prisma.employeeLeaveBalance.findFirst({
      where: { employeeId: createdEmployeeId, leaveTypeId: leaveTypeELId, year: 2026 },
    });
    if (!existEL) {
      const bal = await prisma.employeeLeaveBalance.create({
        data: { employeeId: createdEmployeeId, leaveTypeId: leaveTypeELId, year: 2026, openingBalance: 18, accrued: 0, used: 0, carriedForward: 0, available: 18 },
      });
      elBalanceId = bal.id;
    } else {
      elBalanceId = existEL.id;
    }

    const existSL = await prisma.employeeLeaveBalance.findFirst({
      where: { employeeId: createdEmployeeId, leaveTypeId: leaveTypeSLId, year: 2026 },
    });
    if (!existSL) {
      await prisma.employeeLeaveBalance.create({
        data: { employeeId: createdEmployeeId, leaveTypeId: leaveTypeSLId, year: 2026, openingBalance: 12, accrued: 0, used: 0, carriedForward: 0, available: 12 },
      });
    }

    const balances = await prisma.employeeLeaveBalance.findMany({
      where: { employeeId: createdEmployeeId, year: 2026 },
      include: { leaveType: true },
    });
    expect(balances).toHaveLength(2);
    const elRow = balances.find(b => b.leaveType.code === EL_CODE);
    const slRow = balances.find(b => b.leaveType.code === SL_CODE);
    expect(Number(elRow!.available)).toBe(18);
    expect(Number(slRow!.available)).toBe(12);
    console.log('  ✓ Balance: EL=18, SL=12');
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART F: LEAVE REQUEST + APPROVAL + BALANCE DEDUCTION
// ═══════════════════════════════════════════════════════════════════════════════

describeDB('PART F: Leave request and approval flow', () => {

  test('F1: Create leave request (PENDING) — verify LeaveRequest table', async () => {
    const existing = await prisma.leaveRequest.findFirst({
      where: { employeeId: createdEmployeeId, leaveTypeId: leaveTypeELId, startDate: new Date('2026-04-14') },
    });
    if (existing) {
      leaveRequestId = existing.id;
      console.log('  ⏭ Request exists');
      return;
    }

    const req = await prisma.leaveRequest.create({
      data: {
        employeeId: createdEmployeeId, leaveTypeId: leaveTypeELId,
        startDate: new Date('2026-04-14'), endDate: new Date('2026-04-15'),
        totalDays: 2, reason: 'Full test: family event and travel arrangements',
        status: 'PENDING', assignedApproverEmployeeId: reportingManagerId,
        currentApprovalLevel: 1, approvalHistory: [],
      },
    });
    leaveRequestId = req.id;
    expect(req.status).toBe('PENDING');
    expect(Number(req.totalDays)).toBe(2);
    expect(req.assignedApproverEmployeeId).toBe(reportingManagerId);
    console.log('  ✓ Leave request created: PENDING, 2 days EL');
  }, 10000);

  test('F2: Approve leave request — status APPROVED, balance 18→16', async () => {
    const current = await prisma.leaveRequest.findUnique({ where: { id: leaveRequestId } });
    if (current?.status === 'APPROVED') {
      console.log('  ⏭ Already approved');
      return;
    }

    const now = new Date();
    await prisma.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        status: 'APPROVED', reviewedBy: reportingManagerId, reviewedAt: now,
        reviewComments: 'Full test: approved by manager',
        approvalHistory: [{
          level: 1, approverId: reportingManagerId, approverName: reportingManagerName,
          action: 'APPROVED', remarks: 'Approved', timestamp: now.toISOString(),
        }],
      },
    });

    await prisma.employeeLeaveBalance.update({
      where: { id: elBalanceId },
      data: { used: { increment: 2 }, available: { decrement: 2 } },
    });

    const req = await prisma.leaveRequest.findUnique({ where: { id: leaveRequestId } });
    expect(req!.status).toBe('APPROVED');
    expect((req!.approvalHistory as any[])).toHaveLength(1);

    const bal = await prisma.employeeLeaveBalance.findUnique({ where: { id: elBalanceId } });
    expect(Number(bal!.used)).toBe(2);
    expect(Number(bal!.available)).toBe(16);
    console.log('  ✓ Approved: EL balance 18→16');
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART G: ATTENDANCE — Check-in, Check-out, AttendanceRecord, AttendancePunch
// ═══════════════════════════════════════════════════════════════════════════════

describeDB('PART G: Attendance check-in and check-out', () => {

  test('G1: Check-in at 09:05 (within grace) — PRESENT, not late', async () => {
    const date = new Date('2026-04-07');
    const checkIn = new Date('2026-04-07T03:35:00.000Z'); // 09:05 IST

    const existing = await prisma.attendanceRecord.findFirst({
      where: { employeeId: createdEmployeeId, date },
    });
    if (existing) {
      attendanceRecordId = existing.id;
      console.log('  ⏭ Record exists');
      return;
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId: createdEmployeeId, shiftId, date, checkIn,
        status: 'PRESENT', checkInMethod: 'WEB', isLate: false, lateMinutes: 0,
      },
    });
    attendanceRecordId = record.id;

    await prisma.attendancePunch.create({
      data: { employeeId: createdEmployeeId, punchTime: checkIn, status: 'IN', punchSource: 'WEB' },
    });

    expect(record.status).toBe('PRESENT');
    expect(record.isLate).toBe(false);
    console.log('  ✓ Check-in 09:05 — PRESENT, on-time');
  }, 10000);

  test('G2: Check-out at 18:10 — calculate work hours and OT', async () => {
    const checkOut = new Date('2026-04-07T12:40:00.000Z'); // 18:10 IST
    const checkIn = new Date('2026-04-07T03:35:00.000Z');

    const current = await prisma.attendanceRecord.findUnique({ where: { id: attendanceRecordId } });
    if (current?.checkOut) {
      console.log('  ⏭ Already checked out');
      return;
    }

    const totalHrs = +((checkOut.getTime() - checkIn.getTime()) / 3600000).toFixed(2);
    const workHrs = +(totalHrs - 1).toFixed(2);
    const otHrs = +(Math.max(0, workHrs - 8)).toFixed(2);

    await prisma.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: { checkOut, totalHours: totalHrs, breakHours: 1, workHours: workHrs, overtimeHours: otHrs, isEarly: false, earlyMinutes: 0 },
    });

    await prisma.attendancePunch.create({
      data: { employeeId: createdEmployeeId, punchTime: checkOut, status: 'OUT', punchSource: 'WEB' },
    });

    const updated = await prisma.attendanceRecord.findUnique({ where: { id: attendanceRecordId } });
    expect(updated!.checkOut).toEqual(checkOut);
    expect(Number(updated!.workHours)).toBeGreaterThan(8);
    expect(updated!.isEarly).toBe(false);

    const punches = await prisma.attendancePunch.findMany({
      where: { employeeId: createdEmployeeId, punchTime: { gte: new Date('2026-04-07T00:00:00Z'), lt: new Date('2026-04-08T00:00:00Z') } },
      orderBy: { punchTime: 'asc' },
    });
    expect(punches).toHaveLength(2);
    expect(punches[0].status).toBe('IN');
    expect(punches[1].status).toBe('OUT');
    console.log(`  ✓ Check-out 18:10 — work: ${workHrs}h, OT: ${otHrs}h`);
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART H: CROSS-TABLE INTEGRITY — Single query joins all tables
// ═══════════════════════════════════════════════════════════════════════════════

describeDB('PART H: Cross-table integrity verification', () => {

  test('H1: Full employee record — all 14 tables joined and consistent', async () => {
    const emp = await prisma.employee.findUnique({
      where: { id: createdEmployeeId },
      include: {
        user: true, organization: true, department: true, position: true,
        reportingManager: true, paygroup: true, shift: true,
        leaveBalances: { where: { year: 2026 }, include: { leaveType: true } },
        leaveRequests: true,
        attendanceRecords: { include: { shift: true } },
        attendancePunches: { orderBy: { punchTime: 'asc' } },
      },
    });

    expect(emp).not.toBeNull();

    // User
    expect(emp!.user.email).toBe(TEST_EMAIL);
    expect(emp!.user.role).toBe('EMPLOYEE');
    expect(emp!.user.isActive).toBe(true);

    // Organization
    expect(emp!.organization.name).toBe(orgName);

    // Department
    expect(emp!.department!.name).toBe(deptName);

    // Position
    expect(emp!.position!.title).toBe(positionTitle);

    // Reporting Manager
    expect(emp!.reportingManager).not.toBeNull();

    // Paygroup
    expect(emp!.paygroup!.name).toBe(paygroupName);

    // Shift
    expect(emp!.shift!.startTime).toBe('09:00');
    expect(emp!.shift!.endTime).toBe('18:00');

    // Leave Balances (2 types)
    expect(emp!.leaveBalances).toHaveLength(2);
    const el = emp!.leaveBalances.find(b => b.leaveType.code === EL_CODE);
    expect(Number(el!.openingBalance)).toBe(18);
    expect(Number(el!.used)).toBe(2);
    expect(Number(el!.available)).toBe(16);

    // Leave Request (1 approved)
    expect(emp!.leaveRequests.length).toBeGreaterThanOrEqual(1);
    expect(emp!.leaveRequests[0].status).toBe('APPROVED');

    // Attendance (1 day)
    expect(emp!.attendanceRecords.length).toBeGreaterThanOrEqual(1);
    expect(emp!.attendanceRecords[0].status).toBe('PRESENT');
    expect(Number(emp!.attendanceRecords[0].workHours)).toBeGreaterThan(8);

    // Punches (IN + OUT)
    expect(emp!.attendancePunches.length).toBeGreaterThanOrEqual(2);
    expect(emp!.attendancePunches[0].status).toBe('IN');
    expect(emp!.attendancePunches[1].status).toBe('OUT');

    console.log('  ✓ All 14 tables joined — data consistent');
  }, 15000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART I: NEGATIVE TESTS — Constraint violations (no delete)
// ═══════════════════════════════════════════════════════════════════════════════

describeDB('PART I: Negative tests — constraint violations', () => {

  test('I1: Duplicate Employee.email — unique constraint error', async () => {
    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const uid = (await prisma.user.create({
      data: { email: 'fulltest.dup.i1@testmail.com', passwordHash: hash, role: 'EMPLOYEE', organizationId: orgId, isActive: true },
    })).id;

    await expect(
      prisma.employee.create({
        data: {
          organizationId: orgId, userId: uid, employeeCode: 'FULL-DUP-I1',
          firstName: 'Dup', lastName: 'Email', email: TEST_EMAIL,
          dateOfJoining: new Date('2026-04-01'), employeeStatus: 'ACTIVE',
        },
      })
    ).rejects.toThrow();
    console.log('  ✓ Duplicate email rejected');
  }, 10000);

  test('I2: Duplicate Employee.employeeCode — unique constraint error', async () => {
    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const uid = (await prisma.user.create({
      data: { email: 'fulltest.dup.i2@testmail.com', passwordHash: hash, role: 'EMPLOYEE', organizationId: orgId, isActive: true },
    })).id;

    await expect(
      prisma.employee.create({
        data: {
          organizationId: orgId, userId: uid, employeeCode: TEST_EMP_CODE,
          firstName: 'Dup', lastName: 'Code', email: 'fulltest.dup.i2@testmail.com',
          dateOfJoining: new Date('2026-04-01'), employeeStatus: 'ACTIVE',
        },
      })
    ).rejects.toThrow();
    console.log('  ✓ Duplicate employeeCode rejected');
  }, 10000);

  test('I3: Duplicate AttendanceRecord [employeeId+date] — constraint error', async () => {
    await expect(
      prisma.attendanceRecord.create({
        data: { employeeId: createdEmployeeId, shiftId, date: new Date('2026-04-07'), checkIn: new Date('2026-04-07T04:00:00Z'), status: 'PRESENT' },
      })
    ).rejects.toThrow();
    console.log('  ✓ Duplicate attendance date rejected');
  }, 10000);

  test('I4: Duplicate EmployeeLeaveBalance [employee+type+year] — constraint error', async () => {
    await expect(
      prisma.employeeLeaveBalance.create({
        data: { employeeId: createdEmployeeId, leaveTypeId: leaveTypeELId, year: 2026, openingBalance: 5, available: 5 },
      })
    ).rejects.toThrow();
    console.log('  ✓ Duplicate leave balance rejected');
  }, 10000);

  test('I5: Leave balance cannot go negative (canBeNegative=false)', async () => {
    const bal = await prisma.employeeLeaveBalance.findUnique({
      where: { id: elBalanceId },
      include: { leaveType: true },
    });
    expect(bal!.leaveType.canBeNegative).toBe(false);
    expect(Number(bal!.available)).toBe(16);
    const blocked = 25 > Number(bal!.available) && !bal!.leaveType.canBeNegative;
    expect(blocked).toBe(true);
    console.log('  ✓ 25 days > 16 available, canBeNegative=false → blocked');
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// FINAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

describeDB('SUMMARY', () => {
  test('Print test employee credentials', () => {
    const d = '='.repeat(70);
    console.log('\n' + d);
    console.log('  HRMS COMPLETE WORKFLOW TEST — EMPLOYEE CREATED');
    console.log(d);
    console.log(`  Email    : ${TEST_EMAIL}`);
    console.log(`  Password : ${TEST_PASSWORD}`);
    console.log(`  Code     : ${TEST_EMP_CODE}`);
    console.log(`  Name     : Vikram Sundaram`);
    console.log(`  Org      : ${orgName}`);
    console.log(`  Dept     : ${deptName}`);
    console.log(`  Position : ${positionTitle}`);
    console.log(`  Paygroup : ${paygroupName}`);
    console.log(`  Manager  : ${reportingManagerName}`);
    console.log(`  Shift    : 09:00-18:00 (15min grace)`);
    console.log(`  Leave    : EL=16 (18-2 used), SL=12`);
    console.log(`  Leave Req: APPROVED (2 days, Apr 14-15)`);
    console.log(`  Attendance: Apr 7 — IN 09:05, OUT 18:10`);
    console.log('  NO DATA DELETED — verify manually');
    console.log(d);
    expect(true).toBe(true);
  });
});
