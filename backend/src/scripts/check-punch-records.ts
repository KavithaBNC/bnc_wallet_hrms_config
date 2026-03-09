/**
 * Check DB for device punch: N001, 2026-03-09 10:41:23, device SN CQZ7224460246
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/check-punch-records.ts
 */
import { prisma } from '../utils/prisma';

const USER_ID = 'N001';
// 10:41:23 could be stored as IST or UTC; use full day window
const PUNCH_DAY_START = new Date('2026-03-09T00:00:00.000Z');
const PUNCH_DAY_END = new Date('2026-03-10T00:00:00.000Z');
const DEVICE_SN = 'CQZ7224460246';

async function main() {
  console.log('--- 1. devices (by serial CQZ7224460246) ---');
  const device = await prisma.biometricDevice.findFirst({
    where: { serialNumber: DEVICE_SN },
    include: { company: { select: { name: true } } },
  });
  if (device) {
    console.log(`  Found: id=${device.id}, name=${device.name}, company=${device.company?.name ?? '-'}`);
  } else {
    console.log('  No device found with this serial.');
  }

  console.log('\n--- 2. attendance_logs (user_id=N001, punch ~10:41 on 2026-03-09) ---');
  const logs = await prisma.attendanceLog.findMany({
    where: {
      userId: USER_ID,
      punchTimestamp: { gte: PUNCH_DAY_START, lt: PUNCH_DAY_END },
    },
    orderBy: { punchTimestamp: 'desc' },
    include: { device: { select: { serialNumber: true } } },
  });
  if (logs.length === 0) {
    const anyLogs = await prisma.attendanceLog.findMany({
      where: { userId: USER_ID },
      orderBy: { punchTimestamp: 'desc' },
      take: 5,
      include: { device: { select: { serialNumber: true } } },
    });
    console.log('  No logs for N001 on 2026-03-09.');
    if (anyLogs.length > 0) {
      console.log('  Recent logs for N001:');
      anyLogs.forEach((r) => console.log(`    ${r.punchTimestamp.toISOString()} status=${r.status} device=${r.device?.serialNumber ?? '-'}`));
    }
  } else {
    logs.forEach((r) => {
      console.log(`  id=${r.id} punch_timestamp=${r.punchTimestamp.toISOString()} status=${r.status} employee_id=${r.employeeId ?? 'null'} device=${r.device?.serialNumber ?? '-'}`);
    });
  }

  console.log('\n--- 3. Employee with employeeCode=N001 ---');
  const emp = await prisma.employee.findFirst({
    where: { employeeCode: USER_ID, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });
  if (!emp) {
    console.log('  No employee found with employeeCode N001 (so no attendance_punches/attendance_records for this user).');
  } else {
    console.log(`  Found: id=${emp.id}, ${emp.firstName} ${emp.lastName}, code=${emp.employeeCode}`);

    console.log('\n--- 4. attendance_punches (this employee on 2026-03-09) ---');
    const dayStart = PUNCH_DAY_START;
    const dayEnd = PUNCH_DAY_END;
    const punches = await prisma.attendancePunch.findMany({
      where: { employeeId: emp.id, punchTime: { gte: dayStart, lt: dayEnd } },
      orderBy: { punchTime: 'asc' },
    });
    if (punches.length === 0) {
      console.log('  No punches for this employee on 2026-03-09.');
    } else {
      punches.forEach((p) => console.log(`  id=${p.id} punch_time=${p.punchTime.toISOString()} status=${p.status} source=${p.punchSource ?? '-'}`));
    }

    console.log('\n--- 5. attendance_records (this employee on 2026-03-09) ---');
    const rec = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date: dayStart } },
    });
    if (!rec) {
      console.log('  No attendance_record for 2026-03-09.');
    } else {
      console.log(`  id=${rec.id} check_in=${rec.checkIn?.toISOString() ?? '-'} check_out=${rec.checkOut?.toISOString() ?? '-'} work_hours=${rec.workHours} status=${rec.status}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
