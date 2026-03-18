/**
 * Sync Cost Centres, Departments, Sub-Departments from Config DB to HRMS
 *
 * Usage:
 *   CONFIGURATOR_AUTH_TOKEN=<token> npx ts-node -r tsconfig-paths/register src/scripts/sync-config-to-hrms.ts [company_id]
 *
 * Or get token from a user in HRMS:
 *   npx ts-node -r tsconfig-paths/register src/scripts/sync-config-to-hrms.ts 59
 *   (uses first user with configuratorAccessToken for org linked to company 59)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { prisma } from '../utils/prisma';
import { configuratorService } from '../services/configurator.service';

async function main() {
  const companyId = parseInt(process.argv[2] || String(process.env.CONFIGURATOR_DEFAULT_COMPANY_ID || '59'), 10);
  let accessToken = process.env.CONFIGURATOR_AUTH_TOKEN as string | undefined;

  if (!accessToken) {
    const org = await prisma.organization.findFirst({
      where: { configuratorCompanyId: companyId },
      select: { id: true, name: true },
    });
    if (!org) {
      console.error(`Organization with configurator_company_id=${companyId} not found. Run sync-organization-configurator-59.sql first.`);
      process.exit(1);
    }
    const user = await prisma.user.findFirst({
      where: { organizationId: org.id, configuratorAccessToken: { not: null } },
      select: { configuratorAccessToken: true, email: true },
    });
    accessToken = user?.configuratorAccessToken ?? undefined;
    if (!accessToken) {
      console.error('No configurator token. Login via HRMS or set CONFIGURATOR_AUTH_TOKEN.');
      process.exit(1);
    }
    console.log(`Using token from user in org: ${org.name}`);
  }

  console.log(`\nSyncing from Config DB (company_id=${companyId}) to HRMS...\n`);

  const org = await prisma.organization.findFirst({
    where: { configuratorCompanyId: companyId },
    select: { id: true, name: true },
  });
  if (!org) {
    console.error('Organization not found for company_id', companyId);
    process.exit(1);
  }

  // 1. Cost Centres
  const costCentres = await configuratorService.getCostCentres(accessToken, companyId);
  let ccCreated = 0;
  let ccUpdated = 0;
  for (const c of costCentres) {
    const existing = await prisma.costCentre.findFirst({
      where: { organizationId: org.id, OR: [{ configuratorCostCentreId: c.id }, { code: c.code }] },
    });
    if (existing) {
      if (existing.configuratorCostCentreId !== c.id) {
        await prisma.costCentre.update({
          where: { id: existing.id },
          data: { name: c.name, configuratorCostCentreId: c.id },
        });
        ccUpdated++;
        console.log(`  Updated cost centre: ${c.name} [${c.code}]`);
      }
    } else {
      const code = c.code || c.name?.replace(/\s+/g, '_').toUpperCase().slice(0, 50);
      const dup = await prisma.costCentre.findFirst({ where: { code } });
      const finalCode = dup ? `${code}_${c.id}` : code;
      await prisma.costCentre.create({
        data: {
          organizationId: org.id,
          name: c.name || 'Unnamed',
          code: finalCode,
          configuratorCostCentreId: c.id,
          isActive: true,
        },
      });
      ccCreated++;
      console.log(`  Created cost centre: ${c.name} [${finalCode}]`);
    }
  }
  console.log(`Cost centres: ${ccCreated} created, ${ccUpdated} updated\n`);

  // 2. Departments
  const departments = await configuratorService.getDepartments(accessToken, { companyId });
  let deptCreated = 0;
  let deptUpdated = 0;
  for (const d of departments) {
    const existing = await prisma.department.findFirst({
      where: { organizationId: org.id, configuratorDepartmentId: d.id },
    });
    const code = d.code || d.name?.replace(/\s+/g, '_').toUpperCase().slice(0, 50);
    if (existing) {
      await prisma.department.update({
        where: { id: existing.id },
        data: { name: d.name, code: code || existing.code },
      });
      deptUpdated++;
      console.log(`  Updated department: ${d.name}`);
    } else {
      const codeUnique = await prisma.department.findFirst({ where: { code } });
      const finalCode = codeUnique ? `${code}_${d.id}` : code;
      await prisma.department.create({
        data: {
          organizationId: org.id,
          name: d.name || 'Unnamed',
          code: finalCode,
          configuratorDepartmentId: d.id,
          isActive: true,
        },
      });
      deptCreated++;
      console.log(`  Created department: ${d.name} [${finalCode}]`);
    }
  }
  console.log(`Departments: ${deptCreated} created, ${deptUpdated} updated\n`);

  // 3. Sub-Departments
  const subDepts = await configuratorService.getSubDepartments(accessToken, { companyId });
  let subCreated = 0;
  let subUpdated = 0;
  for (const s of subDepts) {
    const existing = await prisma.subDepartment.findFirst({
      where: { organizationId: org.id, configuratorSubDepartmentId: s.id },
    });
    if (existing) {
      await prisma.subDepartment.update({
        where: { id: existing.id },
        data: { name: s.name },
      });
      subUpdated++;
      console.log(`  Updated sub-department: ${s.name}`);
    } else {
      const existingByName = await prisma.subDepartment.findFirst({
        where: { organizationId: org.id, name: { equals: s.name, mode: 'insensitive' } },
      });
      if (existingByName) {
        await prisma.subDepartment.update({
          where: { id: existingByName.id },
          data: { configuratorSubDepartmentId: s.id },
        });
        subUpdated++;
      } else {
        await prisma.subDepartment.create({
          data: {
            organizationId: org.id,
            name: s.name || 'Unnamed',
            configuratorSubDepartmentId: s.id,
            isActive: true,
          },
        });
        subCreated++;
        console.log(`  Created sub-department: ${s.name}`);
      }
    }
  }
  console.log(`Sub-departments: ${subCreated} created, ${subUpdated} updated\n`);

  console.log('Sync complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
