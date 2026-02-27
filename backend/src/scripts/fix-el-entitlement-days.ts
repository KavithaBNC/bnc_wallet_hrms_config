/**
 * Fix EL entitlementDays to 20 and SL to 10 with prorataOnDateBasis
 * Run: npx ts-node src/scripts/fix-el-entitlement-days.ts
 */
import { prisma } from '../utils/prisma';

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true, name: true } });
  if (!org) throw new Error('No organization found');
  console.log('Org:', org.name);

  const settings = await prisma.autoCreditSetting.findMany({
    where: { organizationId: org.id },
    select: { id: true, eventType: true, displayName: true, autoCreditRule: true },
  });

  for (const s of settings) {
    const code = (s.displayName || '').toUpperCase().trim();
    let annualDays = 0;

    if (code === 'EL' || (s.eventType || '').toLowerCase().includes('earned')) {
      annualDays = 20;
    } else if (code === 'SL' || (s.eventType || '').toLowerCase().includes('sick')) {
      annualDays = 10;
    } else if (code === 'CL' || (s.eventType || '').toLowerCase().includes('casual')) {
      annualDays = 12;
    } else {
      // Keep existing entitlementDays if known type not matched
      const existing = s.autoCreditRule as Record<string, unknown> | null;
      annualDays = Number(existing?.entitlementDays ?? 0);
    }

    const newRule = {
      entitlementDays: annualDays,
      daysCalculation: 'prorataOnDateBasis',
      effectiveFrom: 'dateOfJoining',
      roundOff: true,
      roundOffNature: 'up',
    };

    await prisma.autoCreditSetting.update({
      where: { id: s.id },
      data: { autoCreditRule: newRule },
    });

    console.log(`✅ Updated [${code}] → entitlementDays: ${annualDays} days, prorataOnDateBasis`);
  }

  // Verify final state
  console.log('\n=== Final AutoCreditSettings ===');
  const final = await prisma.autoCreditSetting.findMany({
    where: { organizationId: org.id },
    select: { eventType: true, displayName: true, autoCreditRule: true },
  });
  final.forEach((s) => {
    console.log(`[${s.displayName}] ${JSON.stringify(s.autoCreditRule)}`);
  });

  // Test prorata calculation
  console.log('\n=== Prorata Verification ===');
  const { readEntitlementDaysForEmployeeYear } = await import('../utils/auto-credit-entitlement');

  const employees = [
    { name: 'Priyadarshini', doj: new Date('2025-02-03') },
    { name: 'Abirami',       doj: new Date('2026-02-16') },
  ];

  const leaveTypes = [
    { code: 'EL', days: 20 },
    { code: 'SL', days: 10 },
  ];

  for (const emp of employees) {
    console.log(`\n${emp.name} (DOJ: ${emp.doj.toISOString().split('T')[0]})`);
    for (const lt of leaveTypes) {
      for (const year of [2025, 2026]) {
        const rule = {
          entitlementDays: lt.days,
          daysCalculation: 'prorataOnDateBasis',
          effectiveFrom: 'dateOfJoining',
          roundOff: true,
          roundOffNature: 'up',
        };
        const credit = readEntitlementDaysForEmployeeYear(rule, emp.doj, year);
        console.log(`  ${lt.code} ${year} → ${credit} days`);
      }
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
