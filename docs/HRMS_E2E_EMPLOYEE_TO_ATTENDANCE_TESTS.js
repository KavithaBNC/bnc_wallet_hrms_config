/**
 * ============================================================================
 * HRMS End-to-End Workflow Test Cases
 * Employee Creation → Shift Assignment → Leave Config → Attendance Verification
 * ============================================================================
 *
 * Source Reference : docs/HRMS_FRONTEND_FLOW_TEST_CASES.md
 * Organization     : Infosys
 * Flow             : New Employee → Edit/Validate → Shift Assign → Leave Setup
 *                    → Attendance Tracking → Full Verification
 *
 * Test Cases       : 5 Positive + 5 Negative = 10 Total
 *
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// TEST CONFIGURATION
// ---------------------------------------------------------------------------

const CONFIG = {
  organization: 'Infosys',
  baseUrl: '/api/v1',
  routes: {
    login: '/login',
    dashboard: '/dashboard',
    employees: '/employees',
    employeeCreate: '/employees/create',
    employeeEdit: '/employees/edit/:id',
    employeeImport: '/employees/import',
    shiftMaster: '/time-attendance/shift-master',
    shiftMasterCreate: '/time-attendance/shift-master/create',
    shiftAssign: '/time-attendance/shift-assign',
    shiftAssignCreate: '/time-attendance/shift-assign/create',
    attendanceComponents: '/event-configuration/attendance-components',
    leaveType: '/event/leave-type',
    leaveTypeCreate: '/event/leave-type/create',
    rightsAllocation: '/event-configuration/rights-allocation',
    approvalWorkflow: '/event-configuration/approval-workflow',
    workflowMapping: '/event-configuration/workflow-mapping',
    attendance: '/attendance',
    applyEvent: '/event/apply-event',
    eventApprovals: '/event/approvals',
  },
  api: {
    employees: '/api/v1/employees',
    shifts: '/api/v1/shifts',
    shiftAssignmentRules: '/api/v1/shift-assignment-rules',
    attendanceComponents: '/api/v1/attendance-components',
    leaveTypes: '/api/v1/leaves/types',
    leaveRequests: '/api/v1/leaves/requests',
    leaveHrAssign: '/api/v1/leaves/hr-assign',
    attendanceRecords: '/api/v1/attendance/records',
    attendancePunches: '/api/v1/attendance/punches',
    attendanceCheckIn: '/api/v1/attendance/check-in',
    attendanceCheckOut: '/api/v1/attendance/check-out',
  },
};

const USERS = {
  hrAdmin: {
    name: 'Chitra Rajan',
    role: 'HR_MANAGER',
    email: 'chitra.rajan199@testmail.com',
    password: 'anoOw0#HL!',
  },
  manager: {
    name: 'Murugan Babu',
    role: 'MANAGER',
    email: 'murugan.babu198@testmail.com',
    password: '#zhzY!cmQ%',
  },
};

const NEW_EMPLOYEE = {
  firstName: 'Deepak',
  lastName: 'Venkatesh',
  gender: 'MALE',
  dateOfBirth: '1994-08-22',
  dateOfJoining: '2026-04-01',
  department: 'Engineering',
  designation: 'Software Developer',
  subDepartment: 'Backend',
  costCentre: 'CC-ENG-001',
  placeOfTaxDeduction: 'METRO',
  reportingManager: 'Murugan Babu',
  userRole: 'Employee',
  paygroup: 'Monthly',
  email: 'deepak.venkatesh401@testmail.com',
  phone: '9845012345',
};

const SHIFT = {
  name: 'General Shift',
  code: 'GS',
  startTime: '09:00',
  endTime: '18:00',
  firstHalfEnd: '13:00',
  secondHalfStart: '14:00',
  breakDuration: 60,
  workHours: 8,
  gracePeriod: 15,
  overtimeEnabled: false,
};

const LEAVE_TYPES = {
  EL: { name: 'Earned Leave', code: 'EL', daysPerYear: 18, isPaid: true, maxCarryForward: 15, accrualType: 'MONTHLY' },
  SL: { name: 'Sick Leave', code: 'SL', daysPerYear: 12, isPaid: true, maxCarryForward: 0, accrualType: 'MONTHLY' },
};

// ---------------------------------------------------------------------------
// POSITIVE TEST CASES (5)
// ---------------------------------------------------------------------------

const POSITIVE_TESTS = [
  {
    id: 'POS-1',
    title: 'Full Employee Creation and Login Verification',
    description:
      'HR Admin logs in, creates a new employee with all required fields, ' +
      'verifies the employee appears in the list with correct data, and confirms ' +
      'the new employee can log in with the generated temporary password.',
    flow: 'Login → Employee Create → Verify in List → New Employee Login',
    actingUser: USERS.hrAdmin,
    targetEmployee: NEW_EMPLOYEE,
    steps: [
      {
        seq: 1,
        action: 'HR Admin Login',
        page: CONFIG.routes.login,
        input: {
          companyName: CONFIG.organization,
          email: USERS.hrAdmin.email,
          password: USERS.hrAdmin.password,
        },
        expectedResult: 'Login succeeds. Redirected to /dashboard. Sidebar shows Employees module.',
        apiCall: 'POST /api/v1/auth/login',
        validate: [
          'localStorage contains accessToken, refreshToken, configuratorAccessToken, configuratorRefreshToken',
          'localStorage contains user object with role HR_MANAGER',
          'Sidebar shows Employees, Event Configuration, Time Attendance modules',
        ],
      },
      {
        seq: 2,
        action: 'Navigate to Employees and Click Create',
        page: CONFIG.routes.employees,
        input: null,
        expectedResult: '"Create Employee" button is visible and clickable for HR Admin.',
        apiCall: null,
        validate: [
          'getModulePermissions("/employees").can_add is true',
          '"Create Employee" button is rendered in the DOM',
          '"Import" button is also visible',
        ],
      },
      {
        seq: 3,
        action: 'Select Paygroup in Modal',
        page: CONFIG.routes.employeeCreate,
        input: { paygroup: NEW_EMPLOYEE.paygroup },
        expectedResult: 'PaygroupSelectionModal appears. "Monthly" paygroup is selected. Modal closes. Employee form loads.',
        apiCall: null,
        validate: [
          'Modal is displayed before the form',
          'Paygroup dropdown contains "Monthly"',
          'After selection, EmployeeForm component renders with 11 tabs',
        ],
      },
      {
        seq: 4,
        action: 'Fill Company Details Tab and Personal Tab',
        page: CONFIG.routes.employeeCreate,
        input: {
          companyTab: {
            firstName: NEW_EMPLOYEE.firstName,
            lastName: NEW_EMPLOYEE.lastName,
            gender: NEW_EMPLOYEE.gender,
            dateOfBirth: NEW_EMPLOYEE.dateOfBirth,
            dateOfJoining: NEW_EMPLOYEE.dateOfJoining,
            department: NEW_EMPLOYEE.department,
            designation: NEW_EMPLOYEE.designation,
            reportingManager: NEW_EMPLOYEE.reportingManager,
            placeOfTaxDeduction: NEW_EMPLOYEE.placeOfTaxDeduction,
          },
          personalTab: {
            email: NEW_EMPLOYEE.email,
            phone: NEW_EMPLOYEE.phone,
          },
        },
        expectedResult: 'All required fields pass Zod validation. No inline errors shown.',
        apiCall: null,
        validate: [
          'First Name field accepts "Deepak" (min 2 chars satisfied)',
          'Department "Engineering" found in Configurator dropdown',
          'Reporting Manager "Murugan Babu" found in searchable dropdown',
          'Email passes email format validation',
          'Phone field is populated',
        ],
      },
      {
        seq: 5,
        action: 'Submit Employee Form',
        page: CONFIG.routes.employeeCreate,
        input: { clickSave: true },
        expectedResult: 'Employee created. Temporary password displayed. Redirected to employee list. Deepak appears in the list.',
        apiCall: 'POST /api/v1/employees',
        validate: [
          'Response contains employee object with id, employeeCode, firstName "Deepak"',
          'Response contains temporaryPassword (non-empty string)',
          'Employee list at /employees now includes "Deepak Venkatesh"',
          'Employee status is ACTIVE',
          'Configurator user account created (configuratorUserId returned)',
        ],
      },
      {
        seq: 6,
        action: 'New Employee Logs In',
        page: CONFIG.routes.login,
        input: {
          companyName: CONFIG.organization,
          email: NEW_EMPLOYEE.email,
          password: '<<temporaryPassword from step 5>>',
        },
        expectedResult: 'Deepak logs in successfully. Sidebar shows Employee-level modules only: Dashboard, Profile, Attendance, Leave/Apply Event.',
        apiCall: 'POST /api/v1/auth/login',
        validate: [
          'Login succeeds with temporary password',
          'User role normalized to EMPLOYEE',
          'Sidebar does NOT show Employees list, Departments, or any admin modules',
          'Dashboard shows personal widgets (own attendance, leave balance)',
        ],
      },
    ],
  },

  {
    id: 'POS-2',
    title: 'Shift Creation and Assignment to New Employee',
    description:
      'HR Admin creates a General Shift with 9AM-6PM timings, 15-minute grace period, ' +
      'then assigns this shift to the newly created employee Deepak. After assignment, ' +
      'verifies the shift appears on Deepak\'s attendance configuration.',
    flow: 'Login → Create Shift → Assign Shift → Verify Assignment',
    actingUser: USERS.hrAdmin,
    targetEmployee: NEW_EMPLOYEE,
    steps: [
      {
        seq: 1,
        action: 'HR Admin Navigates to Shift Master',
        page: CONFIG.routes.shiftMaster,
        input: null,
        expectedResult: 'Shift Master page loads. "Create Shift" button visible for HR Admin.',
        apiCall: 'GET /api/v1/shifts',
        validate: [
          'Page renders ShiftMasterPage component',
          'getModulePermissions("/time-attendance/shift-master").can_add is true',
          'Existing shifts listed in table (if any)',
        ],
      },
      {
        seq: 2,
        action: 'Create General Shift',
        page: CONFIG.routes.shiftMasterCreate,
        input: {
          shiftName: SHIFT.name,
          shiftCode: SHIFT.code,
          startTime: SHIFT.startTime,
          endTime: SHIFT.endTime,
          firstHalfEnd: SHIFT.firstHalfEnd,
          secondHalfStart: SHIFT.secondHalfStart,
          breakDuration: SHIFT.breakDuration,
          workHours: SHIFT.workHours,
          gracePeriod: SHIFT.gracePeriod,
          overtimeEnabled: SHIFT.overtimeEnabled,
        },
        expectedResult: 'Shift created successfully. "General Shift" appears in shift master list.',
        apiCall: 'POST /api/v1/shifts',
        validate: [
          'Response contains shift object with id, name "General Shift", code "GS"',
          'startTime is "09:00", endTime is "18:00"',
          'gracePeriod is 15 minutes',
          'Shift appears in the shift master list table',
        ],
      },
      {
        seq: 3,
        action: 'Navigate to Shift Assign and Create Assignment',
        page: CONFIG.routes.shiftAssignCreate,
        input: {
          shift: SHIFT.name,
          employees: [NEW_EMPLOYEE.firstName + ' ' + NEW_EMPLOYEE.lastName],
          effectiveDate: NEW_EMPLOYEE.dateOfJoining,
          priority: 1,
        },
        expectedResult: 'Shift assignment rule created. Deepak assigned to General Shift from April 1.',
        apiCall: 'POST /api/v1/shift-assignment-rules',
        validate: [
          'Assignment rule created with shiftId matching "General Shift"',
          'employeeIds array includes Deepak\'s employee ID',
          'effectiveDate is "2026-04-01"',
          'Priority is 1',
        ],
      },
      {
        seq: 4,
        action: 'Verify Shift on Deepak\'s Attendance Page',
        page: CONFIG.routes.attendance,
        input: { selectedEmployee: NEW_EMPLOYEE.firstName },
        expectedResult: 'Deepak\'s attendance calendar loads. Shift info shows "General Shift" with 9AM-6PM.',
        apiCall: 'GET /api/v1/attendance/records',
        validate: [
          'Calendar renders for Deepak',
          'Shift reference on attendance records shows "General Shift"',
          'Shift startTime 09:00 and endTime 18:00 are used for late/early calculations',
        ],
      },
    ],
  },

  {
    id: 'POS-3',
    title: 'Leave Type and Balance Configuration for New Employee',
    description:
      'HR Admin creates EL and SL leave types (if not already existing), allocates ' +
      '18 EL days and 12 SL days to Deepak through rights allocation, configures the ' +
      'approval workflow mapping for Engineering department, and verifies Deepak\'s ' +
      'leave balance shows correctly on his dashboard.',
    flow: 'Create Leave Types → Allocate Balance → Configure Workflow → Verify Balance',
    actingUser: USERS.hrAdmin,
    targetEmployee: NEW_EMPLOYEE,
    steps: [
      {
        seq: 1,
        action: 'Create EL Attendance Component and Leave Type',
        page: CONFIG.routes.leaveTypeCreate,
        input: {
          name: LEAVE_TYPES.EL.name,
          code: LEAVE_TYPES.EL.code,
          defaultDaysPerYear: LEAVE_TYPES.EL.daysPerYear,
          isPaid: LEAVE_TYPES.EL.isPaid,
          maxCarryForward: LEAVE_TYPES.EL.maxCarryForward,
          accrualType: LEAVE_TYPES.EL.accrualType,
          requiresApproval: true,
          canBeNegative: false,
        },
        expectedResult: 'EL leave type created with 18 days/year, monthly accrual, 15-day carry forward.',
        apiCall: 'POST /api/v1/leaves/types',
        validate: [
          'Response contains leaveType with code "EL"',
          'defaultDaysPerYear is 18',
          'maxCarryForward is 15',
          'accrualType is "MONTHLY" (accrues 1.5 days/month)',
        ],
      },
      {
        seq: 2,
        action: 'Create SL Leave Type',
        page: CONFIG.routes.leaveTypeCreate,
        input: {
          name: LEAVE_TYPES.SL.name,
          code: LEAVE_TYPES.SL.code,
          defaultDaysPerYear: LEAVE_TYPES.SL.daysPerYear,
          isPaid: LEAVE_TYPES.SL.isPaid,
          maxCarryForward: LEAVE_TYPES.SL.maxCarryForward,
          accrualType: LEAVE_TYPES.SL.accrualType,
          requiresApproval: true,
          canBeNegative: false,
        },
        expectedResult: 'SL leave type created with 12 days/year, monthly accrual, zero carry forward.',
        apiCall: 'POST /api/v1/leaves/types',
        validate: [
          'Response contains leaveType with code "SL"',
          'defaultDaysPerYear is 12',
          'maxCarryForward is 0',
        ],
      },
      {
        seq: 3,
        action: 'Allocate EL and SL Balance to Deepak via Rights Allocation',
        page: CONFIG.routes.rightsAllocation,
        input: {
          paygroup: NEW_EMPLOYEE.paygroup,
          leaveAllocations: [
            { leaveType: 'EL', openingBalance: 18, year: 2026 },
            { leaveType: 'SL', openingBalance: 12, year: 2026 },
          ],
        },
        expectedResult: 'EmployeeLeaveBalance records created for Deepak. EL: 18, SL: 12 opening balance for 2026.',
        apiCall: 'POST /api/v1/leaves/balance-entry (or rights allocation endpoint)',
        validate: [
          'Deepak\'s leave balance for EL shows openingBalance: 18, available: 18',
          'Deepak\'s leave balance for SL shows openingBalance: 12, available: 12',
        ],
      },
      {
        seq: 4,
        action: 'Configure Approval Workflow Mapping for Engineering Department',
        page: CONFIG.routes.workflowMapping,
        input: {
          workflowType: 'Leave Approval',
          department: NEW_EMPLOYEE.department,
          approvalLevels: [
            { level: 1, approverRole: 'REPORTING_MANAGER' },
          ],
          priority: 1,
        },
        expectedResult: 'Workflow mapping created. Leave requests from Engineering route to reporting manager.',
        apiCall: 'POST /api/v1/workflow-mappings',
        validate: [
          'Mapping links to Engineering department',
          'Level 1 approver is reporting manager (Murugan for Deepak)',
        ],
      },
      {
        seq: 5,
        action: 'Verify Deepak\'s Leave Balance on His Dashboard',
        page: CONFIG.routes.dashboard,
        input: { loginAs: NEW_EMPLOYEE },
        expectedResult: 'Deepak\'s dashboard shows leave balance widget: EL: 18 available, SL: 12 available.',
        apiCall: 'GET /api/v1/leaves/balance/:employeeId',
        validate: [
          'LeaveDetails widget on dashboard renders',
          'EL balance shows 18 days available',
          'SL balance shows 12 days available',
          'Used count is 0 for both',
        ],
      },
    ],
  },

  {
    id: 'POS-4',
    title: 'Employee Leave Apply, Manager Approval, and Attendance Calendar Update',
    description:
      'Deepak (Employee) applies for 2 days of Earned Leave. The request goes to PENDING ' +
      'and routes to Murugan (Manager). Murugan approves the request. Deepak\'s EL balance ' +
      'is deducted by 2, and his attendance calendar shows approved EL on those dates.',
    flow: 'Employee Apply Leave → PENDING → Manager Approve → Balance Deducted → Calendar Updated',
    actingUser: NEW_EMPLOYEE,
    approver: USERS.manager,
    steps: [
      {
        seq: 1,
        action: 'Deepak Opens Attendance and Clicks Apply Leave',
        page: CONFIG.routes.attendance,
        input: null,
        expectedResult: 'Attendance page loads with Deepak\'s calendar. "Apply Leave" button is visible.',
        apiCall: 'GET /api/v1/attendance/records',
        validate: [
          'Calendar renders for current month',
          '"Apply Leave", "Apply Permission", "Apply On Duty" buttons visible',
          'MonthlyDetailsSidebar shows monthly summary',
        ],
      },
      {
        seq: 2,
        action: 'Fill and Submit Leave Application',
        page: CONFIG.routes.applyEvent,
        input: {
          type: 'Earned Leave',
          fromDate: '2026-04-14',
          toDate: '2026-04-15',
          duration: 'FULL_DAY',
          reason: 'Personal family event and required travel arrangements',
        },
        expectedResult: 'Leave balance hint shows EL: 18 available. After submit, request created as PENDING. Redirected to /attendance with success banner.',
        apiCall: 'POST /api/v1/leaves/requests',
        validate: [
          'Balance hint displays before submit: openingBalance: 18, used: 0, available: 18',
          'Request payload: leaveTypeId (EL), startDate "2026-04-14", endDate "2026-04-15"',
          'Response status: PENDING, totalDays: 2',
          'assignedApproverEmployeeId matches Murugan\'s employee ID',
          'currentApprovalLevel is 1',
          'Redirect to /attendance with state { leaveApplied: true }',
          'Green success banner: "Leave applied successfully!"',
          'Calendar shows pending indicators on April 14 and 15',
        ],
      },
      {
        seq: 3,
        action: 'Murugan Logs In and Opens Approval Page',
        page: CONFIG.routes.eventApprovals,
        input: { loginAs: USERS.manager },
        expectedResult: 'Leave Approval page loads. Deepak\'s pending EL request for 2 days is visible.',
        apiCall: 'GET /api/v1/leaves/requests?status=PENDING',
        validate: [
          'LeaveApprovalPage renders with status filter defaulting to PENDING',
          'Table shows row: Associate "Deepak Venkatesh", Leave Type "Earned Leave", Days "2", Date "Apr 14-15"',
          'Approve and Reject action buttons visible on the row',
        ],
      },
      {
        seq: 4,
        action: 'Murugan Approves the Leave Request',
        page: CONFIG.routes.eventApprovals,
        input: {
          action: 'APPROVE',
          remarks: 'Approved. Enjoy your time off.',
        },
        expectedResult: 'Request status changes to APPROVED. Deepak\'s EL balance deducted from 18 to 16.',
        apiCall: 'PUT /api/v1/leaves/requests/:id/approve',
        validate: [
          'Response status is APPROVED',
          'approvalHistory JSON contains Murugan\'s employeeId, timestamp, remarks',
          'Request disappears from PENDING filter view',
          'Deepak\'s EL balance: openingBalance 18, used 2, available 16',
        ],
      },
      {
        seq: 5,
        action: 'Verify Deepak\'s Attendance Calendar Shows Approved Leave',
        page: CONFIG.routes.attendance,
        input: { loginAs: NEW_EMPLOYEE, month: '2026-04' },
        expectedResult: 'April 14 and 15 show "EL" badges with approved color. MonthlyDetailsSidebar shows Leave Days: 2 (EL: 2).',
        apiCall: 'GET /api/v1/attendance/records + GET /api/v1/attendance/monthly-details',
        validate: [
          'Calendar cell for April 14 shows "EL" badge (approved, green)',
          'Calendar cell for April 15 shows "EL" badge (approved, green)',
          'No check-in/check-out data on those cells (leave day)',
          'MonthlyDetailsSidebar: Leave Days includes EL: 2',
          'Leave balance widget updated: EL available 16',
        ],
      },
    ],
  },

  {
    id: 'POS-5',
    title: 'Full Attendance Day Verification — Check-In, Check-Out, and Summary',
    description:
      'Deepak checks in at 09:05 AM (within grace period) and checks out at 18:10 PM. ' +
      'The attendance record shows on-time arrival, correct work hours (8h 5m after break), ' +
      'and overtime of 10 minutes. The monthly summary updates correctly. HR Admin verifies ' +
      'the same data by viewing Deepak\'s attendance from the admin view.',
    flow: 'Check-In → Check-Out → Calendar Verify → Summary Verify → HR Admin Cross-Verify',
    actingUser: NEW_EMPLOYEE,
    verifier: USERS.hrAdmin,
    steps: [
      {
        seq: 1,
        action: 'Deepak Checks In at 09:05 AM',
        page: CONFIG.routes.attendance,
        input: { punchType: 'CHECK_IN', punchTime: '2026-04-07T09:05:00' },
        expectedResult: 'Check-in recorded. Since 09:05 is within the 15-minute grace period (shift starts 09:00), arrival is marked ON TIME.',
        apiCall: 'POST /api/v1/attendance/check-in',
        validate: [
          'AttendancePunch created with status "IN", punchTime 09:05',
          'AttendanceRecord for April 7 created with checkIn "09:05"',
          'isLate is false (09:05 <= 09:15 grace cutoff)',
          'lateMinutes is 0',
          'Calendar cell shows check-in "9:05 AM" in GREEN (on time)',
        ],
      },
      {
        seq: 2,
        action: 'Deepak Checks Out at 06:10 PM',
        page: CONFIG.routes.attendance,
        input: { punchType: 'CHECK_OUT', punchTime: '2026-04-07T18:10:00' },
        expectedResult: 'Check-out recorded at 18:10. Work hours calculated as ~8h 5m (after 1h break). OT: 10 minutes.',
        apiCall: 'POST /api/v1/attendance/check-out',
        validate: [
          'AttendancePunch created with status "OUT", punchTime 18:10',
          'AttendanceRecord updated: checkOut "18:10"',
          'totalHours calculated (09:05 to 18:10 = 9h 5m)',
          'breakHours is 1 (from shift config)',
          'workHours is approximately 8h 5m (totalHours - breakHours)',
          'overtimeHours > 0 (worked beyond 8h shift)',
          'isEarly is false (18:10 is after 18:00 shift end)',
          'Calendar cell shows check-out "6:10 PM" in GREEN',
        ],
      },
      {
        seq: 3,
        action: 'Verify Daily Attendance on Calendar',
        page: CONFIG.routes.attendance,
        input: { viewDate: '2026-04-07' },
        expectedResult: 'April 7 cell shows: check-in 9:05 AM (green), check-out 6:10 PM (green), work hours ~8h 5m, OT 10m. Status: PRESENT.',
        apiCall: null,
        validate: [
          'Check-in time displayed in green (on time)',
          'Check-out time displayed in green (not early)',
          'Work hours value shown',
          'OT minutes shown',
          'No late/early deviation indicators',
          'Status is PRESENT',
        ],
      },
      {
        seq: 4,
        action: 'Verify Monthly Summary Sidebar',
        page: CONFIG.routes.attendance,
        input: { month: '2026-04' },
        expectedResult: 'MonthlyDetailsSidebar reflects: Present Days includes April 7. OT hours include 10m. Leave Days includes EL: 2 from POS-4.',
        apiCall: 'GET /api/v1/attendance/monthly-details',
        validate: [
          'Present Days count incremented to include April 7',
          'Overtime Hours includes contribution from April 7',
          'Leave Days still shows EL: 2 (from POS-4 test)',
          'Paid Days = Present + Leave + Holidays',
          'Total Working Days calculated correctly',
        ],
      },
      {
        seq: 5,
        action: 'HR Admin Cross-Verifies Deepak\'s Attendance',
        page: CONFIG.routes.attendance,
        input: { loginAs: USERS.hrAdmin, selectedEmployee: NEW_EMPLOYEE.firstName },
        expectedResult: 'Chitra selects Deepak from the full employee selector. Same attendance data visible: April 7 present, April 14-15 EL.',
        apiCall: 'GET /api/v1/attendance/records?employeeId=<deepakId>',
        validate: [
          'Employee selector shows ALL Infosys employees (HR Admin scope)',
          'Selecting "Deepak Venkatesh" loads his calendar',
          'April 7 shows check-in 9:05 AM, check-out 6:10 PM, present',
          'April 14 shows EL badge (approved)',
          'April 15 shows EL badge (approved)',
          '"Apply Event on behalf" option is available for Deepak',
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// NEGATIVE TEST CASES (5)
// ---------------------------------------------------------------------------

const NEGATIVE_TESTS = [
  {
    id: 'NEG-1',
    title: 'Employee Creation Fails — Missing Required Fields and Duplicate Email',
    description:
      'HR Admin attempts to create an employee with missing required fields (no first name, ' +
      'no department, no DOJ). Validation errors appear. Then attempts to create with a ' +
      'duplicate email that already exists. Both attempts are blocked. No employee is created.',
    flow: 'Login → Create with Missing Fields (FAIL) → Create with Duplicate Email (FAIL)',
    actingUser: USERS.hrAdmin,
    steps: [
      {
        seq: 1,
        action: 'Submit Employee Form with All Required Fields Empty',
        page: CONFIG.routes.employeeCreate,
        input: {
          companyTab: {
            firstName: '',
            lastName: '',
            gender: null,
            dateOfBirth: null,
            dateOfJoining: null,
            department: null,
            designation: null,
            placeOfTaxDeduction: null,
          },
          personalTab: {
            email: '',
            phone: '',
          },
        },
        expectedResult: 'Zod validation fails. Inline errors appear for every required field. Form does NOT submit. No API call made.',
        apiCall: 'NONE — blocked by frontend validation',
        validate: [
          'First Name error: "required, min 2 chars"',
          'Gender error: "required"',
          'Date of Birth error: "required"',
          'Date of Joining error: "required"',
          'Department error: "required"',
          'Designation error: "required"',
          'Place of Tax Deduction error: "required"',
          'Email error: "required" (on Personal tab)',
          'Phone error: "required" (on Personal tab)',
          'POST /api/v1/employees is NOT called',
        ],
      },
      {
        seq: 2,
        action: 'Submit with First Name Too Short (1 Character)',
        page: CONFIG.routes.employeeCreate,
        input: {
          companyTab: {
            firstName: 'A',
            gender: 'MALE',
            dateOfBirth: '1990-01-01',
            dateOfJoining: '2026-04-01',
            department: 'Engineering',
            designation: 'Developer',
            placeOfTaxDeduction: 'METRO',
          },
          personalTab: {
            email: 'valid@testmail.com',
            phone: '9876543210',
          },
        },
        expectedResult: 'Validation error on First Name: "Minimum 2 characters required." Form does NOT submit.',
        apiCall: 'NONE — blocked by frontend validation',
        validate: [
          'First Name field shows error: min 2 characters',
          'All other fields pass validation',
          'Form submission is prevented',
        ],
      },
      {
        seq: 3,
        action: 'Submit with Invalid Email Format',
        page: CONFIG.routes.employeeCreate,
        input: {
          companyTab: {
            firstName: 'Test',
            gender: 'MALE',
            dateOfBirth: '1990-01-01',
            dateOfJoining: '2026-04-01',
            department: 'Engineering',
            designation: 'Developer',
            placeOfTaxDeduction: 'METRO',
          },
          personalTab: {
            email: 'not-an-email',
            phone: '9876543210',
          },
        },
        expectedResult: 'Validation error on Email: "Must be a valid email format." Form does NOT submit.',
        apiCall: 'NONE — blocked by frontend validation',
        validate: [
          'Email field shows format validation error',
          'Form submission is prevented',
        ],
      },
      {
        seq: 4,
        action: 'Submit with Duplicate Email (Already Exists in System)',
        page: CONFIG.routes.employeeCreate,
        input: {
          companyTab: {
            firstName: 'Duplicate',
            lastName: 'User',
            gender: 'FEMALE',
            dateOfBirth: '1992-05-10',
            dateOfJoining: '2026-04-01',
            department: 'Engineering',
            designation: 'Developer',
            placeOfTaxDeduction: 'METRO',
          },
          personalTab: {
            email: NEW_EMPLOYEE.email,
            phone: '9876500000',
          },
        },
        expectedResult: 'Frontend validation passes. POST sent to backend. Backend returns error "Email already exists." Red error banner shown. Employee NOT created.',
        apiCall: 'POST /api/v1/employees → 400/409 error',
        validate: [
          'API call is made (frontend validation passes)',
          'Backend returns error response with message about duplicate email',
          'Error banner displayed at the top of the form',
          'No temporary password displayed',
          'Employee list does NOT show "Duplicate User"',
        ],
      },
    ],
  },

  {
    id: 'NEG-2',
    title: 'Unauthorized Roles Cannot Create Employees or Access Admin Pages',
    description:
      'Manager (Murugan) and Employee (Ambika equivalent — Deepak) attempt to access ' +
      'employee creation, shift master, and event configuration pages. All attempts are ' +
      'blocked by RBAC. Create/Import buttons are hidden. Direct URL access is redirected.',
    flow: 'Manager Login → No Create Button → Employee Login → No Admin Access',
    actingUser: USERS.manager,
    steps: [
      {
        seq: 1,
        action: 'Manager Views Employee Page — No Create Button',
        page: CONFIG.routes.employees,
        input: { loginAs: USERS.manager },
        expectedResult: '"Create Employee" button is NOT visible. "Import" button is NOT visible. "Delete" action is NOT visible on any row.',
        apiCall: null,
        validate: [
          'getModulePermissions("/employees").can_add is false for MANAGER',
          '"Create Employee" button is not rendered in DOM',
          '"Import" button is not rendered',
          'Employee rows show view-only actions (no edit/delete for most)',
          'Only team members are visible in the list',
        ],
      },
      {
        seq: 2,
        action: 'Manager Tries Direct URL to /employees/create',
        page: CONFIG.routes.employeeCreate,
        input: { directUrlNavigation: true },
        expectedResult: 'Manager is redirected to /dashboard. The create form does NOT load.',
        apiCall: null,
        validate: [
          'DashboardLayout detects path "/employees/create" is not in allowed modules',
          'User is redirected to /dashboard',
          'EmployeeFormPage does not render',
        ],
      },
      {
        seq: 3,
        action: 'Manager Tries Direct URL to Shift Master',
        page: CONFIG.routes.shiftMaster,
        input: { directUrlNavigation: true },
        expectedResult: 'Manager is redirected to /dashboard. Shift Master page is not accessible.',
        apiCall: null,
        validate: [
          'Shift Master is not in MANAGER sidebar modules',
          'Path access check fails',
          'Redirect to /dashboard',
        ],
      },
      {
        seq: 4,
        action: 'Employee Tries Direct URL to Event Configuration',
        page: CONFIG.routes.attendanceComponents,
        input: { loginAs: NEW_EMPLOYEE, directUrlNavigation: true },
        expectedResult: 'Employee is redirected to /dashboard. No admin configuration pages are accessible.',
        apiCall: null,
        validate: [
          'Event Configuration not in EMPLOYEE sidebar modules',
          'Path access check fails',
          'Redirect to /dashboard',
          'Employee sidebar shows only: Dashboard, Profile, Attendance, Leave/Apply Event',
        ],
      },
      {
        seq: 5,
        action: 'Employee Tries Direct URL to Leave Approval Page',
        page: CONFIG.routes.eventApprovals,
        input: { loginAs: NEW_EMPLOYEE, directUrlNavigation: true },
        expectedResult: 'Employee is redirected to /dashboard. Approval page is not accessible to Employee role.',
        apiCall: null,
        validate: [
          'getModulePermissions("/event/approvals").can_view is false for EMPLOYEE',
          'LeaveApprovalPage useEffect detects !canApprove and calls navigate("/dashboard", { replace: true })',
          'Employee never sees the approval table',
        ],
      },
    ],
  },

  {
    id: 'NEG-3',
    title: 'Leave Application Fails — Validation Errors and Insufficient Balance',
    description:
      'Deepak (Employee) attempts to apply leave with various invalid inputs: missing dates, ' +
      'end date before start date, reason too short, and requesting more days than available ' +
      'balance. All attempts fail with appropriate error messages.',
    flow: 'Apply with Missing Date (FAIL) → End < Start (FAIL) → Short Reason (FAIL) → Exceed Balance (FAIL)',
    actingUser: NEW_EMPLOYEE,
    steps: [
      {
        seq: 1,
        action: 'Submit Leave Without Selecting Leave Type',
        page: CONFIG.routes.applyEvent,
        input: {
          type: null,
          fromDate: '2026-04-20',
          toDate: '2026-04-21',
          reason: 'Valid reason text here',
        },
        expectedResult: 'Validation error: "Please select a leave type." Form does NOT submit.',
        apiCall: 'NONE — blocked by frontend validation',
        validate: [
          'canSubmit computed property is false (selectedComponentId is empty)',
          'No API call made',
        ],
      },
      {
        seq: 2,
        action: 'Submit Leave with End Date Before Start Date',
        page: CONFIG.routes.applyEvent,
        input: {
          type: 'Earned Leave',
          fromDate: '2026-04-25',
          toDate: '2026-04-22',
          reason: 'Valid reason text for the request',
        },
        expectedResult: 'Validation error: "End date must be greater than or equal to start date." Form does NOT submit.',
        apiCall: 'NONE — blocked by frontend validation',
        validate: [
          'Date comparison: endDate (April 22) < startDate (April 25)',
          'Error message displayed',
          'No API call made',
        ],
      },
      {
        seq: 3,
        action: 'Submit Leave with Reason Too Short',
        page: CONFIG.routes.applyEvent,
        input: {
          type: 'Earned Leave',
          fromDate: '2026-04-20',
          toDate: '2026-04-20',
          reason: 'sick',
        },
        expectedResult: 'Validation error: "Reason must be at least 10 characters long." Form does NOT submit.',
        apiCall: 'NONE — blocked by frontend validation',
        validate: [
          '"sick" is 4 characters, minimum is 10',
          'Error message displayed',
          'No API call made',
        ],
      },
      {
        seq: 4,
        action: 'Submit Leave Exceeding Available Balance',
        page: CONFIG.routes.applyEvent,
        input: {
          type: 'Earned Leave',
          fromDate: '2026-05-01',
          toDate: '2026-05-25',
          reason: 'Extended vacation for personal reasons and family travel',
        },
        expectedResult: 'Frontend validation passes (dates and reason valid). POST sent. Backend returns "Insufficient leave balance." Red error banner shown.',
        apiCall: 'POST /api/v1/leaves/requests → 400 error',
        validate: [
          'Requested 25 days but available EL balance is only 16 (18 - 2 used in POS-4)',
          'Backend returns error with message "Insufficient leave balance"',
          'Red error banner displayed on the form',
          'Leave request is NOT created',
          'Leave balance remains unchanged',
        ],
      },
    ],
  },

  {
    id: 'NEG-4',
    title: 'Shift Assignment Fails — Employee Not Assigned, Attendance Has No Shift Reference',
    description:
      'A new employee is created but NO shift is assigned. When checking attendance, the ' +
      'system has no shift to compare against, so late/early calculations cannot be performed ' +
      'correctly. Also verifies that Employee role cannot create or assign shifts.',
    flow: 'Create Employee Without Shift → Check Attendance (No Shift) → Employee Cannot Manage Shifts',
    actingUser: USERS.hrAdmin,
    steps: [
      {
        seq: 1,
        action: 'Create Employee Without Assigning Any Shift',
        page: CONFIG.routes.employeeCreate,
        input: {
          companyTab: {
            firstName: 'NoShift',
            lastName: 'TestUser',
            gender: 'MALE',
            dateOfBirth: '1995-03-10',
            dateOfJoining: '2026-04-01',
            department: 'Engineering',
            designation: 'Intern',
            placeOfTaxDeduction: 'NON_METRO',
          },
          personalTab: {
            email: 'noshift.test@testmail.com',
            phone: '9800000001',
          },
        },
        expectedResult: 'Employee created. No shift assignment step performed. Employee has shiftId as null.',
        apiCall: 'POST /api/v1/employees',
        validate: [
          'Employee created successfully',
          'No ShiftAssignmentRule exists for this employee',
          'Employee record shiftId is null',
        ],
      },
      {
        seq: 2,
        action: 'View NoShift Employee Attendance — No Shift Reference',
        page: CONFIG.routes.attendance,
        input: { loginAs: USERS.hrAdmin, selectedEmployee: 'NoShift' },
        expectedResult: 'Attendance calendar loads but shift info is missing. Late/early calculations have no reference shift to compare against.',
        apiCall: 'GET /api/v1/attendance/records',
        validate: [
          'Calendar renders but attendance records have shift as null',
          'No grace period calculations possible (no shift startTime defined)',
          'isLate and isEarly fields may be null or undefined',
          'Work hours cannot be accurately validated against shift hours',
        ],
      },
      {
        seq: 3,
        action: 'Employee Role Tries to Navigate to Shift Master',
        page: CONFIG.routes.shiftMaster,
        input: { loginAs: NEW_EMPLOYEE, directUrlNavigation: true },
        expectedResult: 'Employee is redirected to /dashboard. Cannot access shift management.',
        apiCall: null,
        validate: [
          'Shift Master not in Employee sidebar',
          'Path access blocked',
          'Redirect to /dashboard',
        ],
      },
      {
        seq: 4,
        action: 'Employee Role Tries to Navigate to Shift Assign',
        page: CONFIG.routes.shiftAssign,
        input: { loginAs: NEW_EMPLOYEE, directUrlNavigation: true },
        expectedResult: 'Employee is redirected to /dashboard. Cannot assign shifts.',
        apiCall: null,
        validate: [
          'Shift Assign not in Employee sidebar',
          'Path access blocked',
          'Redirect to /dashboard',
        ],
      },
    ],
  },

  {
    id: 'NEG-5',
    title: 'Late Arrival Detection and Attendance Anomalies',
    description:
      'Deepak checks in at 09:25 AM which exceeds the 15-minute grace period. The system ' +
      'marks him as LATE with 25 minutes lateness. He also forgets to check out, creating ' +
      'an incomplete attendance record. The monthly summary reflects the anomaly.',
    flow: 'Late Check-In → Late Flagged → No Check-Out → Incomplete Record → Summary Anomaly',
    actingUser: NEW_EMPLOYEE,
    steps: [
      {
        seq: 1,
        action: 'Deepak Checks In at 09:25 AM (Beyond Grace Period)',
        page: CONFIG.routes.attendance,
        input: { punchType: 'CHECK_IN', punchTime: '2026-04-08T09:25:00' },
        expectedResult: 'Check-in recorded at 09:25. Since this exceeds 09:15 (09:00 + 15 min grace), employee is marked LATE with 25 minutes lateness.',
        apiCall: 'POST /api/v1/attendance/check-in',
        validate: [
          'AttendancePunch created with status "IN", punchTime 09:25',
          'AttendanceRecord: checkIn "09:25"',
          'isLate is TRUE (09:25 > 09:15 grace cutoff)',
          'lateMinutes is 25 (09:25 - 09:00)',
          'Calendar cell shows check-in "9:25 AM" in RED (late)',
          'Late indicator displayed: "Late: 25 mins"',
        ],
      },
      {
        seq: 2,
        action: 'Deepak Forgets to Check Out — Day Ends with No OUT Punch',
        page: CONFIG.routes.attendance,
        input: { punchType: 'NONE', note: 'Employee did not check out' },
        expectedResult: 'No check-out recorded. Attendance record for April 8 has checkOut as null. Work hours cannot be calculated.',
        apiCall: 'NONE',
        validate: [
          'AttendanceRecord for April 8: checkOut is NULL',
          'workHours is NULL or 0 (cannot calculate without check-out)',
          'overtimeHours is NULL or 0',
          'Calendar cell shows check-in time but no check-out time',
          'Calendar may show a warning indicator for missing check-out',
        ],
      },
      {
        seq: 3,
        action: 'Verify Monthly Summary Reflects Anomaly',
        page: CONFIG.routes.attendance,
        input: { month: '2026-04' },
        expectedResult: 'Monthly summary includes April 8 as a partial/anomalous day. The missing check-out affects paid days and work hours totals.',
        apiCall: 'GET /api/v1/attendance/monthly-details',
        validate: [
          'April 8 counted differently than a full present day',
          'Total work hours for the month are lower due to missing April 8 hours',
          'AttendanceValidationResult for April 8 may flag isNoOutPunch as true',
          'HR Admin sees the anomaly when reviewing Deepak\'s attendance',
        ],
      },
      {
        seq: 4,
        action: 'Employee Cannot View Other Employees\' Attendance',
        page: CONFIG.routes.attendance,
        input: { loginAs: NEW_EMPLOYEE },
        expectedResult: 'No employee selector dropdown visible. Deepak can ONLY see his own calendar. Cannot switch to another person.',
        apiCall: null,
        validate: [
          'No employee selector / team dropdown rendered for EMPLOYEE role',
          'Only Deepak\'s own employeeId is used in API calls',
          'Calendar shows only Deepak\'s records',
          'No "Apply on behalf" option available',
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// COMBINED EXPORT
// ---------------------------------------------------------------------------

const HRMS_E2E_WORKFLOW_TESTS = {
  metadata: {
    title: 'HRMS End-to-End Workflow: Employee Creation to Attendance Verification',
    sourceReference: 'docs/HRMS_FRONTEND_FLOW_TEST_CASES.md',
    organization: CONFIG.organization,
    totalPositive: POSITIVE_TESTS.length,
    totalNegative: NEGATIVE_TESTS.length,
    totalCases: POSITIVE_TESTS.length + NEGATIVE_TESTS.length,
    flowCoverage: [
      'Employee Creation (with all validations)',
      'Employee Login Verification',
      'Shift Creation and Assignment',
      'Leave Type and Balance Configuration',
      'Approval Workflow Setup',
      'Leave Application by Employee',
      'Manager Approval of Leave',
      'Attendance Check-In / Check-Out',
      'Attendance Calendar Verification',
      'Monthly Summary Verification',
      'RBAC Access Control at Every Step',
      'Late Arrival and Anomaly Detection',
    ],
  },
  config: CONFIG,
  users: USERS,
  newEmployee: NEW_EMPLOYEE,
  shift: SHIFT,
  leaveTypes: LEAVE_TYPES,
  positiveTests: POSITIVE_TESTS,
  negativeTests: NEGATIVE_TESTS,
};

// ---------------------------------------------------------------------------
// PRINT REPORT
// ---------------------------------------------------------------------------

function printReport() {
  const divider = '='.repeat(72);
  const line = '-'.repeat(72);

  console.log(divider);
  console.log('  HRMS E2E WORKFLOW TEST REPORT');
  console.log('  Employee Creation → Attendance Verification');
  console.log(divider);
  console.log(`  Organization     : ${CONFIG.organization}`);
  console.log(`  New Employee     : ${NEW_EMPLOYEE.firstName} ${NEW_EMPLOYEE.lastName} (${NEW_EMPLOYEE.email})`);
  console.log(`  Reporting Manager: ${USERS.manager.name}`);
  console.log(`  HR Admin         : ${USERS.hrAdmin.name}`);
  console.log(`  Shift            : ${SHIFT.name} (${SHIFT.startTime}-${SHIFT.endTime}, ${SHIFT.gracePeriod}min grace)`);
  console.log(`  Leave Balance    : EL ${LEAVE_TYPES.EL.daysPerYear} days, SL ${LEAVE_TYPES.SL.daysPerYear} days`);
  console.log(line);

  console.log('\n  POSITIVE TEST CASES (5):');
  console.log(line);
  POSITIVE_TESTS.forEach((t) => {
    const stepCount = t.steps.length;
    const validationCount = t.steps.reduce((sum, s) => sum + s.validate.length, 0);
    console.log(`  ${t.id}  ${t.title}`);
    console.log(`        Flow  : ${t.flow}`);
    console.log(`        Steps : ${stepCount}    Validations : ${validationCount}`);
  });

  console.log('\n  NEGATIVE TEST CASES (5):');
  console.log(line);
  NEGATIVE_TESTS.forEach((t) => {
    const stepCount = t.steps.length;
    const validationCount = t.steps.reduce((sum, s) => sum + s.validate.length, 0);
    console.log(`  ${t.id}  ${t.title}`);
    console.log(`        Flow  : ${t.flow}`);
    console.log(`        Steps : ${stepCount}    Validations : ${validationCount}`);
  });

  const totalSteps = [...POSITIVE_TESTS, ...NEGATIVE_TESTS].reduce((s, t) => s + t.steps.length, 0);
  const totalValidations = [...POSITIVE_TESTS, ...NEGATIVE_TESTS].reduce(
    (s, t) => s + t.steps.reduce((ss, st) => ss + st.validate.length, 0), 0
  );

  console.log('\n' + divider);
  console.log(`  SUMMARY`);
  console.log(`  Positive Cases   : ${POSITIVE_TESTS.length}`);
  console.log(`  Negative Cases   : ${NEGATIVE_TESTS.length}`);
  console.log(`  Total Cases      : ${POSITIVE_TESTS.length + NEGATIVE_TESTS.length}`);
  console.log(`  Total Steps      : ${totalSteps}`);
  console.log(`  Total Validations: ${totalValidations}`);
  console.log(divider);
}

printReport();

module.exports = HRMS_E2E_WORKFLOW_TESTS;
