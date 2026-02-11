/**
 * Test "Consider Early Going as Shortfall" YES vs NO for saravanan ss on 24th, 25th, 26th.
 * Punch: IN 09:00, OUT 17:30 (30 min early vs 18:00 shift end with 5 min grace = 25 min early).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/test-saravanan-24-25-early-going.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/test-saravanan-24-25-early-going.ts --recalc-only
 *   npx ts-node -r tsconfig-paths/register src/scripts/test-saravanan-24-25-early-going.ts --both
 *   npx ts-node -r tsconfig-paths/register src/scripts/test-saravanan-24-25-early-going.ts --date=26
 *
 * How to test 26th (shortfall should show):
 *   1. From backend folder run (creates 09:00 IN, 17:30 OUT for 24–26 and syncs):
 *      npx ts-node -r tsconfig-paths/register src/scripts/test-saravanan-24-25-early-going.ts
 *   2. In UI: Attendance → select employee "saravanan ss", month Feb 2026. You should see Shortfall + D on 24, 25, 26.
 *   3. If 26th still doesn’t show shortfall: run with --date=26 then click Refresh on the Attendance page.
 *
 * Test BOTH cases (YES / NO) dynamically in the UI (no code change):
 *   Set Consider Early Going as Shortfall = YES in Attendance Policy, Save. On Attendance click Refresh -> see Shortfall + D.
 *   Set it to NO, Save. On Attendance click Refresh (or switch tab and back) -> Shortfall/D disappear; Early going only.
 */

import { prisma } from '../utils/prisma';
import { attendanceService } from '../services/attendance.service';

const POLICY_MARKER = '__POLICY_RULES__';
function getPolicyFromRule(remarks: string | null): Record<string, unknown> | null {
  if (!remarks) return null;
  const idx = remarks.indexOf(POLICY_MARKER);
  if (idx === -1) return null;
  try {
    return JSON.parse(remarks.slice(idx + POLICY_MARKER.length)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
function setPolicyInRemarks(remarks: string, policy: Record<string, unknown>): string {
  const idx = remarks.indexOf(POLICY_MARKER);
  if (idx === -1) return remarks;
  const before = remarks.slice(0, idx + POLICY_MARKER.length);
  return before + JSON.stringify(policy);
}

const DATE_24 = new Date(2026, 1, 24); // Feb 24, 2026
const DATE_25 = new Date(2026, 1, 25);
const DATE_26 = new Date(2026, 1, 26);
[DATE_24, DATE_25, DATE_26].forEach((d) => d.setHours(0, 0, 0, 0));

function getTestDates(): Date[] {
  const dateArg = process.argv.find((a) => a.startsWith('--date='));
  if (dateArg) {
    const day = parseInt(dateArg.replace('--date=', ''), 10);
    if (day >= 1 && day <= 31) {
      const d = new Date(2026, 1, day);
      d.setHours(0, 0, 0, 0);
      return [d];
    }
  }
  return [DATE_24, DATE_25, DATE_26];
}

function timeOn(date: Date, h: number, m: number): Date {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

async function run() {
  const recalcOnly = process.argv.includes('--recalc-only');
  const both = process.argv.includes('--both');

  const testDates = getTestDates();
  console.log('\n============================================================');
  console.log('  Saravanan – Early Going YES/NO test');
  console.log('  Dates:', testDates.map((d) => d.getDate()).join(', '), 'Feb 2026');
  console.log('  Mode:', both ? 'BOTH (YES then NO, then restore)' : recalcOnly ? 'RECALC ONLY (no punch create)' : 'CREATE PUNCHES + SYNC');
  console.log('============================================================\n');

  // Prefer "saravanan ss" (lastName ss) or employeeCode 3004; else any saravanan
  let emp = await prisma.employee.findFirst({
    where: { lastName: { equals: 'ss', mode: 'insensitive' }, firstName: { contains: 'saravanan', mode: 'insensitive' } },
    include: { shift: { select: { name: true, startTime: true, endTime: true } } },
  });
  if (!emp) {
    emp = await prisma.employee.findFirst({
      where: { employeeCode: '3004' },
      include: { shift: { select: { name: true, startTime: true, endTime: true } } },
    }) ?? null;
  }
  if (!emp) {
    emp = await prisma.employee.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'saravanan', mode: 'insensitive' } },
          { lastName: { contains: 'saravanan', mode: 'insensitive' } },
        ],
      },
      include: { shift: { select: { name: true, startTime: true, endTime: true } } },
    }) ?? null;
  }

  if (!emp) {
    console.log('Employee "saravanan" not found. Create or fix name.');
    process.exit(1);
  }

  const employeeId = emp.id;
  console.log('Employee:', emp.firstName, emp.lastName, '(', emp.employeeCode, ')');
  console.log('Default shift:', emp.shift?.name ?? '(none)', emp.shift ? `${emp.shift.startTime}–${emp.shift.endTime}` : '');
  if (!emp.shift) {
    const { shiftAssignmentRuleService } = await import('../services/shift-assignment-rule.service');
    const fromRule = await shiftAssignmentRuleService.getApplicableShiftForEmployee(employeeId, testDates[0], emp.organizationId);
    console.log('Shift from rules (' + testDates[0].getDate() + 'th):', fromRule ? `${fromRule.name} ${fromRule.startTime}–${fromRule.endTime}` : '(none – set Shift Assign rule or default shift for policy to apply)');
  }
  console.log('');

  async function ensurePunches() {
    for (const day of testDates) {
      const dayEnd = new Date(day);
      dayEnd.setDate(dayEnd.getDate() + 1);
      if (!recalcOnly && !both) {
        await prisma.attendancePunch.deleteMany({
          where: { employeeId, punchTime: { gte: day, lt: dayEnd } },
        });
        await prisma.attendancePunch.create({
          data: { employeeId, punchTime: timeOn(day, 9, 0), status: 'IN', punchSource: 'MANUAL' },
        });
        await prisma.attendancePunch.create({
          data: { employeeId, punchTime: timeOn(day, 17, 30), status: 'OUT', punchSource: 'MANUAL' },
        });
      }
    }
    if (both) {
      for (const day of testDates) {
        const dayEnd = new Date(day);
        dayEnd.setDate(dayEnd.getDate() + 1);
        await prisma.attendancePunch.deleteMany({
          where: { employeeId, punchTime: { gte: day, lt: dayEnd } },
        });
        await prisma.attendancePunch.create({
          data: { employeeId, punchTime: timeOn(day, 9, 0), status: 'IN', punchSource: 'MANUAL' },
        });
        await prisma.attendancePunch.create({
          data: { employeeId, punchTime: timeOn(day, 17, 30), status: 'OUT', punchSource: 'MANUAL' },
        });
      }
    }
  }

  function printRecord(day: Date, record: { status: string | null; isEarly: boolean | null; earlyMinutes: number | null; isDeviation: boolean | null; deviationReason: string | null; workHours: unknown } | null) {
    const y = day.getFullYear(), m = day.getMonth() + 1, d = day.getDate();
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    console.log('---', dateStr, '---');
    if (!record) {
      console.log('  No record after sync.');
      console.log('');
      return;
    }
    console.log('  status:', record.status);
    console.log('  isEarly:', record.isEarly);
    console.log('  earlyMinutes:', record.earlyMinutes);
    console.log('  isDeviation:', record.isDeviation);
    console.log('  deviationReason:', record.deviationReason ?? '(null)');
    console.log('  workHours:', record.workHours?.toString());
    console.log('');
  }

  if (both) {
    await ensurePunches();
    const { shiftAssignmentRuleService } = await import('../services/shift-assignment-rule.service');
    const shiftFromRule = await shiftAssignmentRuleService.getApplicableShiftForEmployee(employeeId, testDates[0], emp.organizationId);
    const shiftId = shiftFromRule?.id ?? null;
    const rules = await prisma.shiftAssignmentRule.findMany({
      where: {
        organizationId: emp.organizationId,
        ...(shiftId ? { shiftId } : {}),
        effectiveDate: { lte: testDates[0] },
        remarks: { contains: POLICY_MARKER },
      },
      orderBy: [{ priority: 'desc' }, { effectiveDate: 'desc' }],
    });
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { paygroupId: true, departmentId: true },
    });
    const matchingRules = rules.filter((rule) => {
      const employeeIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
      if (employeeIds.length > 0 && employeeIds.includes(employeeId)) return true;
      if (rule.paygroupId && rule.departmentId) return rule.paygroupId === employee?.paygroupId && rule.departmentId === employee?.departmentId;
      if (rule.paygroupId && !rule.departmentId) return rule.paygroupId === employee?.paygroupId;
      if (!rule.paygroupId && rule.departmentId) return rule.departmentId === employee?.departmentId;
      return true;
    });
    const rule = matchingRules[0] ?? null;
    if (!rule?.remarks) {
      console.log('No policy rule applicable to this employee. Create Attendance Policy (Late & Others) and assign to paygroup/department/org.');
      process.exit(1);
    }
    const originalPolicy = getPolicyFromRule(rule.remarks);
    if (!originalPolicy) {
      console.log('Could not parse policy JSON.');
      process.exit(1);
    }

    console.log('=== Case 1: Consider Early Going as Shortfall = YES (current) ===\n');
    for (const day of testDates) {
      await attendanceService.syncAttendanceRecordFromPunches(employeeId, day);
      const record = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId, date: day } },
      });
      printRecord(day, record);
    }

    const policyNo = { ...originalPolicy, considerEarlyGoingAsShortfall: false };
    await prisma.shiftAssignmentRule.update({
      where: { id: rule.id },
      data: { remarks: setPolicyInRemarks(rule.remarks, policyNo) },
    });
    console.log('=== Case 2: Consider Early Going as Shortfall = NO ===\n');
    for (const day of testDates) {
      await attendanceService.syncAttendanceRecordFromPunches(employeeId, day);
      const record = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId, date: day } },
      });
      printRecord(day, record);
    }

    await prisma.shiftAssignmentRule.update({
      where: { id: rule.id },
      data: { remarks: setPolicyInRemarks(rule.remarks, originalPolicy) },
    });
    console.log('Policy restored to original.\n');
  } else {
    for (const day of testDates) {
      const dayEnd = new Date(day);
      dayEnd.setDate(dayEnd.getDate() + 1);
      if (!recalcOnly) {
        await prisma.attendancePunch.deleteMany({
          where: { employeeId, punchTime: { gte: day, lt: dayEnd } },
        });
        await prisma.attendancePunch.create({
          data: { employeeId, punchTime: timeOn(day, 9, 0), status: 'IN', punchSource: 'MANUAL' },
        });
        await prisma.attendancePunch.create({
          data: { employeeId, punchTime: timeOn(day, 17, 30), status: 'OUT', punchSource: 'MANUAL' },
        });
      }
      await attendanceService.syncAttendanceRecordFromPunches(employeeId, day);
      const record = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId, date: day } },
      });
      printRecord(day, record);
    }
  }

  console.log('============================================================');
  console.log('  Expected:');
  console.log('  - Consider Early Going as Shortfall = YES → isDeviation true, deviationReason contains Shortfall, Early going + Shortfall badges.');
  console.log('  - Consider Early Going as Shortfall = NO  → isDeviation false, no Shortfall; Early going badge only.');
  console.log('============================================================\n');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
