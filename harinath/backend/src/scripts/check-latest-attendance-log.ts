/**
 * Print latest attendance_logs rows (for verifying punch storage).
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/check-latest-attendance-log.ts
 */
import { prisma } from '../utils/prisma';

async function main() {
  const rows = await prisma.attendanceLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { device: { select: { serialNumber: true } } },
  });
  console.log('Latest attendance_logs (up to 5):');
  if (rows.length === 0) {
    console.log('  (none)');
  } else {
    rows.forEach((r, i) => {
      console.log(`  ${i + 1}. user_id=${r.userId} punch=${r.punchTimestamp.toISOString()} status=${r.status} device=${r.device?.serialNumber ?? '-'}`);
    });
  }
  await prisma.$disconnect();
}

main();
