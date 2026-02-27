import { prisma } from '../utils/prisma';
import { attendanceService } from '../services/attendance.service';

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true, name: true } });
  if (!org) throw new Error('No organization found');

  const employee = await prisma.employee.findFirst({
    where: { organizationId: org.id },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      paygroupId: true,
      departmentId: true,
    },
  });
  if (!employee) throw new Error('No employee found');

  const leaveTypes = await prisma.leaveType.findMany({
    where: { organizationId: org.id, isActive: true },
    select: { id: true, name: true, code: true, defaultDaysPerYear: true },
    orderBy: { name: 'asc' },
  });
  console.log('LeaveTypes', leaveTypes);
  const el =
    leaveTypes.find((l) => (l.code || '').toUpperCase() === 'EL') ||
    leaveTypes.find((l) => (l.name || '').toLowerCase().includes('earned'));

  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  console.log('ORG', org);
  console.log('EMP', employee);
  console.log('EL leaveType', el);

  if (el) {
    const bal = await prisma.employeeLeaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: { employeeId: employee.id, leaveTypeId: el.id, year },
      },
    });
    console.log('EL employeeLeaveBalance', bal);

    const ac = await prisma.autoCreditSetting.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        eventType: true,
        displayName: true,
        effectiveDate: true,
        effectiveTo: true,
        priority: true,
        autoCreditRule: true,
      },
      orderBy: { priority: 'asc' },
    });
    const matches = ac.filter(
      (x) =>
        (x.displayName || '').trim().toUpperCase() === 'EL' ||
        (x.eventType || '').toLowerCase() === (el.name || '').toLowerCase()
    );
    console.log('AutoCredit matches for EL', matches);
  }
  const acAll = await prisma.autoCreditSetting.findMany({
    where: { organizationId: org.id },
    select: { id: true, eventType: true, displayName: true, autoCreditRule: true, priority: true },
    orderBy: { priority: 'asc' },
  });
  console.log('AutoCreditSettings', acAll);

  const monthly = await attendanceService.getMonthlyDetails(org.id, employee.id, year, month);
  console.log('MonthlyDetails.leave', monthly.leave);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

