/**
 * Test attendance policy scenarios: Late, Early, Deviation, OT.
 * Creates punches for a test date, runs sync, asserts expected values.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/test-attendance-policy-scenarios.ts
 */

import { prisma } from '../utils/prisma';
import { attendanceService } from '../services/attendance.service';

const TEST_DATE = new Date('2026-02-25');
TEST_DATE.setHours(0, 0, 0, 0);

function timeOn(date: Date, h: number, m: number): Date {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

async function run() {
  console.log('============================================================');
  console.log('  Attendance Policy Scenarios – Test');
  console.log('============================================================\n');

  // Find employee: prefer one with shift 09:00-18:00 or from rules
  let emp = await prisma.employee.findFirst({
    where: { shiftId: { not: null } },
    include: { shift: { select: { name: true, startTime: true, endTime: true, breakDuration: true } } },
  });
  if (!emp) {
    emp = await prisma.employee.findFirst({
      where: { firstName: { contains: 'manikandan', mode: 'insensitive' } },
      include: { shift: { select: { name: true, startTime: true, endTime: true, breakDuration: true } } },
    }) ?? null;
  }
  if (!emp) {
    console.log('No employee found. Create an employee (with or without shift).');
    process.exit(1);
  }

  const employeeId = emp.id;
  const dayEnd = new Date(TEST_DATE);
  dayEnd.setDate(dayEnd.getDate() + 1);

  async function clearPunches() {
    await prisma.attendancePunch.deleteMany({
      where: { employeeId, punchTime: { gte: TEST_DATE, lt: dayEnd } },
    });
  }

  async function addPunch(time: Date, status: 'IN' | 'OUT') {
    await prisma.attendancePunch.create({
      data: { employeeId, punchTime: time, status, punchSource: 'MANUAL' },
    });
  }

  async function getRecord() {
    return prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: TEST_DATE } },
    });
  }

  console.log('Employee:', emp.firstName, emp.lastName);
  console.log('Shift:', emp.shift?.name ?? '(none)', emp.shift ? `${emp.shift.startTime}–${emp.shift.endTime}` : '');
  console.log('Test date:', TEST_DATE.toISOString().slice(0, 10), '\n');

  const results: string[] = [];
  let failed = 0;

  // --- Scenario A: Late entry (10:00), full day (19:00). Expect Late ~60 min, OT = 0 (below min 4h) ---
  await clearPunches();
  await addPunch(timeOn(TEST_DATE, 10, 0), 'IN');
  await addPunch(timeOn(TEST_DATE, 19, 0), 'OUT');
  await attendanceService.syncAttendanceRecordFromPunches(employeeId, TEST_DATE);
  const recA = await getRecord();
  if (recA) {
    const lateOk = recA.isLate === true && (recA.lateMinutes ?? 0) >= 55 && (recA.lateMinutes ?? 0) <= 65;
    const otZero = (recA.otMinutes ?? 0) === 0;
    if (lateOk && otZero) {
      results.push(`A. Late entry 10:00, Out 19:00  => Late ${recA.lateMinutes} min, OT 0 (min 4h) [PASS]`);
    } else {
      results.push(`A. Late entry 10:00, Out 19:00  => Late ${recA.lateMinutes} min, OT ${recA.otMinutes} [FAIL: expected Late 55-65, OT 0]`);
      failed++;
    }
  } else {
    results.push('A. No record after sync [FAIL]');
    failed++;
  }

  // --- Scenario B: On time (09:00), early exit (17:00). Expect OT = 0; Early ~60 min if policy Consider Early = YES ---
  await clearPunches();
  await addPunch(timeOn(TEST_DATE, 9, 0), 'IN');
  await addPunch(timeOn(TEST_DATE, 17, 0), 'OUT');
  await attendanceService.syncAttendanceRecordFromPunches(employeeId, TEST_DATE);
  const recB = await getRecord();
  if (recB) {
    const otZero = (recB.otMinutes ?? 0) === 0;
    const earlyOk = recB.isEarly === true && (recB.earlyMinutes ?? 0) >= 55 && (recB.earlyMinutes ?? 0) <= 65;
    if (otZero && (earlyOk || recB.earlyMinutes == null)) {
      const earlyStr = recB.earlyMinutes != null ? `${recB.earlyMinutes} min` : 'null (policy Consider Early may be NO)';
      results.push(`B. In 09:00, Early exit 17:00 => Early ${earlyStr}, OT 0 [PASS]`);
    } else {
      results.push(`B. In 09:00, Early exit 17:00 => Early ${recB.earlyMinutes}, OT ${recB.otMinutes} [FAIL: expected OT 0]`);
      failed++;
    }
  } else {
    results.push('B. No record [FAIL]');
    failed++;
  }

  // --- Shortfall bug: With consider-as-shortfall all NO, deviation should not be "Shortfall" when shortfall=0 ---
  if (recB && recB.isDeviation === true && (recB.deviationReason ?? '').includes('Shortfall')) {
    results.push('Shortfall: Deviation reason contains "Shortfall" with 0 shortfall (consider-as-shortfall NO) [FAIL]');
    failed++;
  } else if (recB) {
    results.push('Shortfall: No false shortfall deviation when shortfall=0 [PASS]');
  }

  // --- Scenario D': Excess stay until 22:01. Expect OT = 4h (min threshold) ---
  await clearPunches();
  await addPunch(timeOn(TEST_DATE, 9, 0), 'IN');
  await addPunch(timeOn(TEST_DATE, 22, 1), 'OUT');
  await attendanceService.syncAttendanceRecordFromPunches(employeeId, TEST_DATE);
  const recD = await getRecord();
  if (recD) {
    const otMin = (recD.otMinutes ?? 0) / 60;
    const otOk = otMin >= 3.9 && otMin <= 4.2; // 4h
    if (otOk) {
      results.push(`D'. In 09:00, Out 22:01 => OT ${(recD.otMinutes ?? 0) / 60} h (min 4h) [PASS]`);
    } else {
      results.push(`D'. In 09:00, Out 22:01 => OT ${(recD.otMinutes ?? 0) / 60} h [FAIL: expected ~4h]`);
      failed++;
    }
  } else {
    results.push("D'. No record [FAIL]");
    failed++;
  }

  // --- Scenario E: Stay until 20:00 (OT < 4h). Expect OT = 0 ---
  await clearPunches();
  await addPunch(timeOn(TEST_DATE, 9, 0), 'IN');
  await addPunch(timeOn(TEST_DATE, 20, 0), 'OUT');
  await attendanceService.syncAttendanceRecordFromPunches(employeeId, TEST_DATE);
  const recE = await getRecord();
  if (recE) {
    const otZero = (recE.otMinutes ?? 0) === 0;
    if (otZero) {
      results.push(`E. In 09:00, Out 20:00 (OT < 4h) => OT 0 [PASS]`);
    } else {
      results.push(`E. In 09:00, Out 20:00 => OT ${recE.otMinutes} [FAIL: expected 0]`);
      failed++;
    }
  } else {
    results.push('E. No record [FAIL]');
    failed++;
  }

  // --- Scenario F: Excess break (01:00 PM–02:30 PM = 1.5h). Rule: Min Break as Deviation 01:00, Including Shift Break NO, Excess Break as Shortfall NO. Expect: deviation (Excess break), no shortfall, status Present (with deviation) ---
  await clearPunches();
  await addPunch(timeOn(TEST_DATE, 9, 0), 'IN');
  await addPunch(timeOn(TEST_DATE, 13, 0), 'OUT');   // 01:00 PM
  await addPunch(timeOn(TEST_DATE, 14, 30), 'IN');   // 02:30 PM
  await addPunch(timeOn(TEST_DATE, 18, 0), 'OUT');   // 06:00 PM
  await attendanceService.syncAttendanceRecordFromPunches(employeeId, TEST_DATE);
  const recF = await getRecord();
  if (recF) {
    const breakH = recF.breakHours != null ? parseFloat(recF.breakHours.toString()) : 0;
    const breakOk = breakH >= 1.48 && breakH <= 1.52; // 1.5h
    const devOk = recF.isDeviation === true && (recF.deviationReason ?? '').includes('Excess break');
    if (breakOk && devOk) {
      results.push(`F. Break 01:00–02:30 (1.5h) => break ${breakH.toFixed(2)}h, deviation (Excess break) [PASS]`);
    } else {
      results.push(`F. Break 01:00–02:30 => break ${breakH.toFixed(2)}h, isDeviation ${recF.isDeviation}, reason ${recF.deviationReason ?? 'null'} [FAIL: expected break ~1.5h, deviation with Excess break]`);
      failed++;
    }
  } else {
    results.push('F. No record [FAIL]');
    failed++;
  }

  // --- Scenario: No shortfall deviation when shortfall = 0 (all consider-as-shortfall NO) ---
  // B already has early 60 min; with considerEarlyGoingAsShortfall NO, shortfall = 0 -> isDeviation should not be from shortfall
  const recB2 = await getRecord();
  if (recB2 && recB2.isDeviation === true) {
    const fromShortfallOnly = (recB2.deviationReason ?? '').includes('Shortfall') && !(recB2.deviationReason ?? '').includes('Excess break');
    if (fromShortfallOnly) {
      results.push('Shortfall bug: Deviation=Yes with reason Shortfall but shortfall=0 [FAIL]');
      failed++;
    }
  }

  console.log('--- Results ---');
  results.forEach((r) => console.log(r));
  console.log('\n============================================================');
  if (failed === 0) {
    console.log('  All scenarios PASSED.');
  } else {
    console.log(`  ${failed} scenario(s) FAILED.`);
  }
  console.log('============================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
