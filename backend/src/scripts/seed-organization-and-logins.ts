/**
 * Creates one organization, SUPER_ADMIN, ORG_ADMIN, and HR_MANAGER users with known credentials.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/seed-organization-and-logins.ts
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

dotenv.config();
const prisma = new PrismaClient();

const CREDENTIALS = {
  organization: { name: 'BNC Motors', legalName: 'BNC Motors Pvt Ltd', industry: 'Automotive', sizeRange: '51-200' as const },
  superAdmin: { email: 'admin@hrms.com', password: 'Admin@123456', firstName: 'Super', lastName: 'Admin' },
  orgAdmin: { email: 'orgadmin@hrms.com', password: 'OrgAdmin@123', firstName: 'Org', lastName: 'Admin' },
  hr: { email: 'hr@hrms.com', password: 'Hr@123456', firstName: 'HR', lastName: 'Manager' },
};

function genEmployeeCode(): string {
  return `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/** Reserve next employee code for org (prefix + next number). Falls back to random if org has no prefix/next. */
async function getNextOrgEmployeeCode(orgId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { employeeIdPrefix: true, employeeIdNextNumber: true },
  });
  if (!org?.employeeIdPrefix?.trim() || org.employeeIdNextNumber == null) {
    let code = genEmployeeCode();
    while (await prisma.employee.findUnique({ where: { employeeCode: code } })) code = genEmployeeCode();
    return code;
  }
  const prefix = org.employeeIdPrefix.trim();
  const next = org.employeeIdNextNumber;
  await prisma.organization.update({
    where: { id: orgId },
    data: { employeeIdNextNumber: next + 1 },
  });
  return `${prefix}${next}`;
}

async function ensureOrganization() {
  let org = await prisma.organization.findFirst({ where: { name: CREDENTIALS.organization.name } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: CREDENTIALS.organization.name,
        legalName: CREDENTIALS.organization.legalName,
        industry: CREDENTIALS.organization.industry,
        sizeRange: CREDENTIALS.organization.sizeRange,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        address: {},
        settings: {},
        employeeIdPrefix: 'BNC',
        employeeIdNextNumber: 1,
      },
    });
    console.log('✅ Organization created:', org.name, '(employee codes: BNC1, BNC2, ...)');
  } else {
    if (org.employeeIdPrefix == null || org.employeeIdNextNumber == null) {
      org = await prisma.organization.update({
        where: { id: org.id },
        data: {
          employeeIdPrefix: org.employeeIdPrefix ?? 'BNC',
          employeeIdNextNumber: org.employeeIdNextNumber ?? 1,
        },
      });
      console.log('✅ Organization updated with employee code prefix/sequence');
    } else {
      console.log('✅ Organization exists:', org.name);
    }
  }
  return org;
}

async function ensureSuperAdmin(orgId: string) {
  const { email, password, firstName, lastName } = CREDENTIALS.superAdmin;
  const existing = await prisma.user.findUnique({ where: { email }, include: { employee: true } });
  if (existing) {
    if (existing.role !== 'SUPER_ADMIN') {
      await prisma.user.update({ where: { email }, data: { role: 'SUPER_ADMIN', organizationId: orgId } });
      console.log('✅ Existing user upgraded to SUPER_ADMIN:', email);
    } else {
      console.log('✅ SUPER_ADMIN already exists:', email);
    }
    return { email, password };
  }
  const passwordHash = await hashPassword(password);
  const employeeCode = await getNextOrgEmployeeCode(orgId);
  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      organizationId: orgId,
      isEmailVerified: true,
      isActive: true,
    },
  });
  await prisma.employee.create({
    data: {
      organizationId: orgId,
      employeeCode,
      userId: newUser.id,
      firstName,
      lastName,
      email,
      employeeStatus: 'ACTIVE',
      dateOfJoining: new Date(),
    },
  });
  console.log('✅ SUPER_ADMIN created:', email);
  return { email, password };
}

async function ensureOrgAdmin(orgId: string) {
  const { email, password, firstName, lastName } = CREDENTIALS.orgAdmin;
  const existing = await prisma.user.findUnique({ where: { email }, include: { employee: true } });
  if (existing) {
    if (existing.role !== 'ORG_ADMIN') {
      await prisma.user.update({ where: { email }, data: { role: 'ORG_ADMIN', organizationId: orgId } });
      console.log('✅ Existing user upgraded to ORG_ADMIN:', email);
    } else {
      console.log('✅ ORG_ADMIN already exists:', email);
    }
    return { email, password };
  }
  const passwordHash = await hashPassword(password);
  const employeeCode = await getNextOrgEmployeeCode(orgId);
  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ORG_ADMIN',
      organizationId: orgId,
      isEmailVerified: true,
      isActive: true,
    },
  });
  await prisma.employee.create({
    data: {
      organizationId: orgId,
      employeeCode,
      userId: newUser.id,
      firstName,
      lastName,
      email,
      employeeStatus: 'ACTIVE',
      dateOfJoining: new Date(),
    },
  });
  console.log('✅ ORG_ADMIN created:', email);
  return { email, password };
}

async function ensureHrUser(orgId: string) {
  const { email, password, firstName, lastName } = CREDENTIALS.hr;
  const existing = await prisma.user.findUnique({ where: { email }, include: { employee: true } });
  if (existing) {
    if (existing.role !== 'HR_MANAGER') {
      await prisma.user.update({ where: { email }, data: { role: 'HR_MANAGER', organizationId: orgId } });
      console.log('✅ Existing user upgraded to HR_MANAGER:', email);
    } else {
      console.log('✅ HR_MANAGER already exists:', email);
    }
    return { email, password };
  }
  const passwordHash = await hashPassword(password);
  const employeeCode = await getNextOrgEmployeeCode(orgId);
  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'HR_MANAGER',
      organizationId: orgId,
      isEmailVerified: true,
      isActive: true,
    },
  });
  await prisma.employee.create({
    data: {
      organizationId: orgId,
      employeeCode,
      userId: newUser.id,
      firstName,
      lastName,
      email,
      employeeStatus: 'ACTIVE',
      dateOfJoining: new Date(),
    },
  });
  console.log('✅ HR_MANAGER created:', email);
  return { email, password };
}

async function main() {
  console.log('\n--- Seed: Organization, Super Admin, Org Admin, HR Login ---\n');
  const org = await ensureOrganization();
  const superCreds = await ensureSuperAdmin(org.id);
  const orgAdminCreds = await ensureOrgAdmin(org.id);
  const hrCreds = await ensureHrUser(org.id);

  const summary = `
========================================
  LOGIN CREDENTIALS (save this)
========================================

Organization: ${org.name} (${org.id})

SUPER ADMIN (full access, create orgs/admins)
  URL:      http://localhost:5173/login  (or your frontend URL)
  Email:    ${superCreds.email}
  Password: ${superCreds.password}

ORGANIZATION ADMIN (admin for ${org.name} only)
  URL:      http://localhost:5173/login
  Email:    ${orgAdminCreds.email}
  Password: ${orgAdminCreds.password}

HR MANAGER (manage employees, leave, attendance for ${org.name})
  URL:      http://localhost:5173/login
  Email:    ${hrCreds.email}
  Password: ${hrCreds.password}

========================================
`;
  console.log(summary);

  // Write to file in project root for easy sharing
  const outPath = path.join(__dirname, '../../..', 'LOGIN_CREDENTIALS.txt');
  fs.writeFileSync(outPath, summary.trim(), 'utf8');
  console.log('Credentials saved to: LOGIN_CREDENTIALS.txt\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
