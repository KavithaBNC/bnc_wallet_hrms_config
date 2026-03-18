import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { attendanceService } from '../services/attendance.service';

/**
 * Seeds minimal EL setup (LeaveType + AttendanceComponent + AutoCreditSetting),
 * calls getMonthlyDetails, prints Leave table, and then cleans up.
 *
 * This is ONLY for local verification.
 */
async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true, name: true } });
  if (!org) throw new Error('No organization found');

  const employee = await prisma.employee.findFirst({
    where: { organizationId: org.id },
    select: { id: true, employeeCode: true, departmentId: true, paygroupId: true },
  });
  if (!employee) throw new Error('No employee found');

  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  const created: { leaveTypeId?: string; componentId?: string; autoCreditId?: string } = {};

  // LeaveType
  const leaveType =
    (await prisma.leaveType.findFirst({
      where: { organizationId: org.id, code: 'EL' },
      select: { id: true, name: true, code: true },
    })) ??
    (await prisma.leaveType.create({
      data: {
        organizationId: org.id,
        name: 'Earned Leave',
        code: 'EL',
        isPaid: true,
        isActive: true,
      },
      select: { id: true, name: true, code: true },
    }));
  if (leaveType.code === 'EL' && leaveType.name === 'Earned Leave') created.leaveTypeId = leaveType.id;

  // AttendanceComponent (Leave)
  const comp =
    (await prisma.attendanceComponent.findFirst({
      where: { organizationId: org.id, eventCategory: 'Leave', shortName: 'EL' },
      select: { id: true },
    })) ??
    (await prisma.attendanceComponent.create({
      data: {
        organizationId: org.id,
        shortName: 'EL',
        eventName: 'Earned Leave',
        eventCategory: 'Leave',
        authorized: true,
        hasBalance: true,
        allowAutoCreditRule: true,
        priority: 1,
      },
      select: { id: true },
    }));
  created.componentId = created.componentId ?? comp.id;

  // AutoCreditSetting with entitlementDays = 20
  const autoCredit =
    (await prisma.autoCreditSetting.findFirst({
      where: { organizationId: org.id, displayName: 'EL' },
      select: { id: true },
    })) ??
    (await prisma.autoCreditSetting.create({
      data: {
        organizationId: org.id,
        eventType: 'Earned Leave',
        displayName: 'EL',
        associate: null,
        paygroupId: null,
        departmentId: null,
        condition: null,
        effectiveDate: new Date(year, 0, 1),
        priority: 0,
        remarks: 'seed test',
        autoCreditRule: {
          periodicity: 'Annually',
          effectiveFrom: 'Calendar Year Start',
          entitlementDays: 20,
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    }));
  created.autoCreditId = created.autoCreditId ?? autoCredit.id;

  const monthly = await attendanceService.getMonthlyDetails(org.id, employee.id, year, month);
  console.log('Leave table rows:', monthly.leave);

  // Cleanup only what we created in this script run.
  // NOTE: we only remove if we created them freshly (best-effort).
  if (created.autoCreditId) {
    await prisma.autoCreditSetting.deleteMany({ where: { id: created.autoCreditId, remarks: 'seed test' } });
  }
  if (created.componentId) {
    await prisma.attendanceComponent.deleteMany({ where: { id: created.componentId, shortName: 'EL', eventCategory: 'Leave' } });
  }
  if (created.leaveTypeId) {
    await prisma.leaveType.deleteMany({ where: { id: created.leaveTypeId, code: 'EL', name: 'Earned Leave' } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

