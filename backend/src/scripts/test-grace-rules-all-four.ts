/**
 * Test all 4 combinations of:
 *   1. Consider Late from Grace Time  (YES / NO)
 *   2. Consider Early Going from Grace Time (YES / NO)
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/test-grace-rules-all-four.ts
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
  console.log('  Test: Consider Late & Consider Early Going — All 4 cases');
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

  const dayStart = new Date('2026-02-20');
  dayStart.setHours(0, 0, 0, 0);

  // Prefer employee with shift so late/early can be computed when policy is YES
  let emp = await prisma.employee.findFirst({
    where: {
      shiftId: { not: null },
      attendancePunches: {
        some: {
          punchTime: { gte: dayStart, lt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) },
        },
      },
    },
    include: { shift: { select: { name: true, startTime: true, endTime: true } } },
  });

  if (!emp) {
    emp = await prisma.employee.findFirst({
      where: { firstName: { contains: 'manikandan', mode: 'insensitive' } },
      include: { shift: { select: { name: true, startTime: true, endTime: true } } },
    });
  }
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
    console.log('No suitable employee (with punches on 20 Feb or manikandan).');
    process.exit(1);
  }

  const dateForSync = new Date(dayStart);
  const empId = emp.id;

  const printRecord = (label: string, r: {
    checkIn: Date | null;
    checkOut: Date | null;
    isLate: boolean | null;
    lateMinutes: number | null;
    isEarly: boolean | null;
    earlyMinutes: number | null;
  }) => {
    console.log(label);
    console.log('  First In:    ', r.checkIn ? formatTime(r.checkIn) : '—');
    console.log('  Last Out:    ', r.checkOut ? formatTime(r.checkOut) : '—');
    console.log('  isLate:      ', r.isLate === true ? 'true' : r.isLate === false ? 'false' : 'null');
    console.log('  lateMinutes: ', r.lateMinutes ?? 'null');
    console.log('  isEarly:     ', r.isEarly === true ? 'true' : r.isEarly === false ? 'false' : 'null');
    console.log('  earlyMinutes:', r.earlyMinutes ?? 'null');
    const showLate = r.isLate === true || (r.isLate !== false && (r.lateMinutes ?? 0) > 0);
    const showEarly = r.isEarly === true || (r.isEarly !== false && (r.earlyMinutes ?? 0) > 0);
    console.log('  → Calendar shows Late:   ', showLate ? 'YES' : 'NO');
    console.log('  → Calendar shows Early:  ', showEarly ? 'YES' : 'NO');
    console.log('');
    return { showLate, showEarly };
  };

  console.log('Employee:', emp.firstName, emp.lastName);
  console.log('Shift:   ', emp.shift?.name ?? '(none)', emp.shift ? `(${emp.shift.startTime} – ${emp.shift.endTime})` : '');
  if (!emp.shift) {
    console.log('Note:    No shift assigned → late/early are never computed (no shift times to compare).');
    console.log('         Assign a shift to this employee to see Late/Early differ across the 4 cases.\n');
  }
  console.log('Date:    20 Feb 2026\n');

  const cases: Array<{ considerLate: boolean; considerEarly: boolean; label: string }> = [
    { considerLate: true,  considerEarly: true,  label: '1. Consider Late = YES,  Consider Early Going = YES' },
    { considerLate: true,  considerEarly: false, label: '2. Consider Late = YES,  Consider Early Going = NO' },
    { considerLate: false, considerEarly: true,  label: '3. Consider Late = NO,   Consider Early Going = YES' },
    { considerLate: false, considerEarly: false, label: '4. Consider Late = NO,   Consider Early Going = NO' },
  ];

  const results: Array<{ label: string; showLate: boolean; showEarly: boolean; isLate: boolean | null; lateMin: number | null; isEarly: boolean | null; earlyMin: number | null }> = [];

  for (const c of cases) {
    const policy: PolicyJson = {
      ...originalPolicy,
      considerLateFromGraceTime: c.considerLate,
      considerEarlyGoingFromGraceTime: c.considerEarly,
    };
    await prisma.shiftAssignmentRule.update({
      where: { id: rule.id },
      data: { remarks: setPolicyInRemarks(rule.remarks, policy) },
    });
    await attendanceService.syncAttendanceRecordFromPunches(empId, dateForSync);

    const r = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: empId, date: dateForSync } },
    });

    if (!r) {
      console.log('--- ' + c.label + ' ---');
      console.log('  No attendance record.\n');
      results.push({ label: c.label, showLate: false, showEarly: false, isLate: null, lateMin: null, isEarly: null, earlyMin: null });
      continue;
    }

    const { showLate, showEarly } = printRecord('--- ' + c.label + ' ---', {
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      isLate: r.isLate,
      lateMinutes: r.lateMinutes,
      isEarly: r.isEarly,
      earlyMinutes: r.earlyMinutes,
    });
    results.push({
      label: c.label,
      showLate,
      showEarly,
      isLate: r.isLate,
      lateMin: r.lateMinutes,
      isEarly: r.isEarly,
      earlyMin: r.earlyMinutes,
    });
  }

  // Restore original policy
  await prisma.shiftAssignmentRule.update({
    where: { id: rule.id },
    data: { remarks: setPolicyInRemarks(rule.remarks, originalPolicy) },
  });
  console.log('Rule restored to original settings.\n');

  // Summary table
  console.log('============================================================');
  console.log('  RESULT SUMMARY (Calendar behaviour)');
  console.log('============================================================');
  console.log('');
  console.log('  Condition                              | Calendar Late | Calendar Early');
  console.log('  ---------------------------------------|---------------|---------------');
  for (const res of results) {
    const lateStr = res.showLate ? 'YES' : 'NO';
    const earlyStr = res.showEarly ? 'YES' : 'NO';
    console.log('  ' + res.label.padEnd(38) + ' | ' + lateStr.padEnd(13) + ' | ' + earlyStr);
  }
  console.log('');
  console.log('  Rule behaviour:');
  console.log('  • Consider Late = YES  → late check-in is marked; calendar can show "Late: X min".');
  console.log('  • Consider Late = NO  → late is not considered; calendar does NOT show Late.');
  console.log('  • Consider Early Going = YES → early check-out is marked; calendar can show "Early going: X min".');
  console.log('  • Consider Early Going = NO  → early is not considered; calendar does NOT show Early.');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
