/**
 * Fix workflow mappings that incorrectly use Employee Approval.
 * Leave workflows must not use Employee Approval - employees cannot approve their own leave.
 *
 * This script:
 * 1. Finds workflow mappings with Employee Approval in any level
 * 2. Replaces it with Manager Approval (or HR Approval if Manager not found)
 * 3. Skips if neither Manager nor HR Approval exists for the org
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/fix-employee-approval-in-workflow-mappings.ts
 */

import { prisma } from '../utils/prisma';

const LEGACY_EMPLOYEE_IDS = ['employee_approval'];

interface ApprovalLevelRow {
  id?: string;
  level?: number;
  levelName?: string;
  associate?: string;
  hierarchy?: string;
  paygroup?: string;
  department?: string;
  approvalLevel?: string;
}

async function main() {
  console.log('🔍 Finding workflow mappings with Employee Approval...\n');

  const mappings = await prisma.workflowMapping.findMany({
    select: { id: true, organizationId: true, displayName: true, approvalLevels: true },
  });

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const m of mappings) {
    const levels = m.approvalLevels as unknown as ApprovalLevelRow[] | null;
    if (!Array.isArray(levels) || levels.length === 0) continue;

    let changed = false;
    const updated: ApprovalLevelRow[] = [];

    for (const level of levels) {
      const approvalLevel = level.approvalLevel;
      if (!approvalLevel || typeof approvalLevel !== 'string') {
        updated.push(level);
        continue;
      }

      let needsReplace = false;

      if (LEGACY_EMPLOYEE_IDS.includes(approvalLevel.trim().toLowerCase())) {
        needsReplace = true;
      } else if (/^[0-9a-f-]{36}$/i.test(approvalLevel)) {
        const wf = await prisma.approvalWorkflow.findFirst({
          where: { id: approvalLevel, organizationId: m.organizationId },
          select: { workflowType: true, shortName: true },
        });
        if (wf?.workflowType === 'Employee') needsReplace = true;
      }

      if (!needsReplace) {
        updated.push(level);
        continue;
      }

      const replacement = await prisma.approvalWorkflow.findFirst({
        where: {
          organizationId: m.organizationId,
          workflowType: { in: ['Manager', 'HR', 'Org Admin', 'Super Admin'] },
        },
        orderBy: { workflowType: 'asc' },
        select: { id: true, shortName: true, workflowType: true },
      });

      if (!replacement) {
        console.log(`⚠️  "${m.displayName}" (${m.id}): No Manager/HR/Org Admin/Super Admin workflow in org - removing Employee Approval level`);
        skipped++;
        changed = true;
        continue;
      }

      updated.push({ ...level, approvalLevel: replacement.id });
      changed = true;
    }

    if (changed) {
      const renumbered = updated.map((lev, idx) => ({
        ...lev,
        level: idx + 1,
        levelName: String(idx + 1),
      }));
      try {
        await prisma.workflowMapping.update({
          where: { id: m.id },
          data: { approvalLevels: renumbered as unknown as object },
        });
        console.log(`✅ Fixed "${m.displayName}" (${m.id})`);
        fixed++;
      } catch (e) {
        console.error(`❌ Failed to update "${m.displayName}" (${m.id}):`, e);
        errors++;
      }
    }
  }

  console.log(`\n📊 Done. Fixed: ${fixed}, Skipped: ${skipped}, Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
