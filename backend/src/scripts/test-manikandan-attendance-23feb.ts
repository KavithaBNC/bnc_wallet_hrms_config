/**
 * Test script: show attendance result for Manikandan for 23rd Feb.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/test-manikandan-attendance-23feb.ts
 */

import { prisma } from '../utils/prisma';

const TARGET_DATE = new Date('2026-02-23');
const TARGET_DATE_STR = '2026-02-23';

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

async function main() {
  console.log('========================================');
  console.log('  Manikandan – Attendance 23rd Feb');
  console.log('========================================\n');

  const dayStart = new Date(TARGET_DATE);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'manikandan', mode: 'insensitive' } },
        { lastName: { contains: 'manikandan', mode: 'insensitive' } },
      ],
    },
    include: {
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
  });

  if (!employee) {
    console.log('No employee found with name containing "manikandan".');
    const sample = await prisma.employee.findMany({ take: 5, select: { firstName: true, lastName: true, employeeCode: true } });
    console.log('Sample employees:', sample.map((e) => `${e.firstName} ${e.lastName} (${e.employeeCode})`).join(', '));
    process.exit(1);
  }

  console.log('Employee:');
  console.log('  Name:', employee.firstName, employee.lastName);
  console.log('  Code:', employee.employeeCode);
  console.log('  Shift:', employee.shift?.name ?? '(none)');
  if (employee.shift) {
    console.log('  Shift times:', employee.shift.startTime, '–', employee.shift.endTime);
  }
  console.log('');

  const record = await prisma.attendanceRecord.findUnique({
    where: {
      employeeId_date: { employeeId: employee.id, date: dayStart },
    },
    include: {
      shift: { select: { name: true, startTime: true, endTime: true } },
    },
  });

  const punches = await prisma.attendancePunch.findMany({
    where: {
      employeeId: employee.id,
      punchTime: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { punchTime: 'asc' },
  });

  console.log('Date:', TARGET_DATE_STR);
  console.log('----------------------------------------');

  if (!record && punches.length === 0) {
    console.log('No attendance record and no punches for 23rd Feb.');
    process.exit(0);
  }

  if (record) {
    console.log('Attendance record:');
    console.log('  Status:', record.status ?? '—');
    console.log('  First In:', record.checkIn ? formatTime(record.checkIn) : '—');
    console.log('  Last Out:', record.checkOut ? formatTime(record.checkOut) : '—');
    console.log('  Work hours:', record.workHours != null ? String(record.workHours) : '—');
    console.log('  Late:', record.isLate ? `Yes (${record.lateMinutes ?? 0} min)` : 'No');
    console.log('  Early going:', record.isEarly ? `Yes (${record.earlyMinutes ?? 0} min)` : 'No');
    if (record.deviationReason) console.log('  Deviation:', record.deviationReason);
    if (record.shift) console.log('  Shift on record:', record.shift.name, record.shift.startTime, '–', record.shift.endTime);
  } else {
    console.log('Attendance record: (none for this day)');
  }

  if (punches.length > 0) {
    console.log('\nPunches:');
    punches.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.status} at ${formatTime(p.punchTime)} (${p.punchSource ?? '—'})`);
    });
  }

  console.log('\n========================================');
  console.log('  Summary for 23rd Feb');
  console.log('========================================');
  if (record) {
    const firstIn = record.checkIn ? formatTime(record.checkIn) : (punches.find((p) => p.status === 'IN')?.punchTime ? formatTime(punches.find((p) => p.status === 'IN')!.punchTime) : '—');
    const lastOut = record.checkOut ? formatTime(record.checkOut) : (punches.filter((p) => p.status === 'OUT').pop()?.punchTime ? formatTime(punches.filter((p) => p.status === 'OUT').pop()!.punchTime) : '—');
    console.log('  First In:  ', firstIn);
    console.log('  Last Out:   ', lastOut);
    console.log('  Late:       ', record.isLate ? `${record.lateMinutes} min` : 'No');
    console.log('  Early going:', record.isEarly ? `${record.earlyMinutes} min` : 'No');
  } else {
    console.log('  No record; punches only:', punches.length);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
