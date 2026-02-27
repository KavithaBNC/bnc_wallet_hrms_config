/**
 * Test: Consider Late from Grace Time / Consider Early Going from Grace Time
 * Runs both cases (YES and NO) for an employee with attendance and shows calendar result.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/test-grace-time-policy-yes-no.ts
 */

import { prisma } from '../utils/prisma';
import { attendanceService } from '../services/attendance.service';

const POLICY_MARKER = '__POLICY_RULES__';

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

type PolicyJson = Record<string, unknown>;

function getPolicyFromRule(remarks: string | null): PolicyJson | null {
  if (!remarks) return null;
  const idx = remarks.indexOf(POLICY_MARKER);
  if (idx === -1) return null;
  try {
    return JSON.parse(remarks.slice(idx + POLICY_MARKER.length)) as PolicyJson;
  } catch {
    return null;
  }
}

function setPolicyInRemarks(remarks: string, policy: PolicyJson): string {
  const idx = remarks.indexOf(POLICY_MARKER);
  if (idx === -1) return remarks;
  const before = remarks.slice(0, idx + POLICY_MARKER.length);
  return before + JSON.stringify(policy);
}

async function main() {
  console.log('============================================================');
  console.log('  Test: Consider Late / Consider Early Going (YES vs NO)');
  console.log('============================================================\n');

  const rule = await prisma.shiftAssignmentRule.findFirst({
    where: { remarks: { contains: POLICY_MARKER } },
    orderBy: { effectiveDate: 'desc' },
  });

  if (!rule?.remarks) {
    console.log('No Late & Others (policy) rule found. Create one in Attendance Policy > Late & Others.');
    process.exit(1);
  }

  const originalPolicy = getPolicyFromRule(rule.remarks);
  if (!originalPolicy) {
    console.log('Could not parse policy JSON from rule.');
    process.exit(1);
  }

  const considerLate = originalPolicy.considerLateFromGraceTime === true;
  const considerEarly = originalPolicy.considerEarlyGoingFromGraceTime === true;
  console.log('Current policy rule:', rule.displayName);
  console.log('  Consider Late from Grace Time:    ', considerLate ? 'YES' : 'NO');
  console.log('  Consider Early Going from Grace:  ', considerEarly ? 'YES' : 'NO');
  console.log('');

  const dayStart = new Date('2026-02-20');
  dayStart.setHours(0, 0, 0, 0);

  let emp = await prisma.employee.findFirst({
    where: { firstName: { contains: 'manikandan', mode: 'insensitive' } },
    include: { shift: { select: { name: true, startTime: true, endTime: true } } },
  });

  if (!emp) {
    const recWithPunch = await prisma.attendanceRecord.findFirst({
      where: { date: dayStart, checkIn: { not: null }, checkOut: { not: null } },
      select: { employeeId: true },
    });
    if (recWithPunch) {
      emp = await prisma.employee.findUnique({
        where: { id: recWithPunch.employeeId },
        include: { shift: { select: { name: true, startTime: true, endTime: true } } },
      }) ?? null;
    }
  }

  if (!emp) {
    console.log('No employee "manikandan" and no attendance with both IN/OUT on 20 Feb. Create punches for 20 Feb or use another date.');
    process.exit(1);
  }

  const dateForSync = new Date(dayStart);
  const empId = emp.id;

  const printRecord = async (label: string) => {
    const r = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: empId, date: dateForSync } },
      include: { shift: { select: { name: true, startTime: true, endTime: true } } },
    });
    if (!r) {
      console.log(label, '→ No record.\n');
      return;
    }
    console.log(label);
    console.log('  First In:   ', r.checkIn ? formatTime(r.checkIn) : '—');
    console.log('  Last Out:   ', r.checkOut ? formatTime(r.checkOut) : '—');
    console.log('  isLate:     ', r.isLate === true ? 'true' : r.isLate === false ? 'false' : 'null');
    console.log('  lateMinutes:', r.lateMinutes ?? 'null');
    console.log('  isEarly:    ', r.isEarly === true ? 'true' : r.isEarly === false ? 'false' : 'null');
    console.log('  earlyMinutes:', r.earlyMinutes ?? 'null');
    console.log('  → Calendar shows Late:   ', r.isLate === true || (r.isLate !== false && (r.lateMinutes ?? 0) > 0) ? 'YES' : 'NO');
    console.log('  → Calendar shows Early:  ', r.isEarly === true || (r.isEarly !== false && (r.earlyMinutes ?? 0) > 0) ? 'YES' : 'NO');
    console.log('');
  };

  console.log('Employee:', emp.firstName, emp.lastName, '| Shift:', emp.shift?.name ?? '(none)', emp.shift ? `${emp.shift.startTime}–${emp.shift.endTime}` : '');
  console.log('Date: 20 Feb 2026\n');

  await printRecord('--- Case A: Current policy (before re-sync) ---');

  await attendanceService.syncAttendanceRecordFromPunches(empId, dateForSync);
  await printRecord('--- Case A: After sync with CURRENT rule (Consider Late = ' + (considerLate ? 'YES' : 'NO') + ', Early = ' + (considerEarly ? 'YES' : 'NO') + ') ---');

  const updatedNo: PolicyJson = { ...originalPolicy, considerLateFromGraceTime: false, considerEarlyGoingFromGraceTime: false };
  await prisma.shiftAssignmentRule.update({
    where: { id: rule.id },
    data: { remarks: setPolicyInRemarks(rule.remarks, updatedNo) },
  });
  await attendanceService.syncAttendanceRecordFromPunches(empId, dateForSync);
  await printRecord('--- Case B: Policy = NO (Consider Late = NO, Consider Early Going = NO) ---');

  const updatedYes: PolicyJson = { ...originalPolicy, considerLateFromGraceTime: true, considerEarlyGoingFromGraceTime: true };
  await prisma.shiftAssignmentRule.update({
    where: { id: rule.id },
    data: { remarks: setPolicyInRemarks(rule.remarks, updatedYes) },
  });
  await attendanceService.syncAttendanceRecordFromPunches(empId, dateForSync);
  await printRecord('--- Case A again: Policy = YES (Consider Late = YES, Consider Early Going = YES) ---');

  await prisma.shiftAssignmentRule.update({
    where: { id: rule.id },
    data: { remarks: setPolicyInRemarks(rule.remarks, originalPolicy) },
  });
  console.log('Rule restored to original settings.\n');

  console.log('============================================================');
  console.log('  Summary');
  console.log('============================================================');
  console.log('  When Consider Late = YES & Consider Early Going = YES:');
  console.log('    → Backend sets isLate / isEarly and minutes when applicable.');
  console.log('    → Calendar shows "Late: X min" and "Early going: X min".');
  console.log('  When both = NO:');
  console.log('    → Backend sets isLate: false, isEarly: false.');
  console.log('    → Calendar does NOT show Late or Early going (frontend respects false).');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
