/**
 * Check employee's Over Time, LOP, NFH, Week Off (from Summary + Calendar)
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/check-saravanan-attendance-summary.ts [empCode|name] [year] [month]
 * Examples:
 *   npm run check:saravanan              -> Saravanan, current month
 *   ... 2026 2                          -> Saravanan, Feb 2026
 *   ... 3025 2026 2                     -> Employee 3025 (Abirami), Feb 2026
 *   ... abirami 2026 2                  -> Abirami by name, Feb 2026
 */
import { prisma } from '../utils/prisma';
import { monthlyAttendanceSummaryService } from '../services/monthly-attendance-summary.service';

function formatOT(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function main() {
  const a1 = process.argv[2];
  const a2 = process.argv[3];
  const a3 = process.argv[4];
  const now = new Date();
  let empQuery: string | null = null;
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (a1) {
    const y = parseInt(a1, 10);
    const looksLikeYear = /^\d{4}$/.test(a1) && y >= 2000 && y <= 2030;
    if (looksLikeYear && !a2) {
      year = y;
      month = a2 ? parseInt(a2, 10) : month;
    } else if (looksLikeYear && a2) {
      year = y;
      month = parseInt(a2, 10);
    } else {
      empQuery = a1;
      if (a2 && /^\d{4}$/.test(a2)) {
        year = parseInt(a2, 10);
        month = a3 ? parseInt(a3, 10) : month;
      }
    }
  }

  const employee = empQuery
    ? await prisma.employee.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { employeeCode: { contains: empQuery, mode: 'insensitive' } },
            { firstName: { contains: empQuery, mode: 'insensitive' } },
            { lastName: { contains: empQuery, mode: 'insensitive' } },
          ],
        },
        select: { id: true, employeeCode: true, firstName: true, lastName: true, organizationId: true },
      })
    : await prisma.employee.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: 'Saravanan', mode: 'insensitive' } },
            { lastName: { contains: 'Saravanan', mode: 'insensitive' } },
          ],
        },
        select: { id: true, employeeCode: true, firstName: true, lastName: true, organizationId: true },
      });

  console.log('\n=== Over Time, LOP, NFH, Week Off Check ===\n');

  if (!employee) {
    console.log(`❌ Employee ${empQuery || 'Saravanan'} not found in database.`);
    await prisma.$disconnect();
    return;
  }

  const orgId = employee.organizationId!;
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);
  const monthName = periodStart.toLocaleString('en-US', { month: 'long' });

  console.log(`Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`);
  console.log(`Period: ${monthName} ${year}\n`);

  // --- 1. Monthly Attendance Summary ---
  let summary = await prisma.monthlyAttendanceSummary.findUnique({
    where: {
      organizationId_employeeId_year_month: {
        organizationId: orgId,
        employeeId: employee.id,
        year,
        month,
      },
    },
  });

  if (!summary) {
    console.log('📋 No MonthlyAttendanceSummary found. Building from calendar...\n');
    try {
      await monthlyAttendanceSummaryService.buildSummaryForEmployee({
        organizationId: orgId,
        employeeId: employee.id,
        year,
        month,
      });
      summary = await prisma.monthlyAttendanceSummary.findUnique({
        where: {
          organizationId_employeeId_year_month: {
            organizationId: orgId,
            employeeId: employee.id,
            year,
            month,
          },
        },
      });
    } catch (err: unknown) {
      console.log('Build error:', err instanceof Error ? err.message : err);
    }
  }

  console.log('--- Summary (Post to Payroll values) ---');
  if (summary) {
    const ot = Number(summary.overtimeHours);
    const lop = Number(summary.lopDays);
    const nfh = summary.holidayDays;
    const wo = summary.weekendDays;
    console.log(`  Over Time (OT):     ${formatOT(ot)} (${ot.toFixed(2)} hrs)`);
    console.log(`  LOP (Loss of Pay):  ${lop.toFixed(2)} days`);
    console.log(`  NFH (Holidays):     ${nfh}`);
    console.log(`  WO (Week Off):      ${wo}`);
    console.log(`  Present:            ${summary.presentDays}`);
    console.log(`  Absent:             ${summary.absentDays}`);
    console.log(`  Half Day:           ${summary.halfDays}`);
    console.log(`  Paid Days:          ${Number(summary.paidDays).toFixed(2)}`);
    console.log(`  Total Working Days: ${summary.totalWorkingDays}`);
  } else {
    console.log('  No summary available.');
  }

  // --- 2. Calendar (AttendanceRecord) breakdown ---
  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: employee.id,
      date: { gte: periodStart, lte: periodEnd },
    },
    orderBy: { date: 'asc' },
  });

  const byStatus: Record<string, number> = {};
  let totalOT = 0;
  const otByDate: Array<{ date: string; ot: number }> = [];

  for (const r of records) {
    const status = r.status || 'NULL';
    byStatus[status] = (byStatus[status] || 0) + 1;
    const ot = r.overtimeHours ? Number(r.overtimeHours) : 0;
    if (ot > 0) {
      totalOT += ot;
      otByDate.push({ date: r.date.toISOString().split('T')[0], ot });
    }
  }

  console.log('\n--- Calendar (AttendanceRecord) breakdown ---');
  console.log(`  Total records: ${records.length}`);
  Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    console.log(`    ${status}: ${count} days`);
  });
  console.log(`  OT from calendar (sum): ${formatOT(totalOT)} (${totalOT.toFixed(2)} hrs)`);

  if (otByDate.length > 0) {
    console.log('\n  Days with OT:');
    otByDate.forEach(({ date, ot }) => {
      console.log(`    ${date}: ${formatOT(ot)}`);
    });
  }

  // NFH = HOLIDAY count, WO = WEEKEND count
  const nfhFromCal = byStatus['HOLIDAY'] || 0;
  const woFromCal = byStatus['WEEKEND'] || 0;
  console.log(`  NFH (HOLIDAY count): ${nfhFromCal}`);
  console.log(`  WO (WEEKEND count):  ${woFromCal}`);

  // --- 3. LOP breakdown (absent vs unpaid leave) ---
  const absentRecords = records.filter((r) => r.status === 'ABSENT');
  const lrUnpaid = await prisma.leaveRequest.findMany({
    where: {
      employeeId: employee.id,
      status: 'APPROVED',
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
      leaveType: { isPaid: false },
    },
    include: { leaveType: { select: { name: true, isPaid: true } } },
  });
  console.log('\n--- LOP Breakdown (formula: absentDays + unpaidLeaveDays + halfDays*0.5) ---');
  if (absentRecords.length > 0) {
    console.log(`  ABSENT days (${absentRecords.length}): ${absentRecords.map((r) => r.date.toISOString().split('T')[0]).join(', ')}`);
  }
  if (lrUnpaid.length > 0) {
    for (const lr of lrUnpaid) {
      console.log(`  Unpaid leave (${lr.leaveType.name}): ${lr.startDate.toISOString().split('T')[0]} to ${lr.endDate.toISOString().split('T')[0]}, ~${lr.totalDays} days`);
    }
  }
  if (summary && absentRecords.length === 0 && lrUnpaid.length === 0) {
    console.log('  (No absent records or unpaid leave in calendar for this month)');
  }

  await prisma.$disconnect();
  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
