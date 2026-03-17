/**
 * seed-mm-tech-leave-setup.ts
 * ---------------------------
 * Fixes MM Tech org leave setup:
 *  1. Creates RightsAllocation (Default Rights Template) with EL + SL
 *  2. Creates WorkflowMapping (Staff Leave Approval) with HR approval level
 *  3. Seeds EL + SL leave balances for all active MM Tech employees (year 2026)
 *
 * Run: cd backend && npx ts-node --transpile-only src/scripts/seed-mm-tech-leave-setup.ts
 */

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 MM Tech Leave Setup Seed\n');

  // ── 1. Find MM Tech org ──────────────────────────────────────
  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'MM Tech' } },
  });
  if (!org) {
    console.error('❌ MM Tech organization not found. Check org name in DB.');
    process.exit(1);
  }
  console.log(`✓ Found org: ${org.name} (${org.id})\n`);

  // ── 2. Ensure EL and SL leave types exist ───────────────────
  console.log('--- Leave Types ---');
  const LEAVE_TYPES_TO_SEED = [
    { code: 'EL', name: 'Earned Leave',  isPaid: true, defaultDaysPerYear: 18, maxCarryForward: 15, accrualType: 'MONTHLY' as const, colorCode: '#3B82F6' },
    { code: 'SL', name: 'Sick Leave',    isPaid: true, defaultDaysPerYear: 12, maxCarryForward: 0,  accrualType: 'MONTHLY' as const, colorCode: '#EF4444' },
    { code: 'CL', name: 'Casual Leave',  isPaid: true, defaultDaysPerYear: 12, maxCarryForward: 0,  accrualType: 'MONTHLY' as const, colorCode: '#10B981' },
  ];

  for (const lt of LEAVE_TYPES_TO_SEED) {
    // First check if this org already has a leave type with this name
    const existingInOrg = await prisma.leaveType.findFirst({
      where: { organizationId: org.id, name: lt.name },
    });
    if (existingInOrg) {
      console.log(`  → Exists: ${lt.name} (${lt.code})`);
      continue;
    }
    // Check if code is taken globally by another org
    const codeExists = await prisma.leaveType.findUnique({ where: { code: lt.code } });
    const codeToUse = codeExists ? null : lt.code; // use null code if taken
    await prisma.leaveType.create({
      data: {
        organizationId: org.id,
        code: codeToUse,
        name: lt.name,
        isPaid: lt.isPaid,
        defaultDaysPerYear: new Prisma.Decimal(lt.defaultDaysPerYear),
        maxCarryForward: new Prisma.Decimal(lt.maxCarryForward),
        accrualType: lt.accrualType,
        colorCode: lt.colorCode,
        requiresApproval: lt.code === 'EL' || lt.code === 'CL',
        requiresDocument: false,
        canBeNegative: false,
        isActive: true,
      },
    });
    console.log(`  ✅ Created: ${lt.name}${codeToUse ? ' (' + codeToUse + ')' : ' (no code — taken globally)'}`);
  }

  const leaveTypes = await prisma.leaveType.findMany({
    where: { organizationId: org.id },
  });
  console.log(`✓ Total ${leaveTypes.length} leave type(s) for MM Tech`);

  const elType = leaveTypes.find(lt => lt.code === 'EL' || lt.name === 'Earned Leave');
  const slType = leaveTypes.find(lt => lt.code === 'SL' || lt.name === 'Sick Leave');

  if (!elType) console.log('  ⚠  EL type still not found');
  else console.log(`  → EL: ${elType.name} (${elType.id})`);
  if (!slType) console.log('  ⚠  SL type still not found');
  else console.log(`  → SL: ${slType.name} (${slType.id})`);

  // ── 3. Find all active employees ────────────────────────────
  const employees = await prisma.employee.findMany({
    where: { organizationId: org.id, employeeStatus: 'ACTIVE' },
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  });
  console.log(`\n✓ Found ${employees.length} active employee(s)\n`);

  // ── 4. Find existing approval workflow ──────────────────────
  const approvalWorkflow = await prisma.approvalWorkflow.findFirst({
    where: { organizationId: org.id },
  });
  if (approvalWorkflow) {
    console.log(`✓ Found approval workflow: ${approvalWorkflow.shortName} (${approvalWorkflow.id})`);
  } else {
    console.log('  ⚠  No approval workflow found — WorkflowMapping approvalLevels will be empty');
  }

  // Find Ganeshan (HR Manager) for approval level
  const ganeshan = await prisma.employee.findFirst({
    where: { organizationId: org.id, employeeCode: 'mm00011' },
    select: { id: true, employeeCode: true, firstName: true },
  });
  if (ganeshan) {
    console.log(`✓ Found approver: ${ganeshan.firstName} (${ganeshan.employeeCode})`);
  }

  // ── 5. Create RightsAllocation ──────────────────────────────
  console.log('\n--- Rights Allocation ---');
  const existingRA = await prisma.rightsAllocation.findFirst({
    where: { organizationId: org.id, shortName: 'DEFAULT' },
  });

  let rightsAllocation;
  if (existingRA) {
    rightsAllocation = existingRA;
    console.log(`→ Skipped (exists): Default Rights Template (${existingRA.id})`);
  } else {
    const attendanceEvents = leaveTypes.map(lt => ({
      eventId: lt.id,
      eventName: lt.name,
      shortName: lt.code || lt.name,
      toApprove: true,
      cancelApproval: false,
      deleteApproval: false,
      allowMax: 5,
    }));

    rightsAllocation = await prisma.rightsAllocation.create({
      data: {
        organizationId: org.id,
        shortName: 'DEFAULT',
        longName: 'Default Rights Template',
        remarks: 'Auto-created by seed script',
        attendanceEvents: attendanceEvents as any,
      },
    });
    console.log(`✅ Created: Default Rights Template (${rightsAllocation.id})`);
  }

  // ── 6. Create WorkflowMapping ────────────────────────────────
  console.log('\n--- Workflow Mapping ---');
  const existingWM = await prisma.workflowMapping.findFirst({
    where: { organizationId: org.id, displayName: 'Staff Leave Approval' },
  });

  if (existingWM) {
    // Update entryRightsTemplate if missing
    if (!existingWM.entryRightsTemplate) {
      await prisma.workflowMapping.update({
        where: { id: existingWM.id },
        data: { entryRightsTemplate: rightsAllocation.id },
      });
      console.log(`✓ Updated existing WorkflowMapping with Rights Template`);
    } else {
      console.log(`→ Skipped (exists): Staff Leave Approval`);
    }
  } else {
    const approvalLevels = ganeshan ? [
      {
        level: 1,
        levelName: '1',
        associateId: ganeshan.id,
        hierarchy: 'HR Manager',
        approvalLevel: approvalWorkflow?.id || 'hr approval',
      }
    ] : [];

    await prisma.workflowMapping.create({
      data: {
        organizationId: org.id,
        displayName: 'Staff Leave Approval',
        entryRightsTemplate: rightsAllocation.id,
        approvalLevels: approvalLevels as any,
        remarks: 'Auto-created by seed script',
      },
    });
    console.log(`✅ Created: Staff Leave Approval WorkflowMapping`);
  }

  // ── 7. Seed leave balances for all employees ─────────────────
  console.log('\n--- Leave Balances (2026) ---');
  const YEAR = 2026;
  let created = 0;
  let skipped = 0;

  const leaveTypesToSeed = [
    { type: elType, days: 6 },
    { type: slType, days: 3 },
  ].filter(x => x.type != null) as { type: (typeof leaveTypes)[0]; days: number }[];

  for (const emp of employees) {
    for (const { type: lt, days } of leaveTypesToSeed) {
      const existing = await prisma.employeeLeaveBalance.findFirst({
        where: { employeeId: emp.id, leaveTypeId: lt.id, year: YEAR },
      });

      if (existing) {
        skipped++;
      } else {
        await prisma.employeeLeaveBalance.create({
          data: {
            employeeId: emp.id,
            leaveTypeId: lt.id,
            year: YEAR,
            openingBalance: days,
            accrued: days,
            used: 0,
            carriedForward: 0,
            available: days,
          },
        });
        created++;
      }
    }
  }

  console.log(`✅ Leave balances: ${created} created, ${skipped} already existed`);

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n✅ Done!\n');
  console.log('Next steps:');
  console.log('  1. Refresh Attendance → Vadivelan → Monthly Details');
  console.log('  2. EL should show Balance = 6, SL Balance = 3');
  console.log('  3. Workflow Mapping page should show "Staff Leave Approval"');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
