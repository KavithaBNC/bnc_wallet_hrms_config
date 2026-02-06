/**
 * Delete the mistaken "10:27 PM" entries (punch was entered as 4:59 PM but stored as UTC and displayed as 10:27 PM IST).
 * Removes matching rows from attendance_punches and attendance_logs, then re-syncs attendance_record for that day.
 *
 * Run from backend folder:
 *   npx ts-node -r tsconfig-paths/register src/scripts/delete-wrong-1027-punches.ts
 * Optional: DATE=2026-02-05 EMPLOYEE_NAME=kavitha (default date 2026-02-05, optional employee name filter)
 */
import { prisma } from '../utils/prisma';
import { attendanceService } from '../services/attendance.service';

const DEFAULT_DATE = '2026-02-05';
// Punches stored as 16:00-17:30 UTC on that date display as ~10:00-10:30 PM IST (the wrong "4:59 PM as UTC" entries)
const UTC_HOUR_START = 16;
const UTC_HOUR_END = 17;
const UTC_MINUTE_END = 30;

async function main() {
  const dateStr = process.env.DATE || DEFAULT_DATE;
  const employeeName = process.env.EMPLOYEE_NAME?.toLowerCase(); // e.g. 'kavitha'

  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStart = new Date(Date.UTC(y, m - 1, d, UTC_HOUR_START, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(y, m - 1, d, UTC_HOUR_END, UTC_MINUTE_END, 59, 999));

  console.log(`Looking for punches on ${dateStr} with punch_time between ${dayStart.toISOString()} and ${dayEnd.toISOString()} (UTC)...`);

  let employees: { id: string; firstName: string; lastName: string }[] = [];
  if (employeeName) {
    employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: employeeName, mode: 'insensitive' } },
          { lastName: { contains: employeeName, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true },
    });
    console.log(`Filtering by employee name "${employeeName}": found ${employees.length} employee(s).`);
  }

  const punchWhere: { punchTime: { gte: Date; lte: Date }; employeeId?: { in: string[] } } = {
    punchTime: { gte: dayStart, lte: dayEnd },
  };
  if (employees.length > 0) {
    punchWhere.employeeId = { in: employees.map((e) => e.id) };
  }

  const punches = await prisma.attendancePunch.findMany({
    where: punchWhere,
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
  });

  if (punches.length === 0) {
    console.log('No matching punches found. Nothing to delete.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${punches.length} punch(es) to delete:`);
  punches.forEach((p) => {
    console.log(`  - ${p.employee.firstName} ${p.employee.lastName} ${p.punchTime.toISOString()} ${p.status} (${p.punchSource}) id=${p.id}`);
  });

  const punchIds = punches.map((p) => p.id);
  const employeeIds = [...new Set(punches.map((p) => p.employeeId))];

  // Delete from attendance_punches
  const deletedPunches = await prisma.attendancePunch.deleteMany({
    where: { id: { in: punchIds } },
  });
  console.log(`Deleted ${deletedPunches.count} row(s) from attendance_punches.`);

  // Delete matching attendance_logs (same employee + punch_timestamp in range)
  const deletedLogs = await prisma.attendanceLog.deleteMany({
    where: {
      employeeId: { in: employeeIds },
      punchTimestamp: { gte: dayStart, lte: dayEnd },
    },
  });
  console.log(`Deleted ${deletedLogs.count} row(s) from attendance_logs.`);

  // Re-sync attendance_record for affected employees for this calendar day (UTC date = dateStr)
  const dayForSync = new Date(dateStr + 'T00:00:00.000Z');
  for (const eid of employeeIds) {
    await attendanceService.syncAttendanceRecordFromPunches(eid, dayForSync);
    console.log(`Re-synced attendance_record for employee ${eid}.`);
  }

  console.log('Done.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
