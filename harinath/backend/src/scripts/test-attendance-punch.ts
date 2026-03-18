import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_BASE_URL = 'http://localhost:5000/api/v1';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
}

async function apiCall(method: string, endpoint: string, data?: any, token?: string) {
  try {
    const config: any = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { status: response.status, data: response.data };
  } catch (error: any) {
    // If there's a response, return it; otherwise return error details
    if (error.response) {
      return {
        status: error.response.status,
        data: error.response.data || { message: error.message },
      };
    }
    // Network error or other issues
    return {
      status: 500,
      data: { message: error.message || 'Network error' },
    };
  }
}

async function testAttendancePunch() {
  const results: TestResult[] = [];
  let employeeToken = '';
  let managerToken = '';

  try {
    console.log('🧪 Testing Attendance Punch In/Out Functionality\n');

    // 1. Login as employee (saravanan)
    console.log('1️⃣ Logging in as employee (saravanan@gmail.com)...');
    const { status: loginStatus, data: loginData } = await apiCall(
      'POST',
      '/auth/login',
      {
        email: 'saravanan@gmail.com',
        password: 'Admin@123',
      }
    );

    console.log(`   Status: ${loginStatus}`);
    console.log(`   Response: ${JSON.stringify(loginData, null, 2).substring(0, 200)}`);

    if (loginStatus === 200) {
      // Try different possible response structures
      employeeToken = loginData.data?.token || loginData.data?.tokens?.accessToken || loginData.token || loginData.tokens?.accessToken;
      
      if (employeeToken) {
        results.push({
          test: 'Employee Login',
          status: 'PASS',
          message: 'Successfully logged in as saravanan',
        });
        console.log('✅ Employee login successful');
      } else {
        results.push({
          test: 'Employee Login',
          status: 'FAIL',
          message: `Login response missing token. Response: ${JSON.stringify(loginData).substring(0, 200)}`,
        });
        console.log('❌ Employee login failed: Token not found in response');
        console.log('   Full response:', JSON.stringify(loginData, null, 2));
        return results;
      }
    } else {
      results.push({
        test: 'Employee Login',
        status: 'FAIL',
        message: `Login failed with status ${loginStatus}: ${loginData.message || JSON.stringify(loginData).substring(0, 200)}`,
      });
      console.log('❌ Employee login failed:', loginData.message || JSON.stringify(loginData));
      return results;
    }

    // 2. Check employee profile exists
    console.log('\n2️⃣ Checking employee profile...');
    const { status: meStatus, data: meData } = await apiCall('GET', '/auth/me', undefined, employeeToken);
    if (meStatus === 200 && meData.data?.employee) {
      const employeeId = meData.data.employee.id;
      console.log(`✅ Employee profile found: ${meData.data.employee.firstName} ${meData.data.employee.lastName}`);
      console.log(`   Employee ID: ${employeeId}`);
      results.push({
        test: 'Employee Profile Check',
        status: 'PASS',
        message: `Employee profile exists: ${employeeId}`,
      });
    } else {
      results.push({
        test: 'Employee Profile Check',
        status: 'FAIL',
        message: 'Employee profile not found',
      });
      console.log('❌ Employee profile not found');
      return results;
    }

    // 3. Check current attendance status
    console.log('\n3️⃣ Checking current attendance status...');
    const { status: recordsStatus, data: recordsData } = await apiCall(
      'GET',
      '/attendance/records?page=1&limit=1',
      undefined,
      employeeToken
    );
    if (recordsStatus === 200) {
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = recordsData.data?.records?.find((r: any) => r.date.startsWith(today));
      if (todayRecord) {
        console.log(`✅ Today's record found:`);
        console.log(`   Check In: ${todayRecord.checkIn || 'Not checked in'}`);
        console.log(`   Check Out: ${todayRecord.checkOut || 'Not checked out'}`);
        console.log(`   Status: ${todayRecord.status}`);
      } else {
        console.log('ℹ️  No attendance record for today yet');
      }
    }

    // 4. Test Check In
    console.log('\n4️⃣ Testing Check In...');
    const { status: checkInStatus, data: checkInData } = await apiCall(
      'POST',
      '/attendance/check-in',
      {
        notes: 'Test check-in from script',
      },
      employeeToken
    );

    if (checkInStatus === 201) {
      results.push({
        test: 'Check In',
        status: 'PASS',
        message: `Successfully checked in at ${checkInData.data?.attendance?.checkIn}`,
      });
      console.log('✅ Check in successful');
      console.log(`   Check In Time: ${checkInData.data?.attendance?.checkIn}`);
    } else if (checkInStatus === 400 && checkInData.message?.includes('already checked in')) {
      results.push({
        test: 'Check In',
        status: 'PASS',
        message: 'Already checked in (expected behavior)',
      });
      console.log('ℹ️  Already checked in today (this is expected)');
    } else {
      results.push({
        test: 'Check In',
        status: 'FAIL',
        message: `Check in failed: ${checkInData.message || 'Unknown error'}`,
      });
      console.log('❌ Check in failed:', checkInData.message);
    }

    // 5. Wait a moment before checking out
    console.log('\n5️⃣ Waiting 2 seconds before check out...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 6. Test Check Out
    console.log('\n6️⃣ Testing Check Out...');
    const { status: checkOutStatus, data: checkOutData } = await apiCall(
      'POST',
      '/attendance/check-out',
      {
        notes: 'Test check-out from script',
      },
      employeeToken
    );

    if (checkOutStatus === 200) {
      results.push({
        test: 'Check Out',
        status: 'PASS',
        message: `Successfully checked out at ${checkOutData.data?.attendance?.checkOut}`,
      });
      console.log('✅ Check out successful');
      console.log(`   Check Out Time: ${checkOutData.data?.attendance?.checkOut}`);
      console.log(`   Work Hours: ${checkOutData.data?.attendance?.workHours || 'N/A'}`);
    } else if (checkOutStatus === 400 && checkOutData.message?.includes('not checked in')) {
      results.push({
        test: 'Check Out',
        status: 'FAIL',
        message: 'Cannot check out: Not checked in',
      });
      console.log('❌ Check out failed: Not checked in');
    } else {
      results.push({
        test: 'Check Out',
        status: 'FAIL',
        message: `Check out failed: ${checkOutData.message || 'Unknown error'}`,
      });
      console.log('❌ Check out failed:', checkOutData.message);
    }

    // 7. Verify attendance record was created
    console.log('\n7️⃣ Verifying attendance record...');
    const { status: verifyStatus, data: verifyData } = await apiCall(
      'GET',
      '/attendance/records?page=1&limit=10',
      undefined,
      employeeToken
    );
    if (verifyStatus === 200 && verifyData.data?.records?.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = verifyData.data.records.find((r: any) => r.date.startsWith(today));
      if (todayRecord) {
        console.log('✅ Attendance record verified:');
        console.log(`   Date: ${todayRecord.date}`);
        console.log(`   Check In: ${todayRecord.checkIn || 'N/A'}`);
        console.log(`   Check Out: ${todayRecord.checkOut || 'N/A'}`);
        console.log(`   Status: ${todayRecord.status}`);
        console.log(`   Work Hours: ${todayRecord.workHours || 'N/A'}`);
        results.push({
          test: 'Attendance Record Verification',
          status: 'PASS',
          message: 'Attendance record exists and is correct',
        });
      } else {
        results.push({
          test: 'Attendance Record Verification',
          status: 'FAIL',
          message: 'Today\'s attendance record not found',
        });
        console.log('❌ Today\'s attendance record not found');
      }
    }

    // 8. Test Manager can see employee attendance
    console.log('\n8️⃣ Testing Manager can see employee attendance...');
    const { status: managerLoginStatus, data: managerLoginData } = await apiCall(
      'POST',
      '/auth/login',
      {
        email: 'jayaganesh@gmail.com',
        password: 'Admin@123',
      }
    );

    if (managerLoginStatus === 200 && (managerLoginData.data?.token || managerLoginData.token)) {
      managerToken = managerLoginData.data?.token || managerLoginData.token;
      console.log('✅ Manager login successful');

      // Get manager's employee record
      const { status: managerMeStatus, data: managerMeData } = await apiCall(
        'GET',
        '/auth/me',
        undefined,
        managerToken
      );

      if (managerMeStatus === 200 && managerMeData.data?.employee) {
        const managerEmployeeId = managerMeData.data.employee.id;
        console.log(`   Manager Employee ID: ${managerEmployeeId}`);

        // Get team attendance
        const { status: teamRecordsStatus, data: teamRecordsData } = await apiCall(
          'GET',
          '/attendance/records?page=1&limit=50',
          undefined,
          managerToken
        );

        if (teamRecordsStatus === 200) {
          const records = teamRecordsData.data?.records || [];
          const saravananRecord = records.find((r: any) =>
            r.employee?.firstName?.toLowerCase().includes('saravanan') ||
            r.employee?.email?.includes('saravanan')
          );

          if (saravananRecord) {
            results.push({
              test: 'Manager View Team Attendance',
              status: 'PASS',
              message: `Manager can see saravanan's attendance (${records.length} total records)`,
            });
            console.log('✅ Manager can see team attendance');
            console.log(`   Found ${records.length} team attendance records`);
            console.log(`   Saravanan's record: ${saravananRecord.date} - ${saravananRecord.status}`);
          } else {
            results.push({
              test: 'Manager View Team Attendance',
              status: 'FAIL',
              message: 'Manager cannot see saravanan\'s attendance',
            });
            console.log('❌ Manager cannot see saravanan\'s attendance');
            console.log(`   Found ${records.length} records, but saravanan not in list`);
          }
        } else {
          results.push({
            test: 'Manager View Team Attendance',
            status: 'FAIL',
            message: `Failed to fetch team records: ${teamRecordsData.message}`,
          });
          console.log('❌ Failed to fetch team records:', teamRecordsData.message);
        }
      }
    } else {
      results.push({
        test: 'Manager View Team Attendance',
        status: 'FAIL',
        message: `Manager login failed: ${managerLoginData.message}`,
      });
      console.log('❌ Manager login failed:', managerLoginData.message);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📝 Total: ${results.length}`);
    console.log('\nDetailed Results:');
    results.forEach((result, index) => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${index + 1}. ${icon} ${result.test}: ${result.message}`);
    });
  } catch (error: any) {
    console.error('❌ Test error:', error.message);
    results.push({
      test: 'Test Execution',
      status: 'FAIL',
      message: `Test execution failed: ${error.message}`,
    });
  } finally {
    await prisma.$disconnect();
  }

  return results;
}

// Run the test
testAttendancePunch()
  .then((results) => {
    const failed = results.filter((r) => r.status === 'FAIL');
    process.exit(failed.length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
