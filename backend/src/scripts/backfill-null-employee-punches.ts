/**
 * Backfill attendance_logs where employee_id is null (punch received before org fix).
 * Resolves user_id (e.g. N001) to employee using device's company org, then creates attendance_punches.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/backfill-null-employee-punches.ts [YYYY-MM-DD]
 * Example: npx ts-node -r tsconfig-paths/register src/scripts/backfill-null-employee-punches.ts 2026-03-03
 */
import { prisma } from '../utils/prisma';
import { attendanceService } from '../services/attendance.service';

function isPunchIn(status: string): boolean {
  const s = (status || '').trim().toLowerCase();
  return s === '0' || s === 'in' || s === 'checkin' || s === 'punchin' || s === 'entry';
}
function isPunchOut(status: string): boolean {
  const s = (status || '').trim().toLowerCase();
  return s === '1' || s === 'out' || s === 'checkout' || s === 'punchout' || s === 'exit';
}

async function resolveEmployeeId(userId: string, deviceId: string | null): Promise<string | null> {
  if (!deviceId) return null;
  const device = await prisma.biometricDevice.findUnique({
    where: { id: deviceId },
    include: { company: true },
  });
  if (!device?.company?.organizationId) return null;
  const emp = await prisma.employee.findFirst({
    where: {
      organizationId: device.company.organizationId,
      employeeCode: userId.trim(),
      deletedAt: null,
    },
    select: { id: true },
  });
  return emp?.id ?? null;
}

async function main() {
  const dateStr = process.argv[2];
  let dayStart: Date;
  let dayEnd: Date;
  if (dateStr) {
    dayStart = new Date(dateStr + 'T00:00:00.000Z');
    dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  } else {
    dayStart = new Date('2020-01-01T00:00:00.000Z');
    dayEnd = new Date();
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  }

  const logs = await prisma.attendanceLog.findMany({
    where: {
      punchSource: 'BIOMETRIC',
      employeeId: null,
      punchTimestamp: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { punchTimestamp: 'asc' },
  });

  console.log(`Found ${logs.length} biometric log(s) with null employee_id.`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const employeeIdsToSync = new Set<string>();
  for (const log of logs) {
    const employeeId = await resolveEmployeeId(log.userId, log.deviceId);
    if (!employeeId) {
      console.log(`  Skip: userId=${log.userId} could not resolve to employee`);
      skipped++;
      continue;
    }

    await prisma.attendanceLog.update({
      where: { id: log.id },
      data: { employeeId },
    });
    updated++;
    employeeIdsToSync.add(employeeId);

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
    console.log(`  Created punch: ${log.userId} -> ${employeeId} ${status} at ${log.punchTimestamp.toISOString()}`);
  }

  for (const eid of employeeIdsToSync) {
    await attendanceService.syncAttendanceRecordFromPunches(eid, dayStart);
  }
  console.log(`Done. Updated ${updated} log(s), created ${created} punch(es), skipped ${skipped}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
