/**
 * Test employee import with SASIKUMAR L row - verifies all Excel fields are stored.
 * Simulates the payload that frontend import would send after parsing the Excel.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/test-import-sasikumar-row.ts
 *
 * Prereq: Backend running, BNC Motors org exists. Run create-test-import-sasikumar.js to generate Excel for manual test.
 */
import 'dotenv/config';
import axios from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001';
const API_BASE = `${BASE_URL}/api/v1`;
const BNC_ORG_ID = '26d9d4ff-aab0-4e52-ae02-dba5d455ced4';

async function apiCall(method: 'GET' | 'POST' | 'DELETE', endpoint: string, data?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await axios({ method, url: `${API_BASE}${endpoint}`, data, headers, validateStatus: () => true });
  return { status: res.status, data: res.data };
}

async function main() {
  console.log('\n🧪 SASIKUMAR L Import Row - Storage Verification\n');

  console.log('1. Login...');
  const logins = [
    { email: 'admin@bncmotors.com', password: 'Admin@123456' },
    { email: 'orgadmin@hrms.com', password: 'OrgAdmin@123' },
    { email: 'admin@hrms.com', password: 'Admin@123456' },
  ];
  let token: string | undefined;
  for (const cred of logins) {
    const { status, data } = await apiCall('POST', '/auth/login', cred);
    if (status === 200) {
      token = data?.tokens?.accessToken || data?.data?.tokens?.accessToken;
      if (token) {
        console.log('   ✅ Logged in');
        break;
      }
    }
  }
  if (!token) {
    console.error('❌ Login failed. Start backend and ensure seed users exist.');
    process.exit(1);
  }

  console.log('\n2. Delete B001 if exists...');
  const listRes = (await apiCall('GET', `/employees?organizationId=${BNC_ORG_ID}&limit=5000`, undefined, token)).data;
  const employees = listRes?.data?.employees || listRes?.employees || [];
  const b001 = employees.find((e: any) => e.employeeCode === 'B001');
  if (b001) {
    await apiCall('DELETE', `/employees/${b001.id}`, undefined, token);
    console.log('   ✅ B001 deleted');
  } else {
    console.log('   ⏭️ B001 not found');
  }

  console.log('\n3. Create employee with import payload (SASIKUMAR L row)...');

  // Payload as frontend import would produce from the Excel row
  const createPayload = {
    organizationId: BNC_ORG_ID,
    employeeCode: 'B001',
    firstName: 'SASIKUMAR',
    lastName: 'L',
    email: 'Sasikumar.L@bncmotors.in',
    dateOfJoining: '2019-12-25',
    officialEmail: 'Sasikumar.L@bncmotors.in',
    phone: '9943872702',
    dateOfBirth: '1981-11-15',
    gender: 'MALE',
    maritalStatus: 'MARRIED',
    workLocation: 'Coimbatore',
    placeOfTaxDeduction: 'METRO',
    address: {
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
    },
    taxInformation: {
      panNumber: 'JDVPS7057E',
      aadhaarNumber: '274787624160',
      uanNumber: '100340013651',
      pfNumber: 'CBCBE21229460000010009',
      esiLocation: 'COIMBATORE',
      ptaxLocation: 'COIMBATORE',
      taxRegime: 'N',
    },
    bankDetails: {
      bankName: 'ICICI BANK',
      accountNumber: '155001506289',
      ifscCode: 'ICIC0001550',
    },
    profileExtensions: {
      fatherName: 'LOGANATHAN',
      bloodGroup: 'B+',
      subDepartment: 'Proto Typing',
      associateNoticePeriodDays: '90',
      lwfLocation: 'COIMBATORE',
      compoffApplicable: 'Yes',
    },
  };

  const { status: createStatus, data: createRes } = await apiCall('POST', '/employees', createPayload, token);

  if (createStatus !== 201 && createStatus !== 200) {
    console.error('❌ Create failed:', createStatus, JSON.stringify(createRes?.errors || createRes?.message || createRes, null, 2));
    process.exit(1);
  }

  const empId = createRes?.data?.employee?.id || createRes?.employee?.id;
  if (!empId) {
    console.error('❌ No employee ID in response');
    process.exit(1);
  }
  console.log('   ✅ Employee created:', empId);

  console.log('\n4. Verify all fields stored...');
  const { status: getStatus, data: getRes } = await apiCall('GET', `/employees/${empId}`, undefined, token);
  if (getStatus !== 200) {
    console.error('❌ Get failed:', getStatus);
    process.exit(1);
  }

  const emp = getRes?.data?.employee || getRes?.employee;
  const addr = emp?.address as Record<string, string> | undefined;
  const tax = emp?.taxInformation as Record<string, string> | undefined;
  const prof = emp?.profileExtensions as Record<string, string> | undefined;
  const bank = emp?.bankDetails as Record<string, string> | undefined;

  const checks: { name: string; ok: boolean; expected: string; actual: string }[] = [
    { name: 'Blood Group', ok: prof?.bloodGroup === 'B+', expected: 'B+', actual: prof?.bloodGroup ?? '' },
    { name: 'Pan Card Number', ok: tax?.panNumber === 'JDVPS7057E', expected: 'JDVPS7057E', actual: tax?.panNumber ?? '' },
    { name: 'Official E-Mail', ok: emp?.officialEmail === 'Sasikumar.L@bncmotors.in', expected: 'Sasikumar.L@bncmotors.in', actual: emp?.officialEmail ?? '' },
    { name: 'PF Number', ok: tax?.pfNumber === 'CBCBE21229460000010009', expected: 'CBCBE21229460000010009', actual: tax?.pfNumber ?? '' },
    { name: 'UAN Number', ok: tax?.uanNumber === '100340013651', expected: '100340013651', actual: tax?.uanNumber ?? '' },
    { name: 'Adhaar Number', ok: tax?.aadhaarNumber === '274787624160', expected: '274787624160', actual: tax?.aadhaarNumber ?? '' },
    { name: 'Location', ok: emp?.workLocation === 'Coimbatore', expected: 'Coimbatore', actual: emp?.workLocation ?? '' },
    { name: 'ESI Location', ok: tax?.esiLocation === 'COIMBATORE', expected: 'COIMBATORE', actual: tax?.esiLocation ?? '' },
    { name: 'Ptax Location', ok: tax?.ptaxLocation === 'COIMBATORE', expected: 'COIMBATORE', actual: tax?.ptaxLocation ?? '' },
    { name: 'Tax Regime', ok: tax?.taxRegime === 'N', expected: 'N', actual: tax?.taxRegime ?? '' },
    { name: 'Associate Notice Period Days', ok: prof?.associateNoticePeriodDays === '90', expected: '90', actual: prof?.associateNoticePeriodDays ?? '' },
    { name: 'LWF Location', ok: prof?.lwfLocation === 'COIMBATORE', expected: 'COIMBATORE', actual: prof?.lwfLocation ?? '' },
    { name: 'Permanent District', ok: addr?.permanentDistrict === 'COIMBATORE', expected: 'COIMBATORE', actual: addr?.permanentDistrict ?? '' },
    { name: 'Current District', ok: addr?.presentDistrict === 'COIMBATORE', expected: 'COIMBATORE', actual: addr?.presentDistrict ?? '' },
    { name: 'Permanent mobile (phone)', ok: emp?.phone === '9943872702', expected: '9943872702', actual: emp?.phone ?? '' },
    { name: 'Sub Department', ok: prof?.subDepartment === 'Proto Typing', expected: 'Proto Typing', actual: prof?.subDepartment ?? '' },
    { name: 'Compoff Applicable', ok: prof?.compoffApplicable === 'Yes', expected: 'Yes', actual: prof?.compoffApplicable ?? '' },
    { name: 'Father Name', ok: prof?.fatherName === 'LOGANATHAN', expected: 'LOGANATHAN', actual: prof?.fatherName ?? '' },
    { name: 'Bank Details', ok: bank?.bankName === 'ICICI BANK' && bank?.accountNumber === '155001506289', expected: 'ICICI BANK', actual: bank?.bankName ?? '' },
  ];

  let failed = 0;
  checks.forEach((c) => {
    const icon = c.ok ? '✅' : '❌';
    console.log(`   ${icon} ${c.name}: ${c.ok ? 'OK' : `got "${c.actual}"`}`);
    if (!c.ok) failed++;
  });

  console.log('\n' + (failed === 0 ? '✅ All fields stored correctly!' : `❌ ${failed} field(s) failed.`));
  console.log('\nFor manual Excel upload test, run: node scripts/create-test-import-sasikumar.js');
  console.log('Then upload docs/employee_import_test_sasikumar.xlsx via Employees page Import Excel.');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
