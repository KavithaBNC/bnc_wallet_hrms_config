/**
 * Test that employee import fields are stored correctly.
 * Creates employee with all import fields (Sasikumar-like data) and verifies storage.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/test-employee-import-fields.ts
 *
 * Prerequisites:
 * - Backend running (npm run dev)
 * - Run seed-bnc-motors-departments.ts and seed-bnc-motors-subdepartments-costcentres.ts for BNC Motors
 */
import axios from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api/v1`;
// BNC Motors org - use seed org if this doesn't exist
const BNC_ORG_ID = process.env.TEST_ORG_ID || '26d9d4ff-aab0-4e52-ae02-dba5d455ced4';

async function apiCall(method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, data?: any, token?: string) {
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await axios({ method, url: `${API_BASE}${endpoint}`, data, headers, validateStatus: () => true });
  return { status: res.status, data: res.data };
}

async function main() {
  console.log('\n🧪 Employee Import Fields Storage Test\n');
  console.log('1. Login as HR/Admin...');

  // Try common seed credentials
  const logins = [
    { email: 'superadmin@test.hrms.com', password: 'Test@123' },
    { email: 'hr@bncmotors.com', password: 'Hr@123456' },
    { email: 'admin@bncmotors.com', password: 'Admin@123456' },
  ];
  let token: string | undefined;
  for (const cred of logins) {
    const { status, data } = await apiCall('POST', '/auth/login', cred);
    if (status === 200) {
      token = data?.tokens?.accessToken || data?.data?.tokens?.accessToken;
      if (token) break;
    }
  }
  if (!token) {
    console.error('❌ Could not login. Ensure backend is running and seed users exist.');
    process.exit(1);
  }
  console.log('   ✅ Logged in');

  // Resolve org - use first org if BNC not found
  let orgId = BNC_ORG_ID;
  const orgsRes = (await apiCall('GET', '/organizations', undefined, token)).data?.data?.organizations;
  if (orgsRes?.length && !orgsRes.some((o: any) => o.id === BNC_ORG_ID)) {
    orgId = orgsRes[0].id;
    console.log(`   Using org: ${orgsRes[0].name} (${orgId})`);
  }

  console.log('\n2. Delete B001 if exists...');
  const { employees } = (await apiCall('GET', `/employees?organizationId=${orgId}&limit=5000`, undefined, token)).data?.data || {};
  const b001 = employees?.find((e: any) => e.employeeCode === 'B001');
  if (b001) {
    await apiCall('DELETE', `/employees/${b001.id}`, undefined, token);
    console.log('   ✅ B001 deleted');
  } else {
    console.log('   ⏭️ B001 not found, skipping delete');
  }

  console.log('\n3. Create employee with ALL import fields...');
  const createPayload = {
    organizationId: orgId,
    employeeCode: 'B001',
    firstName: 'Sasikumar',
    lastName: 'V',
    email: 'sasikumar.v@bncmotors.com',
    personalEmail: 'vellaichamy.s@gmail.com',
    officialEmail: 'sasikumar.v@bncmotors.com',
    phone: '9876543210',
    dateOfBirth: '1989-06-21',
    gender: 'MALE',
    maritalStatus: 'MARRIED',
    dateOfJoining: '2024-01-15',
    workLocation: 'Coimbatore',
    placeOfTaxDeduction: 'METRO',
    departmentId: null as string | null,
    positionId: null as string | null,
    reportingManagerId: null as string | null,
    costCentreId: null as string | null,
    address: { city: 'Coimbatore', state: 'Tamil Nadu' },
    taxInformation: {
      panNumber: 'ABCDE1234F',
      aadhaarNumber: '987654321012',
    },
    bankDetails: { bankName: 'HDFC', accountNumber: '1234567890', ifscCode: 'HDFC0001234' },
    profileExtensions: { fatherName: 'Vellaichamy', bloodGroup: 'A+' },
    emergencyContacts: [{ name: 'Emergency', phone: '9876543210', relationship: 'Spouse' }],
  };

  // Resolve department "Operations" and cost centre "BNC001" if they exist
  const depts = (await apiCall('GET', `/departments?organizationId=${orgId}&limit=500`, undefined, token)).data?.data?.departments || [];
  const ops = depts.find((d: any) => d.name?.toLowerCase() === 'operations');
  if (ops) createPayload.departmentId = ops.id;

  const costCentres = (await apiCall('GET', `/cost-centres?organizationId=${orgId}`, undefined, token)).data?.data?.costCentres || [];
  const cc = costCentres.find((c: any) => (c.name || c.code || '').toLowerCase().includes('bnc001'));
  if (cc) createPayload.costCentreId = cc.id;

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

  console.log('\n4. Fetch employee and verify stored fields...');
  const { status: getStatus, data: getRes } = await apiCall('GET', `/employees/${empId}`, undefined, token);
  if (getStatus !== 200) {
    console.error('❌ Get failed:', getStatus);
    process.exit(1);
  }

  const emp = getRes?.data?.employee || getRes?.employee;
  const checks: { field: string; expected: any; actual: any; ok: boolean }[] = [
    { field: 'lastName', expected: 'V', actual: emp?.lastName, ok: emp?.lastName === 'V' },
    { field: 'personalEmail', expected: 'vellaichamy.s@gmail.com', actual: emp?.personalEmail, ok: emp?.personalEmail === 'vellaichamy.s@gmail.com' },
    { field: 'officialEmail', expected: 'sasikumar.v@bncmotors.com', actual: emp?.officialEmail, ok: emp?.officialEmail === 'sasikumar.v@bncmotors.com' },
    { field: 'workLocation', expected: 'Coimbatore', actual: emp?.workLocation, ok: emp?.workLocation === 'Coimbatore' },
    { field: 'placeOfTaxDeduction', expected: 'METRO', actual: emp?.placeOfTaxDeduction, ok: emp?.placeOfTaxDeduction === 'METRO' },
    { field: 'maritalStatus', expected: 'MARRIED', actual: emp?.maritalStatus, ok: emp?.maritalStatus === 'MARRIED' },
    { field: 'taxInformation.panNumber', expected: 'ABCDE1234F', actual: emp?.taxInformation?.panNumber, ok: emp?.taxInformation?.panNumber === 'ABCDE1234F' },
    { field: 'taxInformation.aadhaarNumber', expected: '987654321012', actual: emp?.taxInformation?.aadhaarNumber, ok: emp?.taxInformation?.aadhaarNumber === '987654321012' },
    { field: 'profileExtensions.bloodGroup', expected: 'A+', actual: emp?.profileExtensions?.bloodGroup, ok: emp?.profileExtensions?.bloodGroup === 'A+' },
    { field: 'profileExtensions.fatherName', expected: 'Vellaichamy', actual: emp?.profileExtensions?.fatherName, ok: emp?.profileExtensions?.fatherName === 'Vellaichamy' },
  ];

  if (cc) {
    checks.push({ field: 'costCentreId', expected: cc.id, actual: emp?.costCentreId, ok: emp?.costCentreId === cc.id });
  }

  let failed = 0;
  checks.forEach((c) => {
    const icon = c.ok ? '✅' : '❌';
    console.log(`   ${icon} ${c.field}: ${c.ok ? 'OK' : `expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(c.actual)}`}`);
    if (!c.ok) failed++;
  });

  console.log('\n' + (failed === 0 ? '✅ All import fields stored correctly.' : `❌ ${failed} field(s) not stored correctly.`));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
