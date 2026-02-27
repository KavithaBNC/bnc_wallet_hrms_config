/**
 * Test LOP calculation in MonthlyAttendanceSummary
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/test-lop-calculation.ts
 */
import { prisma } from '../utils/prisma';
import { monthlyAttendanceSummaryService } from '../services/monthly-attendance-summary.service';

async function main() {
  console.log('=== LOP Calculation Test ===\n');

  const orgs = await prisma.organization.findMany({ take: 1 });
  const org = orgs[0];
  if (!org) {
    console.log('No organization found. Skipping.');
    return;
  }
  let orgId = org.id;

  let employees = await prisma.employee.findMany({
    where: { organizationId: orgId, deletedAt: null },
    take: 5,
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  });
  if (employees.length === 0) {
    employees = await prisma.employee.findMany({
      where: { deletedAt: null },
      take: 5,
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });
    if (employees.length > 0) {
      const empWithOrg = await prisma.employee.findUnique({
        where: { id: employees[0].id },
        select: { organizationId: true },
      });
      if (empWithOrg?.organizationId) orgId = empWithOrg.organizationId;
    }
  }
  const filterName = process.argv[2]; // npm run test:lop saranya
  if (filterName) {
    const name = filterName.toLowerCase();
    const filtered = employees.filter(
      (e) =>
        e.firstName?.toLowerCase().includes(name) ||
        e.lastName?.toLowerCase().includes(name)
    );
    if (filtered.length > 0) employees = filtered;
    else {
      const byName = await prisma.employee.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: filterName, mode: 'insensitive' } },
            { lastName: { contains: filterName, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, employeeCode: true, firstName: true, lastName: true },
      });
      if (byName.length > 0) {
        employees = byName;
        const empWithOrg = await prisma.employee.findUnique({
          where: { id: employees[0].id },
          select: { organizationId: true },
        });
        if (empWithOrg?.organizationId) orgId = empWithOrg.organizationId;
      }
    }
  }
  if (employees.length === 0) {
    console.log('No employees found in DB.');
    return;
  }

  const year = 2026;
  const month = 2;

  const lock = await prisma.monthlyAttendanceLock.findUnique({
    where: { organizationId_year_month: { organizationId: orgId, year, month } },
  });
  if (lock) {
    console.log(`February ${year} is LOCKED. Unlock first to test build.`);
  }

  console.log(`Org: ${org.name}, Year: ${year}, Month: ${month}\n`);
  console.log('Employees:', employees.map((e) => `${e.employeeCode} (${e.firstName} ${e.lastName})`).join(', '));

  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: { organizationId: orgId, year, month },
    include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
  });

  console.log('\n--- Current MonthlyAttendanceSummary (LOP values) ---');
  if (summaries.length === 0) {
    console.log('No summaries. Run Build from Attendance Lock page first.');
  } else {
    for (const s of summaries) {
      const emp = s.employee;
      console.log(
        `  ${emp.employeeCode} ${emp.firstName}: absentDays=${s.absentDays}, halfDays=${s.halfDays}, lopDays=${s.lopDays}`
      );
    }
  }

  const arCount = await prisma.attendanceRecord.groupBy({
    by: ['status'],
    where: {
      employeeId: employees[0].id,
      date: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0),
      },
    },
    _count: { id: true },
  });
  console.log('\n--- AttendanceRecord counts for first employee ---');
  arCount.forEach((r) => console.log(`  ${r.status}: ${r._count.id}`));

  const lrUnpaid = await prisma.leaveRequest.findMany({
    where: {
      employeeId: employees[0].id,
      status: 'APPROVED',
      startDate: { lte: new Date(year, month, 0) },
      endDate: { gte: new Date(year, month - 1, 1) },
      leaveType: { isPaid: false },
    },
    include: { leaveType: { select: { name: true, isPaid: true } } },
  });
  console.log('\n--- Unpaid (LOP) LeaveRequests for first employee ---');
  if (lrUnpaid.length === 0) {
    console.log('  None');
  } else {
    lrUnpaid.forEach((lr) => {
      console.log(`  ${lr.leaveType.name}: ${lr.startDate.toISOString().split('T')[0]} - ${lr.endDate.toISOString().split('T')[0]}, totalDays=${lr.totalDays}`);
    });
  }

  console.log('\n--- LOP formula: absentDays + unpaidLeaveDays + halfDays*0.5 ---');
  if (summaries.length > 0) {
    const s = summaries[0];
    console.log(`  absentDays=${s.absentDays}, halfDays=${s.halfDays} (adds ${s.halfDays * 0.5}), lopDays=${s.lopDays}`);
  }

  if (!lock) {
    console.log('\n--- Running build for first employee (to test formula) ---');
    try {
      const result = await monthlyAttendanceSummaryService.buildSummaryForEmployee({
        organizationId: orgId,
        employeeId: employees[0].id,
        year,
        month,
      });
      if (result) {
        console.log(`  Built: lopDays=${result.lopDays}, absentDays=${result.absentDays}, halfDays=${result.halfDays}`);
      }
    } catch (err: unknown) {
      console.log('  Build error:', err instanceof Error ? err.message : err);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
