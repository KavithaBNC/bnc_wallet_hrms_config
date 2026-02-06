/**
 * One-time backfill: copy biometric device punches from attendance_logs into attendance_punches
 * so they show in the calendar. Use when device punches were received before the calendar
 * started reading from attendance_punches (e.g. 6:01 PM card punch not showing).
 *
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/backfill-punches-from-device-logs.ts [YYYY-MM-DD]
 * Example: npx ts-node -r tsconfig-paths/register src/scripts/backfill-punches-from-device-logs.ts 2026-02-05
 */

import { PrismaClient } from '@prisma/client';
import { attendanceService } from '../services/attendance.service';

const prisma = new PrismaClient();

function isPunchIn(status: string): boolean {
  const s = (status || '').trim().toLowerCase();
  return s === '0' || s === 'in' || s === 'checkin' || s === 'punchin' || s === 'entry';
}
function isPunchOut(status: string): boolean {
  const s = (status || '').trim().toLowerCase();
  return s === '1' || s === 'out' || s === 'checkout' || s === 'punchout' || s === 'exit';
}

async function main() {
  const dateStr = process.argv[2] || new Date().toISOString().slice(0, 10);
  const dayStart = new Date(dateStr + 'T00:00:00.000Z');
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const logs = await prisma.attendanceLog.findMany({
    where: {
      punchSource: 'BIOMETRIC',
      employeeId: { not: null },
      punchTimestamp: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { punchTimestamp: 'asc' },
  });

  console.log(`Found ${logs.length} biometric device log(s) for ${dateStr}.`);

  let created = 0;
  let skipped = 0;
  for (const log of logs) {
    const employeeId = log.employeeId!;
    const status = isPunchIn(log.status) ? 'IN' : isPunchOut(log.status) ? 'OUT' : 'IN';

    const existing = await prisma.attendancePunch.findFirst({
      where: {
        employeeId,
        punchTime: {
          gte: new Date(log.punchTimestamp.getTime() - 60 * 1000),
          lte: new Date(log.punchTimestamp.getTime() + 60 * 1000),
        },
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.attendancePunch.create({
      data: {
        employeeId,
        punchTime: log.punchTimestamp,
        status,
        punchSource: 'CARD',
      },
    });
    created++;
    console.log(`  Created punch: employee ${employeeId} ${status} at ${log.punchTimestamp.toISOString()}`);
  }

  const employeeIds = [...new Set(logs.map((l) => l.employeeId).filter(Boolean))] as string[];
  for (const eid of employeeIds) {
    await attendanceService.syncAttendanceRecordFromPunches(eid, dayStart);
  }
  console.log(`Synced attendance_record for ${employeeIds.length} employee(s). Created ${created} punch(es), skipped ${skipped} (already present).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
