/**
 * Test SASIKUMAR L import payload storage via Prisma (no server needed).
 * Verifies all Excel-mapped fields are stored correctly in DB.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/test-import-sasikumar-prisma.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BNC_ORG_ID = '26d9d4ff-aab0-4e52-ae02-dba5d455ced4';

async function main() {
  console.log('\n🧪 SASIKUMAR L Import - Direct DB Storage Test\n');

  const org = await prisma.organization.findUnique({ where: { id: BNC_ORG_ID } });
  if (!org) {
    console.error('❌ BNC Motors org not found:', BNC_ORG_ID);
    process.exit(1);
  }

  console.log('1. Delete B001 if exists...');
  const existing = await prisma.employee.findFirst({
    where: { employeeCode: 'B001', organizationId: BNC_ORG_ID },
    select: { id: true, userId: true },
  });
  if (existing) {
    await prisma.department.updateMany({ where: { managerId: existing.id }, data: { managerId: null } });
    await prisma.employee.updateMany({ where: { reportingManagerId: existing.id }, data: { reportingManagerId: null } });
    await prisma.attendanceLog.updateMany({ where: { employeeId: existing.id }, data: { employeeId: null } });
    await prisma.employee.delete({ where: { id: existing.id } });
    await prisma.user.delete({ where: { id: existing.userId } }).catch(() => {});
    console.log('   ✅ B001 deleted');
  } else {
    console.log('   ⏭️ B001 not found');
  }

  console.log('\n2. Get required IDs (department, position, paygroup, cost centre)...');
  const dept = await prisma.department.findFirst({
    where: { organizationId: BNC_ORG_ID, name: { contains: 'R', mode: 'insensitive' } },
    select: { id: true },
  });
  const pos = await prisma.jobPosition.findFirst({
    where: { organizationId: BNC_ORG_ID, title: { contains: 'Manager', mode: 'insensitive' } },
    select: { id: true },
  });
  const pg = await prisma.paygroup.findFirst({
    where: { organizationId: BNC_ORG_ID, name: { contains: 'Staff', mode: 'insensitive' } },
    select: { id: true },
  });
  const cc = await prisma.costCentre.findFirst({
    where: { organizationId: BNC_ORG_ID },
    select: { id: true },
  });

  const tempPass = `Temp@${Math.random().toString(36).slice(-8)}`;
  const { hashPassword } = await import('../utils/password');
  const passwordHash = await hashPassword(tempPass);

  console.log('\n3. Create user + employee with full import payload...');
  const user = await prisma.user.create({
    data: {
      email: 'Sasikumar.L@bncmotors.in',
      passwordHash,
      role: 'EMPLOYEE',
      organizationId: BNC_ORG_ID,
      isActive: true,
    },
  });

  const address = {
    street: 'NO.7E/17,RAMASAMYNAGAR, NEELIKONAMPALAYAM',
    permanentAddress: 'NO.7E/17,RAMASAMYNAGAR, NEELIKONAMPALAYAM',
    presentAddress: 'NO.7E/17,RAMASAMYNAGAR, NEELIKONAMPALAYAM',
    city: 'COIMBATORE',
    state: 'TAMILNADU',
    postalCode: '641033',
    presentCity: 'COIMBATORE',
    presentState: 'TAMILNADU',
    presentPincode: '641033',
    permanentDistrict: 'COIMBATORE',
    presentDistrict: 'COIMBATORE',
    presentPhoneNumber: '9943872702',
  };

  const taxInformation = {
    panNumber: 'JDVPS7057E',
    aadhaarNumber: '274787624160',
    uanNumber: '100340013651',
    pfNumber: 'CBCBE21229460000010009',
    esiNumber: '31-12345-67-890',
    esiLocation: 'COIMBATORE',
    ptaxLocation: 'COIMBATORE',
    taxRegime: 'N',
  };

  const profileExtensions = {
    fatherName: 'LOGANATHAN',
    bloodGroup: 'B+',
    subDepartment: 'Proto Typing',
    associateNoticePeriodDays: '90',
    lwfLocation: 'COIMBATORE',
    compoffApplicable: 'Yes',
  };

  const bankDetails = {
    bankName: 'ICICI BANK',
    accountNumber: '155001506289',
    ifscCode: 'ICIC0001550',
  };

  const emp = await prisma.employee.create({
    data: {
      organizationId: BNC_ORG_ID,
      userId: user.id,
      employeeCode: 'B001',
      firstName: 'SASIKUMAR',
      lastName: 'L',
      email: 'Sasikumar.L@bncmotors.in',
      officialEmail: 'Sasikumar.L@bncmotors.in',
      phone: '9943872702',
      dateOfBirth: new Date('1981-11-15'),
      dateOfJoining: new Date('2019-12-25'),
      gender: 'MALE',
      maritalStatus: 'MARRIED',
      workLocation: 'Coimbatore',
      placeOfTaxDeduction: 'METRO',
      departmentId: dept?.id ?? null,
      positionId: pos?.id ?? null,
      paygroupId: pg?.id ?? null,
      costCentreId: cc?.id ?? null,
      address: address as any,
      taxInformation: taxInformation as any,
      bankDetails: bankDetails as any,
      profileExtensions: profileExtensions as any,
    },
  });

  console.log('   ✅ Employee created:', emp.id);

  console.log('\n4. Verify all fields in DB...');
  const fetched = await prisma.employee.findUnique({
    where: { id: emp.id },
  });

  const addr = (fetched?.address || {}) as Record<string, string>;
  const tax = (fetched?.taxInformation || {}) as Record<string, string>;
  const prof = (fetched?.profileExtensions || {}) as Record<string, string>;
  const bank = (fetched?.bankDetails || {}) as Record<string, string>;

  const checks: { name: string; ok: boolean }[] = [
    { name: 'Blood Group', ok: prof.bloodGroup === 'B+' },
    { name: 'Pan Card Number', ok: tax.panNumber === 'JDVPS7057E' },
    { name: 'Official E-Mail', ok: fetched?.officialEmail === 'Sasikumar.L@bncmotors.in' },
    { name: 'PF Number', ok: tax.pfNumber === 'CBCBE21229460000010009' },
    { name: 'UAN Number', ok: tax.uanNumber === '100340013651' },
    { name: 'ESI Number', ok: tax.esiNumber === '31-12345-67-890' },
    { name: 'Adhaar Number', ok: tax.aadhaarNumber === '274787624160' },
    { name: 'Location', ok: fetched?.workLocation === 'Coimbatore' },
    { name: 'ESI Location', ok: tax.esiLocation === 'COIMBATORE' },
    { name: 'Ptax Location', ok: tax.ptaxLocation === 'COIMBATORE' },
    { name: 'Tax Regime', ok: tax.taxRegime === 'N' },
    { name: 'Associate Notice Period Days', ok: prof.associateNoticePeriodDays === '90' },
    { name: 'LWF Location', ok: prof.lwfLocation === 'COIMBATORE' },
    { name: 'Permanent District', ok: addr.permanentDistrict === 'COIMBATORE' },
    { name: 'Current District', ok: addr.presentDistrict === 'COIMBATORE' },
    { name: 'Permanent mobile (phone)', ok: fetched?.phone === '9943872702' },
    { name: 'Sub Department', ok: prof.subDepartment === 'Proto Typing' },
    { name: 'Compoff Applicable', ok: prof.compoffApplicable === 'Yes' },
    { name: 'Father Name', ok: prof.fatherName === 'LOGANATHAN' },
    { name: 'Bank Name', ok: bank.bankName === 'ICICI BANK' },
    { name: 'Bank Account', ok: bank.accountNumber === '155001506289' },
  ];

  let failed = 0;
  checks.forEach((c) => {
    const icon = c.ok ? '✅' : '❌';
    console.log(`   ${icon} ${c.name}`);
    if (!c.ok) failed++;
  });

  console.log('\n' + (failed === 0 ? '✅ All 19 import fields stored correctly!' : `❌ ${failed} field(s) failed.`));
  console.log('\nExcel for manual upload: docs/employee_import_test_sasikumar.xlsx');
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
