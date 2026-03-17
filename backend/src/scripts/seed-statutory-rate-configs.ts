/**
 * Seed Statutory Rate Configs for FY 2025-26
 *
 * Creates 13 config rows: PF, ESI, 7× PT (per state), TDS_NEW, TDS_OLD,
 * STANDARD_DEDUCTION, REBATE_87A.
 *
 * Run: npx ts-node src/scripts/seed-statutory-rate-configs.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FY = '2025-26';
const EFFECTIVE_FROM = new Date('2025-04-01');

async function main() {
  console.log(`Seeding statutory rate configs for FY ${FY}...`);

  const configs = [
    // ── PF ──
    {
      configType: 'PF' as const,
      country: 'IN',
      region: null,
      financialYear: FY,
      name: 'PF Contribution Rates FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        wageCeiling: 15000,
        employeeRate: 12,
        employerEpsRate: 8.33,
        employerEpfRate: 3.67,
        edliRate: 0.5,
        adminChargeRate: 0.5,
      },
    },

    // ── ESI ──
    {
      configType: 'ESI' as const,
      country: 'IN',
      region: null,
      financialYear: FY,
      name: 'ESI Contribution Rates FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        grossThreshold: 21000,
        employeeRate: 0.75,
        employerRate: 3.25,
      },
    },

    // ── PT — Tamil Nadu ──
    {
      configType: 'PT' as const,
      country: 'IN',
      region: 'TAMIL_NADU',
      financialYear: FY,
      name: 'Professional Tax - Tamil Nadu FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        slabs: [
          { maxSalary: 21000, tax: 0 },
          { maxSalary: 30000, tax: 100 },
          { maxSalary: 45000, tax: 135 },
          { maxSalary: 60000, tax: 315 },
          { maxSalary: 75000, tax: 690 },
          { maxSalary: null, tax: 1025 },
        ],
        defaultTax: 200,
      },
    },

    // ── PT — Maharashtra ──
    {
      configType: 'PT' as const,
      country: 'IN',
      region: 'MAHARASHTRA',
      financialYear: FY,
      name: 'Professional Tax - Maharashtra FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        slabs: [
          { maxSalary: 7500, tax: 0 },
          { maxSalary: 10000, tax: 175 },
          { maxSalary: null, tax: 200 },
        ],
        defaultTax: 200,
        specialMonths: { '2': 300 },
      },
    },

    // ── PT — Karnataka ──
    {
      configType: 'PT' as const,
      country: 'IN',
      region: 'KARNATAKA',
      financialYear: FY,
      name: 'Professional Tax - Karnataka FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        slabs: [
          { maxSalary: 15000, tax: 0 },
          { maxSalary: 25000, tax: 200 },
          { maxSalary: 50000, tax: 300 },
          { maxSalary: null, tax: 500 },
        ],
        defaultTax: 200,
      },
    },

    // ── PT — Telangana ──
    {
      configType: 'PT' as const,
      country: 'IN',
      region: 'TELANGANA',
      financialYear: FY,
      name: 'Professional Tax - Telangana FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        slabs: [
          { maxSalary: 15000, tax: 0 },
          { maxSalary: 20000, tax: 150 },
          { maxSalary: null, tax: 200 },
        ],
        defaultTax: 200,
      },
    },

    // ── PT — Andhra Pradesh ──
    {
      configType: 'PT' as const,
      country: 'IN',
      region: 'ANDHRA_PRADESH',
      financialYear: FY,
      name: 'Professional Tax - Andhra Pradesh FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        slabs: [
          { maxSalary: 15000, tax: 0 },
          { maxSalary: 20000, tax: 150 },
          { maxSalary: null, tax: 200 },
        ],
        defaultTax: 200,
      },
    },

    // ── PT — West Bengal ──
    {
      configType: 'PT' as const,
      country: 'IN',
      region: 'WEST_BENGAL',
      financialYear: FY,
      name: 'Professional Tax - West Bengal FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        slabs: [
          { maxSalary: 10000, tax: 0 },
          { maxSalary: 15000, tax: 110 },
          { maxSalary: 25000, tax: 130 },
          { maxSalary: 40000, tax: 150 },
          { maxSalary: null, tax: 200 },
        ],
        defaultTax: 200,
      },
    },

    // ── PT — Gujarat ──
    {
      configType: 'PT' as const,
      country: 'IN',
      region: 'GUJARAT',
      financialYear: FY,
      name: 'Professional Tax - Gujarat FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        slabs: [
          { maxSalary: 5999, tax: 0 },
          { maxSalary: 8999, tax: 80 },
          { maxSalary: 11999, tax: 150 },
          { maxSalary: null, tax: 200 },
        ],
        defaultTax: 200,
      },
    },

    // ── TDS New Regime (FY 2025-26 — Budget 2025) ──
    {
      configType: 'TDS_NEW_REGIME' as const,
      country: 'IN',
      region: null,
      financialYear: FY,
      name: 'TDS New Regime Slabs FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        slabs: [
          { min: 0, max: 400000, rate: 0 },
          { min: 400000, max: 800000, rate: 5 },
          { min: 800000, max: 1200000, rate: 10 },
          { min: 1200000, max: 1600000, rate: 15 },
          { min: 1600000, max: 2000000, rate: 20 },
          { min: 2000000, max: 2400000, rate: 25 },
          { min: 2400000, max: null, rate: 30 },
        ],
        cessRate: 4,
      },
    },

    // ── TDS Old Regime ──
    {
      configType: 'TDS_OLD_REGIME' as const,
      country: 'IN',
      region: null,
      financialYear: FY,
      name: 'TDS Old Regime Slabs FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        slabs: [
          { min: 0, max: 250000, rate: 0 },
          { min: 250000, max: 500000, rate: 5 },
          { min: 500000, max: 1000000, rate: 20 },
          { min: 1000000, max: null, rate: 30 },
        ],
        cessRate: 4,
      },
    },

    // ── Standard Deduction ──
    {
      configType: 'STANDARD_DEDUCTION' as const,
      country: 'IN',
      region: null,
      financialYear: FY,
      name: 'Standard Deduction FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        NEW: 75000,
        OLD: 50000,
      },
    },

    // ── Rebate u/s 87A ──
    {
      configType: 'REBATE_87A' as const,
      country: 'IN',
      region: null,
      financialYear: FY,
      name: 'Rebate u/s 87A FY 2025-26',
      effectiveFrom: EFFECTIVE_FROM,
      rules: {
        maxRebate: 60000,
        incomeLimit: 1200000,
      },
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const cfg of configs) {
    try {
      await (prisma as any).statutoryRateConfig.upsert({
        where: {
          configType_country_region_financialYear: {
            configType: cfg.configType,
            country: cfg.country,
            region: cfg.region ?? '',
            financialYear: cfg.financialYear,
          },
        },
        update: {
          name: cfg.name,
          rules: cfg.rules,
          effectiveFrom: cfg.effectiveFrom,
          isActive: true,
        },
        create: {
          configType: cfg.configType,
          country: cfg.country,
          region: cfg.region,
          financialYear: cfg.financialYear,
          name: cfg.name,
          rules: cfg.rules,
          effectiveFrom: cfg.effectiveFrom,
          isActive: true,
        },
      });
      created++;
      console.log(`  ✓ ${cfg.configType}${cfg.region ? ` (${cfg.region})` : ''}`);
    } catch (err: any) {
      if (err.code === 'P2002') {
        skipped++;
        console.log(`  – ${cfg.configType}${cfg.region ? ` (${cfg.region})` : ''} already exists, skipped`);
      } else {
        throw err;
      }
    }
  }

  console.log(`\nDone: ${created} created/updated, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
