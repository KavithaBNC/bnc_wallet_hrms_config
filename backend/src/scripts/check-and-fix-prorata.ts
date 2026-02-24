/**
 * Script to check current AutoCreditSetting and fix autoCreditRule
 * to use prorataOnDateBasis with effectiveFrom: dateOfJoining
 *
 * Run: npx ts-node src/scripts/check-and-fix-prorata.ts
 */
import { prisma } from '../utils/prisma';

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true, name: true } });
  if (!org) throw new Error('No organization found');

  console.log('Organization:', org.name, org.id);
  console.log('');

  // Show current AutoCreditSettings
  const settings = await prisma.autoCreditSetting.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      eventType: true,
      displayName: true,
      autoCreditRule: true,
      effectiveDate: true,
      priority: true,
    },
  });

  console.log('=== Current AutoCreditSettings ===');
  settings.forEach((s) => {
    console.log(`\nID: ${s.id}`);
    console.log(`  EventType: ${s.eventType} | DisplayName: ${s.displayName}`);
    console.log(`  EffectiveDate: ${s.effectiveDate}`);
    console.log(`  autoCreditRule: ${JSON.stringify(s.autoCreditRule, null, 4)}`);
  });

  console.log('\n=== Fixing autoCreditRule to prorataOnDateBasis ===');

  // Fix each AutoCreditSetting to use prorataOnDateBasis
  for (const s of settings) {
    const rule = s.autoCreditRule as Record<string, unknown> | null;
    const entitlementDays = (rule?.entitlementDays as number) ?? (rule?.EntitlementDays as number) ?? 0;

    const leaveCode = (s.displayName || '').toUpperCase().trim();
    let annualDays = entitlementDays;

    // EL = 20 days, SL = 10 days (standard)
    if (annualDays === 0) {
      if (leaveCode === 'EL') annualDays = 20;
      else if (leaveCode === 'SL') annualDays = 10;
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

    console.log(`Updated [${s.displayName}] → entitlementDays: ${annualDays}, prorataOnDateBasis`);
  }

  // Test with Abirami (DOJ: 16-Feb-2026)
  console.log('\n=== Prorata Test ===');
  const { readEntitlementDaysForEmployeeYear } = await import('../utils/auto-credit-entitlement');

  const testCases = [
    { name: 'Abirami', doj: new Date('2026-02-16'), year: 2026, entitlement: 20 },
    { name: 'Priyadarshini', doj: new Date('2025-02-03'), year: 2025, entitlement: 20 },
    { name: 'Priyadarshini', doj: new Date('2025-02-03'), year: 2026, entitlement: 20 },
  ];

  for (const tc of testCases) {
    const rule = {
      entitlementDays: tc.entitlement,
      daysCalculation: 'prorataOnDateBasis',
      effectiveFrom: 'dateOfJoining',
      roundOff: true,
      roundOffNature: 'up',
    };
    const result = readEntitlementDaysForEmployeeYear(rule, tc.doj, tc.year);
    console.log(`${tc.name} (DOJ: ${tc.doj.toISOString().split('T')[0]}, Year: ${tc.year}) → EL Credit: ${result} days`);
  }

  // SL test (10 days, no carry forward)
  console.log('\n--- SL (10 days/year) ---');
  const slTestCases = [
    { name: 'Abirami', doj: new Date('2026-02-16'), year: 2026, entitlement: 10 },
    { name: 'Priyadarshini', doj: new Date('2025-02-03'), year: 2025, entitlement: 10 },
    { name: 'Priyadarshini', doj: new Date('2025-02-03'), year: 2026, entitlement: 10 },
  ];

  for (const tc of slTestCases) {
    const rule = {
      entitlementDays: tc.entitlement,
      daysCalculation: 'prorataOnDateBasis',
      effectiveFrom: 'dateOfJoining',
      roundOff: true,
      roundOffNature: 'up',
    };
    const result = readEntitlementDaysForEmployeeYear(rule, tc.doj, tc.year);
    console.log(`${tc.name} (DOJ: ${tc.doj.toISOString().split('T')[0]}, Year: ${tc.year}) → SL Credit: ${result} days`);
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
