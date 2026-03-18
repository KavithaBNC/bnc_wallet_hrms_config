/**
 * Test OT (overtime) calculation: excess stay after shift end should show OT on calendar.
 * Creates punches for a test date (In 09:00, Out 19:00 = 1h OT if shift end 18:00), syncs, asserts otMinutes.
 *
 * Usage (from backend folder):
 *   npx ts-node -r tsconfig-paths/register src/scripts/test-ot-calculation.ts
 *
 * Prerequisites:
 *   - Policy "Can Excess Stay be considered as Over Time" = YES
 *   - Shift end time (e.g. 18:00) and "OT Calculation starts after the end of Shift Time" (e.g. 00:01)
 */

import { prisma } from '../utils/prisma';
import { attendanceService } from '../services/attendance.service';

const TEST_DATE = new Date('2026-02-26');
TEST_DATE.setHours(0, 0, 0, 0);

function timeOn(date: Date, h: number, m: number): Date {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

async function run() {
  console.log('============================================================');
  console.log('  OT Calculation – Test');
  console.log('  Date:', TEST_DATE.toISOString().slice(0, 10));
  console.log('============================================================\n');

  const emp = await prisma.employee.findFirst({
    where: { shiftId: { not: null } },
    include: { shift: { select: { name: true, startTime: true, endTime: true } } },
  });
  if (!emp) {
    console.log('No employee with shift found. Assign a shift to an employee and run again.');
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

  const shiftEnd = emp.shift?.endTime ?? '18:00';
  const [endH, endM] = shiftEnd.split(':').map(Number);
  const shiftEndDesc = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  console.log('Employee:', emp.firstName, emp.lastName);
  console.log('Shift:', emp.shift?.name ?? '(none)', emp.shift ? `${emp.shift.startTime}–${emp.shift.endTime}` : '');
  console.log('');

  // Scenario: In 09:00, Out 19:00 => 1h OT (if shift end 18:00)
  await clearPunches();
  await addPunch(timeOn(TEST_DATE, 9, 0), 'IN');
  await addPunch(timeOn(TEST_DATE, 19, 0), 'OUT');
  await attendanceService.syncAttendanceRecordFromPunches(employeeId, TEST_DATE);

  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId, date: TEST_DATE } },
  });

  if (!record) {
    console.log('FAIL: No attendance record after sync.');
    process.exit(1);
  }

  const otMin = record.otMinutes ?? 0;
  const expectedMin = 55; // allow 55–65 for 1h (policy may have 00:01 grace)
  const expectedMax = 65;

  if (otMin >= expectedMin && otMin <= expectedMax) {
    console.log(`PASS: OT = ${otMin} min (expected ~60 min for Out 19:00 vs shift end ${shiftEndDesc}).`);
  } else {
    console.log(`FAIL: OT = ${otMin} min (expected ${expectedMin}–${expectedMax}).`);
    console.log('  Check: Policy "Can Excess Stay be considered as Over Time" = YES and shift end time.');
    process.exit(1);
  }

  console.log('\n============================================================');
  console.log('  OT test passed. Calendar should show OT for this day.');
  console.log('============================================================\n');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
