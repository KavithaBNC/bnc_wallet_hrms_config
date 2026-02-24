import { prisma } from '../utils/prisma';
async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true, name: true } });
  const lts = await prisma.leaveType.findMany({
    where: { organizationId: org!.id },
    select: { name: true, code: true, defaultDaysPerYear: true, isActive: true },
  });
  console.log('Leave Types:');
  lts.forEach((lt) =>
    console.log(`  [${lt.code}] ${lt.name} | defaultDaysPerYear: ${lt.defaultDaysPerYear} | active: ${lt.isActive}`)
  );

  const components = await prisma.attendanceComponent.findMany({
    where: { organizationId: org!.id, eventCategory: 'Leave' },
    select: { shortName: true, eventName: true, hasBalance: true, allowAutoCreditRule: true, allowBalanceEntry: true },
  });
  console.log('\nAttendance Components (Leave):');
  components.forEach((c) =>
    console.log(`  [${c.shortName}] ${c.eventName} | hasBalance: ${c.hasBalance} | allowAutoCreditRule: ${c.allowAutoCreditRule} | allowBalanceEntry: ${c.allowBalanceEntry}`)
  );
}
main().catch(console.error).finally(() => prisma.$disconnect());
