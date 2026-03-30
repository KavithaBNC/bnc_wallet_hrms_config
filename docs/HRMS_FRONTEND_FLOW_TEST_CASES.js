/**
 * ============================================================================
 * HRMS Frontend Flow — Complete End-to-End Test Cases
 * ============================================================================
 *
 * Organization : Infosys
 * Test Users   : Aakkash (Super Admin), Chitra (HR Admin),
 *                Murugan (Manager), Ambika (Employee)
 *
 * This file contains 100+ structured test cases covering every frontend flow:
 *   - Login & Authentication
 *   - Employee Add / Edit / Bulk Upload
 *   - Shift Creation & Assignment
 *   - Leave Component & Policy Setup
 *   - Leave Apply (Leave / Permission / On Duty)
 *   - Manager Approval & Rejection
 *   - HR & Super Admin Approval + Direct Assignment
 *   - Attendance Tracking & Regularization
 *   - RBAC Visibility & Permission Matrix
 *   - End-to-End Scenarios
 * ============================================================================
 */

const TEST_USERS = {
  superAdmin: {
    name: 'Aakkash T.M',
    role: 'SUPER_ADMIN',
    email: 'Aakkash.T.M@bncmotors.in',
    password: 'mO%%DJuWq6',
  },
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
  employee: {
    name: 'Ambika Reddy',
    role: 'EMPLOYEE',
    email: 'ambika.reddy195@testmail.com',
    password: 'yqjBVfUkfV',
  },
};

const ORGANIZATION = {
  name: 'Infosys',
};

// ============================================================================
// TC-1: LOGIN FLOW
// ============================================================================

const TC_1_LOGIN_FLOW = [
  {
    id: 'TC-1.1',
    title: 'Company Verification — Valid Company',
    role: 'Any user',
    precondition: 'Application is open at /login',
    steps: [
      'Enter "Infosys" in the Company Name field',
      'Click Verify',
    ],
    expected: [
      'Company is verified successfully',
      'Login form expands to show Email and Password fields',
      'No error message is displayed',
    ],
  },
  {
    id: 'TC-1.2',
    title: 'Company Verification — Invalid Company',
    role: 'Any user',
    precondition: 'Application is open at /login',
    steps: [
      'Enter "XYZCorp" in the Company Name field',
      'Click Verify',
    ],
    expected: [
      'Error message "Company not found" is displayed',
      'Email and Password fields do NOT appear',
      'User cannot proceed further',
    ],
  },
  {
    id: 'TC-1.3',
    title: 'Company Verification — Empty Company Name',
    role: 'Any user',
    precondition: 'Application is open at /login',
    steps: [
      'Leave the Company Name field empty',
      'Click Verify',
    ],
    expected: [
      'Validation error is shown',
      'Form does not submit',
    ],
  },
  {
    id: 'TC-1.4',
    title: 'Super Admin Login — Valid Credentials',
    role: TEST_USERS.superAdmin.role,
    precondition: 'Company "Infosys" is verified successfully',
    steps: [
      `Enter email "${TEST_USERS.superAdmin.email}"`,
      `Enter password "${TEST_USERS.superAdmin.password}"`,
      'Click Login',
    ],
    expected: [
      'Login succeeds',
      'Four tokens (HRMS accessToken, HRMS refreshToken, Configurator accessToken, Configurator refreshToken) stored in localStorage',
      'User object stored in localStorage',
      'User is redirected to /dashboard',
      'Sidebar shows ALL modules: Dashboard, Employees, Departments, Positions, Organizations, Module Permission, Core HR, Event Configuration, Time Attendance, Leave, Attendance, Payroll, Reports, Statutory Compliance, ESOP',
      'Organization selector dropdown is visible in header/sidebar',
    ],
  },
  {
    id: 'TC-1.5',
    title: 'HR Admin Login — Valid Credentials',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Company "Infosys" is verified successfully',
    steps: [
      `Enter email "${TEST_USERS.hrAdmin.email}"`,
      `Enter password "${TEST_USERS.hrAdmin.password}"`,
      'Click Login',
    ],
    expected: [
      'Login succeeds',
      'User is redirected to /dashboard',
      'Sidebar shows: Dashboard, Employees, Departments, Positions, Core HR, Event Configuration, Time Attendance, Leave, Attendance, Payroll, Reports',
      'Sidebar does NOT show Organizations or Module Permission pages',
      'All data is scoped to Infosys organization only — no org switcher visible',
    ],
  },
  {
    id: 'TC-1.6',
    title: 'Manager Login — Valid Credentials',
    role: TEST_USERS.manager.role,
    precondition: 'Company "Infosys" is verified successfully',
    steps: [
      `Enter email "${TEST_USERS.manager.email}"`,
      `Enter password "${TEST_USERS.manager.password}"`,
      'Click Login',
    ],
    expected: [
      'Login succeeds',
      'User is redirected to /dashboard',
      'Sidebar shows only: Dashboard, Employees (team view), Attendance, Leave/Apply Event, Event Approvals',
      'Sidebar does NOT show Event Configuration, Shift Master, Approval Workflow, Payroll, Reports, or any admin-level modules',
      'Dashboard shows team-level statistics (team present count, team leave count, pending approvals)',
    ],
  },
  {
    id: 'TC-1.7',
    title: 'Employee Login — Valid Credentials',
    role: TEST_USERS.employee.role,
    precondition: 'Company "Infosys" is verified successfully',
    steps: [
      `Enter email "${TEST_USERS.employee.email}"`,
      `Enter password "${TEST_USERS.employee.password}"`,
      'Click Login',
    ],
    expected: [
      'Login succeeds',
      'User is redirected to /dashboard',
      'Sidebar shows only: Dashboard, Profile, Attendance (own calendar), Leave/Apply Event',
      'Sidebar does NOT show Employees list, Departments, any configuration modules, any approval pages, or any admin modules',
      'Dashboard shows personal data — own attendance summary, own leave balance, own recent leave requests',
    ],
  },
  {
    id: 'TC-1.8',
    title: 'Login — Invalid Password',
    role: 'Any user',
    precondition: 'Company "Infosys" is verified successfully',
    steps: [
      'Enter a valid email with an incorrect password',
      'Click Login',
    ],
    expected: [
      'Login fails',
      'Error message like "Invalid credentials" or "Incorrect password" is displayed',
      'User remains on the login page',
      'No tokens are stored in localStorage',
    ],
  },
  {
    id: 'TC-1.9',
    title: 'Login — Invalid Email',
    role: 'Any user',
    precondition: 'Company "Infosys" is verified successfully',
    steps: [
      'Enter non-existent email "random@testmail.com" with any password',
      'Click Login',
    ],
    expected: [
      'Login fails',
      'Error message is displayed',
      'User remains on the login page',
    ],
  },
  {
    id: 'TC-1.10',
    title: 'Session Persistence After Page Refresh',
    role: 'Any logged-in user',
    precondition: 'User is already logged in and on the dashboard',
    steps: [
      'Refresh the browser page (F5)',
    ],
    expected: [
      'User remains logged in',
      'Dashboard reloads',
      'ProtectedRoute reads tokens from localStorage',
      'Zustand auth store rehydrates',
      'User is NOT redirected to login page',
      'Sidebar modules remain the same as before refresh',
    ],
  },
  {
    id: 'TC-1.11',
    title: 'Logout Flow',
    role: 'Any logged-in user',
    precondition: 'User is logged in',
    steps: [
      'Click the logout button/option in the header or user menu',
    ],
    expected: [
      'All four tokens and user object are cleared from localStorage',
      'User is redirected to /login',
      'Attempting to navigate to /dashboard directly via URL redirects back to /login',
    ],
  },
  {
    id: 'TC-1.12',
    title: 'Unauthenticated Route Access',
    role: 'Unauthenticated user',
    precondition: 'No user is logged in (localStorage is clear)',
    steps: [
      'Navigate directly to /dashboard via the browser URL bar',
    ],
    expected: [
      'ProtectedRoute detects isAuthenticated is false',
      'User is redirected to /login',
    ],
  },
  {
    id: 'TC-1.13',
    title: 'Role Normalization',
    role: 'Any user',
    precondition: 'User logs in and Configurator returns role with prefix like "HRMS001_SUPER_ADMIN"',
    steps: [
      'Login and inspect the normalized role stored in the auth store',
    ],
    expected: [
      'Role is normalized to "SUPER_ADMIN" (prefix stripped)',
      'All RBAC checks throughout the application use this normalized role',
    ],
  },
];

// ============================================================================
// TC-2: EMPLOYEE ADD FLOW
// ============================================================================

const TC_2_EMPLOYEE_ADD_FLOW = [
  {
    id: 'TC-2.1',
    title: 'Create Employee Button Visibility — Super Admin',
    role: TEST_USERS.superAdmin.role,
    precondition: 'Aakkash is logged in and navigates to /employees',
    steps: [
      'Observe the Employees page',
    ],
    expected: [
      '"Create Employee" button is visible',
      '"Import" button is also visible',
      'Both buttons are clickable',
    ],
  },
  {
    id: 'TC-2.2',
    title: 'Create Employee Button Visibility — HR Admin',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is logged in and navigates to /employees',
    steps: [
      'Observe the Employees page',
    ],
    expected: [
      '"Create Employee" button is visible',
      '"Import" button is also visible',
    ],
  },
  {
    id: 'TC-2.3',
    title: 'Create Employee Button Visibility — Manager',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan is logged in and navigates to /employees',
    steps: [
      'Observe the Employees page',
    ],
    expected: [
      '"Create Employee" button is NOT visible',
      '"Import" button is NOT visible',
      '"Delete" button is NOT visible on any row',
      'Murugan can only view employees in his team',
    ],
  },
  {
    id: 'TC-2.4',
    title: 'Create Employee Button Visibility — Employee',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is logged in',
    steps: [
      'Attempt to navigate to /employees',
    ],
    expected: [
      'Ambika either cannot see the Employees page in her sidebar',
      'Or if she navigates via URL, she sees a very restricted view with NO create, edit, or delete buttons',
      'She may be redirected to her own profile',
    ],
  },
  {
    id: 'TC-2.5',
    title: 'Paygroup Selection Modal',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on /employees and clicks "Create Employee"',
    steps: [
      'Observe the modal that appears before the form',
    ],
    expected: [
      'Paygroup Selection Modal appears showing all paygroups configured for Infosys (e.g., "Monthly")',
      'Chitra must select a paygroup before proceeding',
      'Employee form does NOT load until a paygroup is selected',
      'Clicking Cancel or closing the modal returns to the employee list',
    ],
  },
  {
    id: 'TC-2.6',
    title: 'Employee Form — Company Details Tab Validation (All Required Fields Empty)',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Paygroup is selected and employee form is open in create mode',
    steps: [
      'Leave all fields empty on the Company Details tab',
      'Click Save',
    ],
    expected: [
      'Validation errors appear for: First Name ("required, min 2 chars")',
      'Date of Birth ("required")',
      'Gender ("required")',
      'Date of Joining ("required")',
      'Department ("required")',
      'Designation ("required")',
      'Place of Tax Deduction ("required")',
      'Form does NOT submit',
    ],
  },
  {
    id: 'TC-2.7',
    title: 'Employee Form — Company Details Tab Validation (First Name Too Short)',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Employee form is open in create mode',
    steps: [
      'Enter "A" (1 character) in First Name',
      'Fill all other required fields correctly',
      'Click Save',
    ],
    expected: [
      'Validation error on First Name: "Minimum 2 characters required"',
      'Form does NOT submit',
    ],
  },
  {
    id: 'TC-2.8',
    title: 'Employee Form — Personal Tab Validation (Invalid Email)',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Employee form is open, Personal Information tab is active',
    steps: [
      'Enter "invalid-email" in the Email field (without @ symbol)',
      'Fill Phone Number',
      'Click Save',
    ],
    expected: [
      'Validation error on Email: "Must be a valid email format"',
      'Form does NOT submit',
    ],
  },
  {
    id: 'TC-2.9',
    title: 'Employee Form — Personal Tab Validation (Missing Phone)',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Employee form is open, Personal Information tab is active',
    steps: [
      'Fill Email correctly but leave Phone Number empty',
      'Click Save',
    ],
    expected: [
      'Validation error on Phone Number: "Required"',
      'Form does NOT submit',
    ],
  },
  {
    id: 'TC-2.10',
    title: 'Employee Form — Successful Creation with Minimum Required Fields',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Employee form is open in create mode',
    steps: [
      'Fill Company tab — First Name: "Ravi", Gender: "Male", DOB: "1990-01-15", DOJ: "2026-04-01", Department: "Engineering", Designation: "Developer", Place of Tax Deduction: "METRO"',
      'Fill Personal tab — Email: "ravi.kumar@testmail.com", Phone: "9876543210"',
      'Click Save',
    ],
    expected: [
      'Frontend sends POST to /api/v1/employees',
      'Employee is created successfully',
      'Temporary password is displayed on screen',
      'UI shows success message',
      'Navigating to /employees shows new employee "Ravi" in the list',
    ],
  },
  {
    id: 'TC-2.11',
    title: 'Employee Form — Duplicate Email Rejection',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Employee "Ravi" with email "ravi.kumar@testmail.com" already exists',
    steps: [
      'Create another employee with the same email "ravi.kumar@testmail.com"',
    ],
    expected: [
      'Backend returns an error',
      'Frontend shows error banner: "Email already exists" or similar',
      'Employee is NOT created',
    ],
  },
  {
    id: 'TC-2.12',
    title: 'Employee Form — Inline Master Creation (Department Not Found)',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Employee form is open in create mode',
    steps: [
      'In the Department dropdown, search for "Marketing" which does not exist',
      'Observe the option to create a new department inline',
    ],
    expected: [
      'An option or button like "Create New Department" appears',
      'Clicking it opens an inline modal to enter the new department name and save',
      'After saving, new department appears in the dropdown and is automatically selected',
    ],
  },
  {
    id: 'TC-2.13',
    title: 'Employee Form — All 11 Tabs Are Navigable',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Employee form is open in create mode',
    steps: [
      'Click through all 11 tabs: Company Details, Personal Information, Statutory Details, Bank Details, Salary Details, Assets Management, Academic Qualifications, Previous Employment, Family Members, Others, ESOP Records',
    ],
    expected: [
      'All 11 tabs are clickable and each renders its respective form fields',
      'ESOP tab shows a read-only section',
      'Switching tabs does NOT lose data entered in other tabs',
    ],
  },
  {
    id: 'TC-2.14',
    title: 'Employee Form — Reporting Manager Dropdown',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Employee form is open, Company Details tab',
    steps: [
      'Click the Reporting Manager dropdown and search for "Murugan"',
    ],
    expected: [
      'Searchable dropdown appears showing employees who can be managers',
      '"Murugan Babu" appears in the results',
      'Selecting him sets Murugan as the reporting manager for the new employee',
    ],
  },
  {
    id: 'TC-2.15',
    title: 'Super Admin — Organization Selector on Employee Create',
    role: TEST_USERS.superAdmin.role,
    precondition: 'Aakkash is on /employees',
    steps: [
      'Observe whether an organization selector is available',
      'Switch to a different organization and click "Create Employee"',
    ],
    expected: [
      'Aakkash sees an organization selector/switcher',
      'He can switch to another organization and create employees there',
      'Departments, positions, and paygroups shown in the form correspond to the selected organization',
    ],
  },
];

// ============================================================================
// TC-3: EMPLOYEE EDIT FLOW
// ============================================================================

const TC_3_EMPLOYEE_EDIT_FLOW = [
  {
    id: 'TC-3.1',
    title: 'Edit Button Visibility — HR Admin',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on /employees viewing the employee list',
    steps: [
      'Observe the action buttons on each employee row',
    ],
    expected: [
      'An "Edit" button/icon is visible on each employee row because Chitra has the can_edit permission for employees',
    ],
  },
  {
    id: 'TC-3.2',
    title: 'Edit Button Visibility — Employee',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika navigates to her own profile',
    steps: [
      'Observe the page',
    ],
    expected: [
      'Profile is displayed in read-only (view) mode',
      'There is NO "Edit" button',
      'Ambika cannot modify any of her own data',
    ],
  },
  {
    id: 'TC-3.3',
    title: 'Edit Employee — Pre-populated Data',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra clicks Edit on Ambika\'s row in the employee list',
    steps: [
      'Observe the employee form that loads',
    ],
    expected: [
      'Form navigates to /employees/edit/:id',
      'All fields are pre-populated with Ambika\'s existing data — first name, last name, email, department, designation, DOB, DOJ, etc.',
      'All tabs contain Ambika\'s data',
    ],
  },
  {
    id: 'TC-3.4',
    title: 'Edit Employee — Partial Update',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Edit form for Ambika is open',
    steps: [
      'Change only the Phone Number from "9876543210" to "9876543999"',
      'Click Save',
    ],
    expected: [
      'Frontend sends PUT to /api/v1/employees/:id with only the changed field',
      'Update succeeds',
      'UI shows "Employee updated successfully"',
      'Ambika\'s phone number is now "9876543999" in the system',
    ],
  },
  {
    id: 'TC-3.5',
    title: 'Edit Employee — Tab-Level RBAC for Manager',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan navigates to /employees/edit/:id for a team member (if edit permission is configured)',
    steps: [
      'Observe which tabs are editable and which are read-only',
    ],
    expected: [
      'Murugan may be able to edit the Company Details tab',
      'Salary tab and Statutory tab render in read-only mode because he does not have employee_salary.update or employee_statutory.update permissions',
    ],
  },
  {
    id: 'TC-3.6',
    title: 'View Mode — Employee Views Own Profile',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika navigates to /employees/view/:id (her own ID)',
    steps: [
      'Observe the form',
    ],
    expected: [
      'All fields are displayed but NONE are editable',
      'There is no Save button',
      'All tabs show data in read-only mode',
      'There is no "Edit" button at the top because Ambika\'s role does not have edit permission',
    ],
  },
  {
    id: 'TC-3.7',
    title: 'Password Reset — HR Admin',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on the Employees page',
    steps: [
      'Click the "Reset Password" action on Ambika\'s row',
    ],
    expected: [
      'Confirmation modal appears',
      'After confirming, backend generates a new password',
      'Modal displays the new temporary password',
      'Chitra notes it down to share with Ambika',
    ],
  },
  {
    id: 'TC-3.8',
    title: 'Role Change — HR Admin',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on the Employees page',
    steps: [
      'Click the "Change Role" action on an employee row',
    ],
    expected: [
      'Modal appears with a dropdown showing all Configurator roles (Employee, Manager, HR Admin, etc.)',
      'Chitra selects a new role (e.g., "Manager") and saves',
      'Employee\'s role is updated in both HRMS and the Configurator',
    ],
  },
  {
    id: 'TC-3.9',
    title: 'Soft Delete — HR Admin',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on the Employees page',
    steps: [
      'Click the "Delete" action on an employee row',
    ],
    expected: [
      'Confirmation modal appears',
      'After confirming, employee\'s status is set to "SEPARATED" (soft delete)',
      'Employee record is NOT permanently deleted',
      'When filtering by "Separated" status, the employee still appears',
      'Employee can no longer log in',
    ],
  },
  {
    id: 'TC-3.10',
    title: 'Face Encoding Update',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on the Employees page',
    steps: [
      'Click the "Update Face" action on Ambika\'s row',
    ],
    expected: [
      'FaceCapture component opens, activating the webcam',
      'Chitra positions Ambika\'s face in the camera',
      'Capture button saves the face encoding (128-float array)',
      'Encoding is sent to the backend and stored for biometric attendance matching',
    ],
  },
];

// ============================================================================
// TC-4: BULK UPLOAD FLOW
// ============================================================================

const TC_4_BULK_UPLOAD_FLOW = [
  {
    id: 'TC-4.1',
    title: 'Import Button Visibility — HR Admin',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on /employees',
    steps: [
      'Observe the page',
    ],
    expected: [
      '"Import" button is visible next to the "Create Employee" button',
    ],
  },
  {
    id: 'TC-4.2',
    title: 'Import Button Visibility — Manager/Employee',
    role: 'MANAGER / EMPLOYEE',
    precondition: 'User is on /employees',
    steps: [
      'Observe the page',
    ],
    expected: [
      '"Import" button is NOT visible',
    ],
  },
  {
    id: 'TC-4.3',
    title: 'Download Template',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra navigates to /employees/import',
    steps: [
      'Click the "Download Template" button',
    ],
    expected: [
      'Excel (.xlsx) file downloads with 49 predefined column headers',
      'Columns include: S.No, Paygroup, Associate Code, Associate First Name, Associate Last Name, Gender, Department, Sub Department, Cost Centre, Designation, Role, Father Name, Blood Group, Date of Birth, Date of Joining, Pan Card Number, Bank Name, Account No, Bank IFSC Code, Permanent E-Mail Id, Official E-Mail Id, and all other columns',
      'File is empty except for the header row',
    ],
  },
  {
    id: 'TC-4.4',
    title: 'File Upload — Valid Excel File',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on /employees/import',
    steps: [
      'Drag and drop a valid .xlsx file with 5 employee rows onto the upload zone',
      'All required fields (Name, Email, DOJ, DOB, Gender, Department, Sub Dept, Cost Centre, Paygroup, Place of Tax Deduction) are filled correctly with exact matches to master data',
    ],
    expected: [
      'File name appears in the upload zone',
      '"Upload" button becomes active',
      'After clicking Upload, UI shows a "Validating" spinner',
      'After validation passes, green success banner appears: "5 employees created, 0 failed"',
      'Navigating to employee list shows 5 new employees',
    ],
  },
  {
    id: 'TC-4.5',
    title: 'File Upload — Invalid File Type',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on /employees/import',
    steps: [
      'Try to upload a .pdf or .doc file',
    ],
    expected: [
      'System rejects the file',
      'Error message: "Only .xlsx, .xls, and .csv files are accepted"',
    ],
  },
  {
    id: 'TC-4.6',
    title: 'File Upload — Oversized File',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on /employees/import',
    steps: [
      'Try to upload a file larger than 50 MB',
    ],
    expected: [
      'System rejects the file',
      'Error message about file size limit is displayed',
    ],
  },
  {
    id: 'TC-4.7',
    title: 'Bulk Upload — All-or-Nothing Validation Failure',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Excel file has 10 rows, but row 7 has Department "Engg" (doesn\'t match "Engineering" in Configurator)',
    steps: [
      'Upload the file',
    ],
    expected: [
      'Entire upload fails — ZERO employees are created',
      'UI shows "Validation Failed" state with a red banner',
      'Error table displays: "Row 7: Department \'Engg\' not found in Configurator"',
      'All other rows are NOT processed even if they are valid',
    ],
  },
  {
    id: 'TC-4.8',
    title: 'Bulk Upload — Missing Required Field',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Excel file has rows where Email column is empty for some rows',
    steps: [
      'Upload the file',
    ],
    expected: [
      'Validation fails for the rows with missing email',
      'Since it is all-or-nothing, the entire upload is rejected',
      'Error table lists each failed row with the message about missing email',
    ],
  },
  {
    id: 'TC-4.9',
    title: 'Bulk Upload — Flexible Date Parsing',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Excel file has DOB in various formats — "1990-01-15", "15/01/1990", "Jan 15, 1990", and an Excel serial date number',
    steps: [
      'Upload the file',
    ],
    expected: [
      'All date formats are parsed correctly',
      'Dates are converted to ISO format',
      'Upload succeeds if all other fields are valid',
    ],
  },
  {
    id: 'TC-4.10',
    title: 'Bulk Upload — Reporting Manager Resolution',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Excel file has "Reporting Manager" column filled with "Murugan Babu". Murugan already exists in the system.',
    steps: [
      'Upload the file',
    ],
    expected: [
      'After employee creation (first pass), system performs second pass to resolve reporting managers',
      'Name "Murugan Babu" is matched to the existing employee record',
      'Success response includes managersSet: N indicating how many reporting managers were successfully linked',
    ],
  },
  {
    id: 'TC-4.11',
    title: 'Bulk Upload — Salary Record Creation',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Excel file has "Fixed Gross" column filled with values like "50000". createSalaryRecords option is enabled.',
    steps: [
      'Upload the file with salary creation enabled',
    ],
    expected: [
      'After employee creation, a third pass creates salary records for each employee using the Fixed Gross value',
      'Salary records appear when viewing the employee\'s Salary tab',
    ],
  },
  {
    id: 'TC-4.12',
    title: 'Bulk Upload — Success Response Details',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Upload of 10 valid employee rows succeeds',
    steps: [
      'Observe the success response',
    ],
    expected: [
      'Green banner shows: total: 10, success: 10 (or success + updated), failed: 0',
      'managersSet count displayed',
      'configuratorSyncStatus: "success"',
      'UI clearly communicates how many records were created, updated, skipped, or failed',
    ],
  },
];

// ============================================================================
// TC-5: SHIFT CREATION AND ASSIGNMENT FLOW
// ============================================================================

const TC_5_SHIFT_FLOW = [
  {
    id: 'TC-5.1',
    title: 'Shift Master Page — Access by HR Admin',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is logged in',
    steps: [
      'Navigate to /time-attendance/shift-master',
    ],
    expected: [
      'Shift Master page loads showing a list of existing shifts',
      '"Create Shift" button is visible',
    ],
  },
  {
    id: 'TC-5.2',
    title: 'Shift Master Page — Access Denied for Employee',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is logged in',
    steps: [
      'Attempt to navigate to /time-attendance/shift-master via URL',
    ],
    expected: [
      'Ambika is redirected to the dashboard or sees an access denied state',
      'Shift Master page is not accessible',
    ],
  },
  {
    id: 'TC-5.3',
    title: 'Create Shift — General Shift',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on the Shift Master page',
    steps: [
      'Click "Create Shift"',
      'Enter: Shift Name "General Shift", Shift Code "GS", Start Time "09:00", End Time "18:00", First Half End "13:00", Second Half Start "14:00", Break Duration "60 minutes", Work Hours "8", Grace Period "15 minutes"',
      'Toggle Overtime Enabled as needed',
      'Click Save',
    ],
    expected: [
      'Shift is created successfully',
      '"General Shift" appears in the shift master list with all the configured times displayed',
    ],
  },
  {
    id: 'TC-5.4',
    title: 'Create Shift — Validation (Missing Required Fields)',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on the Create Shift form',
    steps: [
      'Leave Shift Name and Start Time empty',
      'Click Save',
    ],
    expected: [
      'Validation errors appear for required fields',
      'Shift is NOT created',
    ],
  },
  {
    id: 'TC-5.5',
    title: 'Assign Shift to Employee',
    role: TEST_USERS.hrAdmin.role,
    precondition: '"General Shift" exists. Chitra navigates to /time-attendance/shift-assign.',
    steps: [
      'Click "Create Assignment"',
      'Select "General Shift" from the shift dropdown',
      'Select Ambika from the employee multi-select',
      'Set Effective Date to "2026-04-01"',
      'Set Priority to 1',
      'Click Save',
    ],
    expected: [
      'Shift assignment rule is created',
      'Ambika\'s attendance will now be tracked against the General Shift timings from April 1 onwards',
    ],
  },
  {
    id: 'TC-5.6',
    title: 'Bulk Shift Assignment via Grid',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra navigates to /time-attendance/associate-shift-grid',
    steps: [
      'Observe the grid with employees as rows and dates as columns',
      'Assign "General Shift" to multiple employees for the same date range',
    ],
    expected: [
      'Grid allows visual selection and assignment',
      'After saving, all selected employees have the shift assigned for the selected dates',
    ],
  },
  {
    id: 'TC-5.7',
    title: 'Shift Change for Individual Employee',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Ambika is currently assigned to "General Shift"',
    steps: [
      'Navigate to /time-attendance/associate-shift-change',
      'Select Ambika and change her shift to "Night Shift" (if it exists) from a specific date',
    ],
    expected: [
      'Ambika\'s shift assignment is updated',
      'Her attendance from the new effective date is tracked against the new shift timings',
    ],
  },
];

// ============================================================================
// TC-6: LEAVE COMPONENT CREATION AND ASSIGNMENT FLOW
// ============================================================================

const TC_6_LEAVE_COMPONENT_FLOW = [
  {
    id: 'TC-6.1',
    title: 'Create Attendance Component — EL',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra navigates to /event-configuration/attendance-components',
    steps: [
      'Click "Create Component"',
      'Enter: Event Name "Earned Leave", Short Name "EL", Event Category "Leave"',
      'Set flags: Authorized: Yes, Consider As Work Hours: Yes, Has Balance: Yes, Allow Datewise: Yes, Allow Hourly: No, Requires Approval: Yes',
      'Click Save',
    ],
    expected: [
      '"Earned Leave" attendance component is created and appears in the components list',
    ],
  },
  {
    id: 'TC-6.2',
    title: 'Create Attendance Component — Permission (Hourly Type)',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on the attendance components page',
    steps: [
      'Click "Create Component"',
      'Enter: Event Name "Permission", Short Name "PERM", Event Category "Permission"',
      'Set flags: Allow Hourly: Yes, Allow Datewise: No, Requires Approval: Yes',
      'Click Save',
    ],
    expected: [
      '"Permission" component is created',
      'Allow Hourly flag is Yes and Allow Datewise is No — this component works on time-based entries within a single day',
    ],
  },
  {
    id: 'TC-6.3',
    title: 'Create Leave Type — EL with Balance Rules',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra navigates to /event/leave-type or /event/leave-type/create',
    steps: [
      'Click "Create Leave Type"',
      'Enter: Name "Earned Leave", Code "EL", Default Days Per Year: 18, Is Paid: Yes, Max Carry Forward: 15, Accrual Type: Monthly, Requires Approval: Yes, Can Be Negative: No',
      'Click Save',
    ],
    expected: [
      'EL leave type is created',
      'It will accrue 1.5 days per month (18/12)',
      'Allow carry forward up to 15 days',
      'Require approval for all requests',
    ],
  },
  {
    id: 'TC-6.4',
    title: 'Create Leave Type — SL with No Carry Forward',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is on leave type creation page',
    steps: [
      'Create leave type: Name "Sick Leave", Code "SL", Default Days Per Year: 12, Is Paid: Yes, Max Carry Forward: 0, Accrual Type: Monthly',
      'Click Save',
    ],
    expected: [
      'SL leave type is created with 0 carry forward',
      'Unused SL days are lost at year-end',
    ],
  },
  {
    id: 'TC-6.5',
    title: 'Rights Allocation — Assign EL Balance to Employees',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'EL leave type exists. Chitra navigates to /event-configuration/rights-allocation.',
    steps: [
      'Create allocation for Paygroup "Monthly", Leave Type "EL", Opening Balance: 18 days for the year 2026',
    ],
    expected: [
      'EmployeeLeaveBalance records are created for all employees in the "Monthly" paygroup',
      'Each employee gets 18 EL days as opening balance',
      'When Ambika checks her leave balance, she sees EL: 18 available',
    ],
  },
  {
    id: 'TC-6.6',
    title: 'Event Balance Entry — Manual Balance Adjustment',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra navigates to /event/balance-entry',
    steps: [
      'Search for Ambika',
      'View her EL balance',
      'Manually adjust the opening balance from 18 to 20',
    ],
    expected: [
      'Ambika\'s EL opening balance is updated to 20',
      'Available balance recalculates as: 20 (opening) + accrued + carried forward - used',
    ],
  },
  {
    id: 'TC-6.7',
    title: 'Configure Approval Workflow',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra navigates to /event-configuration/approval-workflow',
    steps: [
      'Create a workflow with type "Leave Approval" and define it to handle Leave events',
    ],
    expected: [
      'Approval workflow is created and available for mapping',
    ],
  },
  {
    id: 'TC-6.8',
    title: 'Configure Workflow Mapping — Single Level',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Approval workflow exists. Chitra navigates to /event-configuration/workflow-mapping.',
    steps: [
      'Create mapping linking workflow to "Engineering" department with approval Level 1 = Reporting Manager',
      'Set priority to 1',
    ],
    expected: [
      'Mapping is created',
      'When any employee in Engineering dept applies for leave, request routes to their reporting manager for approval',
    ],
  },
  {
    id: 'TC-6.9',
    title: 'Configure Workflow Mapping — Multi-Level',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Approval workflow exists',
    steps: [
      'Create mapping with approval Level 1 = Reporting Manager, Level 2 = HR',
      'Link to Engineering department',
    ],
    expected: [
      'Leave requests from Engineering employees will first go to their reporting manager',
      'After manager approval, advance to HR for final approval',
    ],
  },
  {
    id: 'TC-6.10',
    title: 'Access Denied — Employee Tries to Access Event Configuration',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is logged in',
    steps: [
      'Attempt to navigate to /event-configuration/attendance-components via URL',
    ],
    expected: [
      'Ambika is redirected to dashboard',
      'She cannot access any configuration pages',
    ],
  },
];

// ============================================================================
// TC-7: EMPLOYEE LEAVE APPLY FLOW
// ============================================================================

const TC_7_LEAVE_APPLY_FLOW = [
  {
    id: 'TC-7.1',
    title: 'Apply Leave — Full Day EL',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is logged in, has EL balance of 18 days, workflow is configured',
    steps: [
      'Navigate to /attendance',
      'Click "Apply Leave"',
      'Select "Earned Leave" from Type dropdown',
      'Enter From Date: "2026-04-07", To Date: "2026-04-09"',
      'Duration: Full Day',
      'Reason: "Family wedding celebration and travel"',
      'Click Submit',
    ],
    expected: [
      'Frontend validates all fields pass',
      'POST sent to /api/v1/leaves/requests',
      'PENDING leave request created with totalDays: 3',
      'Request assigned to Murugan (reporting manager) at approval Level 1',
      'Ambika redirected to /attendance with green success banner "Leave applied successfully!"',
      'Calendar shows pending indicators on April 7, 8, 9',
    ],
  },
  {
    id: 'TC-7.2',
    title: 'Apply Leave — Balance Hint Display',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika has EL balance: opening 18, used 3, available 15',
    steps: [
      'On Apply Event page, select "Earned Leave" from Type dropdown',
    ],
    expected: [
      'Balance hint displayed showing: Opening Balance: 18, Used: 3, Available: 15',
      'Ambika can see her remaining balance before submitting',
    ],
  },
  {
    id: 'TC-7.3',
    title: 'Apply Leave — Half Day (First Half)',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is on Apply Event page',
    steps: [
      'Select "Earned Leave"',
      'From Date: "2026-04-10", To Date: "2026-04-10"',
      'Duration: "First Half"',
      'Reason: "Personal work in the morning"',
      'Click Submit',
    ],
    expected: [
      'System calculates totalDays as 0.5',
      'Reason stored as "[First Half] Personal work in the morning"',
      'Request created with 0.5 days',
      'On calendar, April 10 shows "First Half" label',
    ],
  },
  {
    id: 'TC-7.4',
    title: 'Apply Leave — Half Day (Second Half)',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is on Apply Event page',
    steps: [
      'Same as TC-7.3 but select "Second Half" duration',
    ],
    expected: [
      'totalDays is 0.5',
      'Reason prepended with "[Second Half]"',
      'Calendar shows "Second Half" badge',
    ],
  },
  {
    id: 'TC-7.5',
    title: 'Apply Leave — Validation: Missing Leave Type',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is on Apply Event page',
    steps: [
      'Leave the Type dropdown empty',
      'Fill other fields',
      'Click Submit',
    ],
    expected: [
      'Validation error: "Please select a leave type"',
      'Form does NOT submit',
    ],
  },
  {
    id: 'TC-7.6',
    title: 'Apply Leave — Validation: Missing Start Date',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is on Apply Event page',
    steps: [
      'Select a leave type',
      'Leave From Date empty',
      'Fill other fields',
      'Click Submit',
    ],
    expected: [
      'Validation error: "Please select a start date"',
      'Form does NOT submit',
    ],
  },
  {
    id: 'TC-7.7',
    title: 'Apply Leave — Validation: End Date Before Start Date',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is on Apply Event page',
    steps: [
      'Select From Date: "2026-04-10", To Date: "2026-04-08"',
      'Click Submit',
    ],
    expected: [
      'Validation error: "End date must be greater than or equal to start date"',
      'Form does NOT submit',
    ],
  },
  {
    id: 'TC-7.8',
    title: 'Apply Leave — Validation: Reason Too Short',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is on Apply Event page',
    steps: [
      'Fill all fields correctly but enter Reason: "sick" (less than 10 characters)',
      'Click Submit',
    ],
    expected: [
      'Validation error: "Reason must be at least 10 characters long"',
      'Form does NOT submit',
    ],
  },
  {
    id: 'TC-7.9',
    title: 'Apply Leave — Insufficient Balance',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika has only 2 EL days remaining',
    steps: [
      'Apply for 5 days of EL',
    ],
    expected: [
      'Backend returns error: "Insufficient leave balance"',
      'Frontend displays red error banner with this message',
      'Request is NOT created',
    ],
  },
  {
    id: 'TC-7.10',
    title: 'Apply Leave — No Workflow Configured',
    role: TEST_USERS.employee.role,
    precondition: 'No approval workflow mapping exists for Ambika\'s department/paygroup',
    steps: [
      'Apply for leave',
    ],
    expected: [
      'Backend returns error: "No approval workflow configured"',
      'Frontend displays the error',
      'Request is NOT created',
    ],
  },
  {
    id: 'TC-7.11',
    title: 'Apply Permission — Time-Based',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is on Attendance page',
    steps: [
      'Click "Apply Permission"',
      'Permission component is pre-selected',
      'Enter Date: "2026-03-31", From Time: "15:00", To Time: "16:30"',
      'Reason: "Doctor appointment at hospital"',
      'Click Submit',
    ],
    expected: [
      'Reason stored as "[Permission 15:00-16:30] Doctor appointment at hospital"',
      'Request created as PENDING',
      'After approval, calendar shows "Permission 3:00 PM - 4:30 PM" badge on March 31',
    ],
  },
  {
    id: 'TC-7.12',
    title: 'Apply On Duty',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is on Attendance page',
    steps: [
      'Click "Apply On Duty"',
      'Select "On Duty" component',
      'Enter From Date: "2026-04-12", To Date: "2026-04-12"',
      'Reason: "Client site visit for project demo"',
      'Click Submit',
    ],
    expected: [
      'Reason stored as "[Onduty On Duty] Client site visit for project demo"',
      'Request created as PENDING',
      'After approval, calendar shows OD indicator on April 12',
    ],
  },
  {
    id: 'TC-7.13',
    title: 'View Own Leave Requests',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika has submitted multiple leave requests',
    steps: [
      'Navigate to /leave',
    ],
    expected: [
      'Leave page shows list of Ambika\'s requests with status badges',
      'PENDING (yellow), APPROVED (green), REJECTED (red), CANCELLED (gray)',
      'Each row shows leave type, dates, days, reason, and status',
    ],
  },
  {
    id: 'TC-7.14',
    title: 'Cancel Own Pending Request',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika has a PENDING leave request',
    steps: [
      'On the Leave page, click "Cancel" on the pending request',
    ],
    expected: [
      'Request status changes to CANCELLED',
      'Leave balance is NOT affected (was never deducted since it was pending)',
      'Calendar indicators for those dates are removed',
    ],
  },
  {
    id: 'TC-7.15',
    title: 'Cannot Cancel Approved Request',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika has an APPROVED leave request',
    steps: [
      'Attempt to cancel the approved request',
    ],
    expected: [
      '"Cancel" option is either not available or clicking it is rejected by the backend',
      'Approved requests require a different cancellation flow',
    ],
  },
];

// ============================================================================
// TC-8: MANAGER APPROVAL AND REJECTION FLOW
// ============================================================================

const TC_8_MANAGER_APPROVAL_FLOW = [
  {
    id: 'TC-8.1',
    title: 'Leave Approval Page — Access by Manager',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan is logged in',
    steps: [
      'Navigate to /event/approvals',
    ],
    expected: [
      'Leave Approval page loads',
      'Shows pending leave requests from employees who report to Murugan',
      'Filters available for Workflow Type, Leave Type, Date range, and Status (default: PENDING)',
    ],
  },
  {
    id: 'TC-8.2',
    title: 'Leave Approval Page — Access Denied for Employee',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is logged in',
    steps: [
      'Attempt to navigate to /event/approvals via URL',
    ],
    expected: [
      'Ambika is redirected to the dashboard',
      'Approval page is not accessible to the Employee role',
    ],
  },
  {
    id: 'TC-8.3',
    title: 'Approve Leave Request — Single Level',
    role: TEST_USERS.manager.role,
    precondition: 'Ambika has a PENDING EL request for 3 days. Single-level workflow configured.',
    steps: [
      'On the approval page, locate Ambika\'s request',
      'Enter remark: "Approved, enjoy!"',
      'Click the "Approve" button',
    ],
    expected: [
      'PUT sent to /api/v1/leaves/requests/:id/approve',
      'Status changes to APPROVED',
      'Ambika\'s EL balance deducted by 3 days',
      'Approval recorded in approvalHistory with Murugan\'s ID, timestamp, and remark',
      'Request disappears from pending list (or shows as Approved with status filter set to All)',
    ],
  },
  {
    id: 'TC-8.4',
    title: 'Reject Leave Request',
    role: TEST_USERS.manager.role,
    precondition: 'Ambika has a PENDING leave request',
    steps: [
      'Click the "Reject" button on Ambika\'s request',
      'Rejection modal appears',
      'Enter reason: "Please reschedule due to project deadline"',
      'Confirm rejection',
    ],
    expected: [
      'PUT sent to /api/v1/leaves/requests/:id/reject',
      'Status changes to REJECTED',
      'Ambika\'s leave balance is NOT deducted',
      'Rejection reason stored in approval history',
      'Ambika sees the rejection with Murugan\'s comments on her Leave page',
    ],
  },
  {
    id: 'TC-8.5',
    title: 'Reject Without Reason — Validation',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan clicks Reject on a request',
    steps: [
      'Leave the rejection reason empty in the modal',
      'Try to confirm',
    ],
    expected: [
      'Validation prevents submission',
      'Rejection reason is mandatory',
      'Message like "Please enter a rejection reason" is shown',
    ],
  },
  {
    id: 'TC-8.6',
    title: 'Bulk Approve Multiple Requests',
    role: TEST_USERS.manager.role,
    precondition: 'Multiple PENDING requests exist from team members',
    steps: [
      'Select 3 pending requests using checkboxes',
      'Click "Bulk Approve"',
      'Enter common remark: "All approved"',
      'Confirm',
    ],
    expected: [
      'All 3 requests are approved',
      'Each one\'s balance is deducted',
      'Approval history records Murugan as the approver for all 3',
    ],
  },
  {
    id: 'TC-8.7',
    title: 'Column Picker — Customize Table Columns',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan is on the approval page',
    steps: [
      'Click the column picker button',
      'Uncheck "Hours" and "Entry By" columns',
      'Close the picker',
    ],
    expected: [
      '"Hours" and "Entry By" columns are hidden from the table',
      'Other columns remain visible',
      'Column selection persists during the session',
    ],
  },
  {
    id: 'TC-8.8',
    title: 'Filter by Leave Type',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan is on the approval page',
    steps: [
      'Select "Sick Leave" from the Leave Type filter dropdown',
    ],
    expected: [
      'Table shows only SL requests',
      'EL, CL, and other type requests are filtered out',
    ],
  },
  {
    id: 'TC-8.9',
    title: 'Filter by Status — Show All',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan is on the approval page',
    steps: [
      'Change the Status filter from "PENDING" to "ALL"',
    ],
    expected: [
      'Table shows all requests — PENDING, APPROVED, REJECTED, and CANCELLED — from Murugan\'s team',
      'Approved and rejected requests do not show Approve/Reject action buttons',
    ],
  },
  {
    id: 'TC-8.10',
    title: 'Pagination',
    role: TEST_USERS.manager.role,
    precondition: 'More than 10 pending requests exist',
    steps: [
      'Observe the pagination',
      'Change page size to 20',
      'Navigate to page 2',
    ],
    expected: [
      'Page size changes to 20 results per page',
      'Page 2 shows the next set of results',
      'Total count is displayed',
    ],
  },
  {
    id: 'TC-8.11',
    title: 'Manager View Toggle — My Requests vs Team Requests',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan is on /leave page',
    steps: [
      'Toggle from "Team Requests" to "My Requests"',
    ],
    expected: [
      'List switches from showing team members\' requests to showing Murugan\'s own personal leave requests',
      'Toggle back to "Team Requests" shows team data again',
    ],
  },
  {
    id: 'TC-8.12',
    title: 'Multi-Level Approval — Level 1 Approve, Advance to Level 2',
    role: TEST_USERS.manager.role + ' → ' + TEST_USERS.hrAdmin.role,
    precondition: 'Two-level workflow: Level 1 = Manager, Level 2 = HR. Ambika has PENDING request at Level 1.',
    steps: [
      'Murugan approves the request at Level 1',
    ],
    expected: [
      'Status does NOT become APPROVED yet',
      'currentApprovalLevel advances from 1 to 2',
      'assignedApproverEmployeeId changes from Murugan\'s ID to Chitra\'s ID',
      'Request disappears from Murugan\'s pending queue',
      'Request appears in Chitra\'s approval queue',
    ],
  },
  {
    id: 'TC-8.13',
    title: 'Multi-Level Approval — Level 2 Final Approve',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Request is at Level 2, assigned to Chitra',
    steps: [
      'Chitra sees the request in her approval queue',
      'She can see that Murugan approved at Level 1 (in approval history)',
      'She clicks Approve',
    ],
    expected: [
      'This is the final level — status changes to APPROVED',
      'Balance is deducted',
      'Full two-level approval chain is recorded in approvalHistory JSON',
    ],
  },
  {
    id: 'TC-8.14',
    title: 'Multi-Level Approval — Level 1 Reject Stops Chain',
    role: TEST_USERS.manager.role,
    precondition: 'Two-level workflow. Ambika\'s request is at Level 1.',
    steps: [
      'Murugan rejects the request at Level 1 with reason',
    ],
    expected: [
      'Request is immediately set to REJECTED',
      'It does NOT advance to Level 2',
      'Chitra never sees this request in her queue',
      'Balance is NOT deducted',
    ],
  },
];

// ============================================================================
// TC-9: HR AND SUPER ADMIN APPROVAL FLOW
// ============================================================================

const TC_9_HR_SUPER_ADMIN_APPROVAL_FLOW = [
  {
    id: 'TC-9.1',
    title: 'HR Admin Sees All Org Requests',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is logged in',
    steps: [
      'Navigate to /event/approvals',
    ],
    expected: [
      'Chitra sees ALL pending requests from ALL employees in the Infosys organization',
      'Regardless of department or reporting hierarchy',
      'Includes requests from employees who do not report to her',
    ],
  },
  {
    id: 'TC-9.2',
    title: 'Super Admin Sees All Orgs',
    role: TEST_USERS.superAdmin.role,
    precondition: 'Aakkash is logged in',
    steps: [
      'Navigate to /event/approvals',
    ],
    expected: [
      'Aakkash sees pending requests across ALL organizations',
      'Organization filter is available to narrow by specific org',
    ],
  },
  {
    id: 'TC-9.3',
    title: 'HR Admin Approves Any Employee\'s Request',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'An employee from a different team (not reporting to Chitra) has a pending request',
    steps: [
      'Chitra approves the request',
    ],
    expected: [
      'Approval succeeds',
      'Chitra can approve any request in the organization regardless of reporting hierarchy',
    ],
  },
  {
    id: 'TC-9.4',
    title: 'Direct Assignment — HR Applies Leave on Behalf (Auto-Approved)',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is viewing Ambika\'s attendance',
    steps: [
      'Click "Apply Event on behalf" for Ambika',
      'Apply Event page loads with blue banner: "Assigning on behalf of Ambika Reddy — will be auto-approved (HR Direct Assignment)"',
      'Select "Sick Leave", Date: "2026-03-28"',
      'Reason: "Sick leave applied by HR"',
      'Click Submit',
    ],
    expected: [
      'Frontend calls POST /api/v1/leaves/hr-assign (NOT /leaves/requests)',
      'Leave created with status APPROVED immediately',
      'NO PENDING state',
      'NO workflow routing',
      'Ambika\'s SL balance deducted immediately',
      'Calendar shows approved SL for March 28',
    ],
  },
  {
    id: 'TC-9.5',
    title: 'Direct Assignment — Manager Applies Leave on Behalf (Auto-Approved)',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan is viewing Ambika\'s attendance (team member)',
    steps: [
      'Click "Apply Event on behalf" for Ambika',
      'Banner shows: "Assigning on behalf of Ambika Reddy — will be auto-approved (Manager Direct Assignment)"',
      'Select "Work From Home", Date: "2026-04-10"',
      'Reason: "WFH assigned by manager"',
      'Submit',
    ],
    expected: [
      'Calls /leaves/hr-assign — auto-approved',
      'No PENDING state',
      'Balance deducted immediately',
    ],
  },
  {
    id: 'TC-9.6',
    title: 'Direct Assignment — Super Admin Applies on Behalf',
    role: TEST_USERS.superAdmin.role,
    precondition: 'Aakkash is viewing any employee\'s attendance',
    steps: [
      'Select any employee from any organization',
      'Apply leave on behalf',
    ],
    expected: [
      'Auto-approved via /leaves/hr-assign',
      'Works across organizations',
    ],
  },
  {
    id: 'TC-9.7',
    title: 'Direct Assignment — Banner Confirmation',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra navigates to Apply Event on behalf of an employee',
    steps: [
      'Observe the banner at the top of the form',
    ],
    expected: [
      'Prominent blue banner is visible: "Assigning on behalf of [Employee Name] — will be auto-approved (HR Direct Assignment)"',
      'Banner ensures user knows the leave will skip the approval workflow',
    ],
  },
  {
    id: 'TC-9.8',
    title: 'Self-Apply by HR Goes Through Normal Workflow',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra wants to apply leave for HERSELF',
    steps: [
      'Chitra applies leave for herself (not on behalf of anyone)',
    ],
    expected: [
      'Request goes through normal workflow — status is PENDING',
      'Routed to Chitra\'s own reporting manager or configured approver',
      'Does NOT auto-approve',
      '/leaves/requests endpoint is used (not /leaves/hr-assign)',
    ],
  },
];

// ============================================================================
// TC-10: ATTENDANCE TRACKING FLOW
// ============================================================================

const TC_10_ATTENDANCE_FLOW = [
  {
    id: 'TC-10.1',
    title: 'Attendance Calendar — Employee View',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is logged in and has attendance records for the current month',
    steps: [
      'Navigate to /attendance',
    ],
    expected: [
      'Monthly calendar grid loads showing each day',
      'Days with attendance show check-in time (green if on time, red if late), check-out time (red if early), work hours, and OT hours',
      'Leave days show the leave type badge',
      'Today\'s cell is highlighted',
      'No employee selector visible — Ambika can only see her own calendar',
    ],
  },
  {
    id: 'TC-10.2',
    title: 'Attendance Calendar — Late Arrival Indicator',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika has General Shift (9 AM start, 15 min grace). She checked in at 9:20 AM.',
    steps: [
      'View that day on the calendar',
    ],
    expected: [
      'Check-in time "9:20 AM" shown in red',
      'Late indicator shows "Late: 20 mins" (since 9:20 is beyond the 9:15 grace cutoff)',
    ],
  },
  {
    id: 'TC-10.3',
    title: 'Attendance Calendar — On-Time Arrival (Within Grace)',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika checked in at 9:10 AM (within 15-min grace)',
    steps: [
      'View that day on the calendar',
    ],
    expected: [
      'Check-in time "9:10 AM" shown in green',
      'No late indicator',
    ],
  },
  {
    id: 'TC-10.4',
    title: 'Attendance Calendar — Leave Overlay',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika has approved EL on April 7-9',
    steps: [
      'View the calendar for April 2026',
    ],
    expected: [
      'April 7, 8, and 9 show "EL" badges with approved leave color coding',
      'No check-in/check-out data shown for those days',
    ],
  },
  {
    id: 'TC-10.5',
    title: 'Attendance Calendar — Permission Timing Display',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika has approved permission on March 31 with reason "[Permission 15:00-16:30] Doctor appointment"',
    steps: [
      'View March 31 on the calendar',
    ],
    expected: [
      'Cell shows "Permission 3:00 PM - 4:30 PM" parsed from the reason',
      'Regular attendance data for the rest of the day is also shown',
    ],
  },
  {
    id: 'TC-10.6',
    title: 'Attendance Calendar — Half Day Display',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika has approved half-day leave with reason "[First Half] Personal work"',
    steps: [
      'View that day on the calendar',
    ],
    expected: [
      'Cell shows "First Half" label',
      'Second half attendance data is also displayed',
    ],
  },
  {
    id: 'TC-10.7',
    title: 'Monthly Details Sidebar',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is on the Attendance page',
    steps: [
      'Observe the right-side sidebar',
    ],
    expected: [
      'MonthlyDetailsSidebar shows: Present Days, Absent Days, Leave Days (with breakdown by type — EL: X, SL: Y)',
      'LOP Days, Half Days, Holiday Days, Weekend Days',
      'Overtime Hours, Paid Days, Total Working Days',
      'All numbers match the calendar visual',
    ],
  },
  {
    id: 'TC-10.8',
    title: 'Manager — Team Employee Selector',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan is logged in',
    steps: [
      'Navigate to /attendance',
    ],
    expected: [
      'Murugan sees his own calendar by default',
      'Team selector dropdown available showing his direct reports (including Ambika)',
      'Selecting Ambika switches the calendar to show Ambika\'s attendance',
    ],
  },
  {
    id: 'TC-10.9',
    title: 'HR Admin — Full Employee Selector',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is logged in',
    steps: [
      'Navigate to /attendance',
    ],
    expected: [
      'Employee selector showing ALL employees in the Infosys organization',
      'Chitra can select any employee and view their attendance calendar',
    ],
  },
  {
    id: 'TC-10.10',
    title: 'Super Admin — Organization Switcher on Attendance',
    role: TEST_USERS.superAdmin.role,
    precondition: 'Aakkash is logged in',
    steps: [
      'Navigate to /attendance',
    ],
    expected: [
      'Organization switcher available in addition to employee selector',
      'Aakkash can switch to any organization and view any employee\'s attendance',
    ],
  },
  {
    id: 'TC-10.11',
    title: 'Attendance Regularization — Employee Requests Correction',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika forgot to check out on a specific day — record shows no check-out time',
    steps: [
      'Request attendance regularization for that day with corrected check-out time "18:00"',
      'Reason: "Forgot to punch out"',
    ],
    expected: [
      'Regularization request created with status PENDING',
      'Appears in Murugan\'s (manager) approval queue',
    ],
  },
  {
    id: 'TC-10.12',
    title: 'Attendance Regularization — Manager Approves',
    role: TEST_USERS.manager.role,
    precondition: 'Ambika\'s regularization request is pending',
    steps: [
      'Murugan reviews and approves the regularization',
    ],
    expected: [
      'Attendance record for that day is updated with the corrected check-out time',
      'Work hours are recalculated',
      'Regularization status changes to APPROVED',
    ],
  },
  {
    id: 'TC-10.13',
    title: 'Attendance Lock — HR Locks Month',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra navigates to /time-attendance/attendance-lock',
    steps: [
      'Select organization: Infosys, Year: 2026, Month: February',
      'Enter remarks: "Locked for payroll processing"',
      'Click Lock',
    ],
    expected: [
      'February 2026 attendance is locked for all Infosys employees',
      'No further edits, regularizations, or manual entries allowed for that month',
      'Attempting to modify any February record returns an error',
    ],
  },
  {
    id: 'TC-10.14',
    title: 'Attendance Lock — Prevented Edits After Lock',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'February 2026 is locked',
    steps: [
      'Attempt to record a manual attendance entry for a February date',
    ],
    expected: [
      'Operation is blocked',
      'Error message indicates month is locked and no changes are permitted',
    ],
  },
  {
    id: 'TC-10.15',
    title: 'Attendance Lock Page — Access Denied for Manager/Employee',
    role: 'MANAGER / EMPLOYEE',
    precondition: 'Murugan or Ambika is logged in',
    steps: [
      'Attempt to navigate to /time-attendance/attendance-lock via URL',
    ],
    expected: [
      'User is redirected to the dashboard',
      'Attendance Lock page is not accessible',
    ],
  },
];

// ============================================================================
// TC-11: RBAC VISIBILITY AND PERMISSION VERIFICATION
// ============================================================================

const TC_11_RBAC_VERIFICATION = [
  {
    id: 'TC-11.1',
    title: 'Super Admin — Full Sidebar Modules',
    role: TEST_USERS.superAdmin.role,
    precondition: 'Aakkash is logged in',
    steps: [
      'Observe the sidebar',
    ],
    expected: [
      'All modules visible: Dashboard, Employees, Departments, Positions, Organizations, Module Permission, User Roles, Core HR, Event Configuration (with all sub-items), Time Attendance (with all sub-items), Leave, Attendance, Payroll (with all sub-items), Reports, Statutory Compliance, ESOP, Separation, Loans, Transfer and Promotions',
    ],
  },
  {
    id: 'TC-11.2',
    title: 'HR Admin — No Organizations/Module Permission',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra is logged in',
    steps: [
      'Observe the sidebar',
    ],
    expected: [
      'Sidebar does NOT contain "Organizations" or "Module Permission" pages',
      'Everything else similar to Super Admin but scoped to Infosys',
    ],
  },
  {
    id: 'TC-11.3',
    title: 'Manager — No Configuration Modules',
    role: TEST_USERS.manager.role,
    precondition: 'Murugan is logged in',
    steps: [
      'Observe the sidebar',
    ],
    expected: [
      'Sidebar does NOT contain Event Configuration, Shift Master, Shift Assign, Approval Workflow, Payroll, Reports, Statutory Compliance, ESOP, or any admin-level modules',
      'Only shows Dashboard, Employees (team), Attendance, Leave/Apply Event, Event Approvals',
    ],
  },
  {
    id: 'TC-11.4',
    title: 'Employee — Minimal Sidebar',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is logged in',
    steps: [
      'Observe the sidebar',
    ],
    expected: [
      'Sidebar shows ONLY Dashboard, Profile, Attendance (own), Leave/Apply Event',
      'No employee list, no configuration, no approvals, no admin modules',
    ],
  },
  {
    id: 'TC-11.5',
    title: 'Employee — Direct URL Access to Admin Page',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is logged in',
    steps: [
      'Type /employees directly in the browser URL bar',
    ],
    expected: [
      'Ambika is either redirected to dashboard or sees a restricted view with no action buttons',
      'DashboardLayout checks path access and blocks unauthorized navigation',
    ],
  },
  {
    id: 'TC-11.6',
    title: 'Super Admin Wildcard Permission',
    role: TEST_USERS.superAdmin.role,
    precondition: 'Backend returns empty permissions for Super Admin (implicit full access)',
    steps: [
      'usePermissions hook processes the empty response',
    ],
    expected: [
      'System sets wildcard permission "*" for Super Admin',
      'All canView(), canAdd(), canEdit(), canDelete() checks return true',
      'All buttons and actions are visible',
    ],
  },
  {
    id: 'TC-11.7',
    title: 'Employee Form Tab RBAC — HR Admin Full Edit',
    role: TEST_USERS.hrAdmin.role,
    precondition: 'Chitra opens an employee\'s edit form',
    steps: [
      'Check all 11 tabs',
    ],
    expected: [
      'All tabs are editable',
      'Chitra can modify Company Details, Personal, Statutory, Bank, Salary, Assets, Academic, Previous Employment, Family, Others',
      'Only ESOP is read-only',
    ],
  },
  {
    id: 'TC-11.8',
    title: 'Employee Form Tab RBAC — Employee Read-Only',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika opens her own profile view',
    steps: [
      'Observe all tabs',
    ],
    expected: [
      'ALL tabs are in read-only mode',
      'No Save button',
      'No edit capability on any tab',
    ],
  },
  {
    id: 'TC-11.9',
    title: 'Attendance Page — Employee Cannot View Others',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is on /attendance',
    steps: [
      'Look for employee selector or team dropdown',
    ],
    expected: [
      'No employee selector is available',
      'Ambika can ONLY see her own attendance calendar',
      'No way to switch to another employee\'s view',
    ],
  },
  {
    id: 'TC-11.10',
    title: 'Leave Approval Page — Employee Cannot Access',
    role: TEST_USERS.employee.role,
    precondition: 'Ambika is logged in',
    steps: [
      'Check if "Event Approvals" appears in sidebar',
      'Try navigating to /event/approvals via URL',
    ],
    expected: [
      '"Event Approvals" is not in the sidebar',
      'Navigating via URL redirects to dashboard because getModulePermissions(\'/event/approvals\').can_view is false for Employee role',
    ],
  },
];

// ============================================================================
// TC-12: END-TO-END SCENARIO TEST CASES
// ============================================================================

const TC_12_END_TO_END_SCENARIOS = [
  {
    id: 'TC-12.1',
    title: 'Complete Employee Onboarding Scenario',
    roles: [TEST_USERS.superAdmin.role, TEST_USERS.hrAdmin.role, 'New Employee'],
    steps: [
      '1. Aakkash logs in, navigates to /employees, clicks "Create Employee"',
      '2. Selects paygroup "Monthly"',
      '3. Fills Company tab: First Name "Priya", Department "Engineering", Designation "Developer", DOJ "2026-04-01", Reporting Manager "Murugan Babu", Place of Tax "METRO"',
      '4. Fills Personal tab: Email "priya.sharma@testmail.com", Phone "9876543210"',
      '5. Clicks Save — notes down the temporary password displayed',
      '6. Chitra logs in, goes to Shift Assign, assigns "General Shift" to Priya from April 1',
      '7. Chitra goes to Rights Allocation, allocates EL: 18 days, SL: 12 days to Priya',
      '8. Priya logs in with the temporary password',
    ],
    expected: [
      'At each step, the operation succeeds',
      'Priya\'s dashboard shows leave balance EL: 18, SL: 12',
      'Attendance calendar ready to track against General Shift',
      'She can apply leave that will route to Murugan',
    ],
  },
  {
    id: 'TC-12.2',
    title: 'Complete Leave Request and Approval Scenario',
    roles: [TEST_USERS.employee.role, TEST_USERS.manager.role],
    steps: [
      '1. Ambika logs in, goes to /attendance, clicks "Apply Leave"',
      '2. Selects EL, From: April 7, To: April 9, Reason: "Family wedding celebration"',
      '3. Submits — sees success banner, calendar shows pending indicators',
      '4. Murugan logs in, goes to /event/approvals',
      '5. Sees Ambika\'s request: 3 days EL, April 7-9',
      '6. Enters remark: "Approved!" and clicks Approve',
      '7. Ambika logs back in, checks leave balance and calendar',
    ],
    expected: [
      'Ambika\'s EL balance reduced by 3 (e.g., 18 → 15)',
      'Calendar shows April 7-9 as approved EL (green)',
      'Murugan\'s pending queue no longer shows this request',
    ],
  },
  {
    id: 'TC-12.3',
    title: 'HR Direct Assignment Scenario',
    roles: [TEST_USERS.hrAdmin.role],
    steps: [
      '1. Chitra logs in, goes to /attendance, selects Ambika',
      '2. Notices Ambika was absent on March 28 with no leave applied',
      '3. Clicks "Apply Event on behalf"',
      '4. Blue banner confirms auto-approval. Selects SL, Date: March 28, Reason: "Sick leave - applied by HR"',
      '5. Submits',
    ],
    expected: [
      'Leave created with APPROVED status immediately',
      'NO PENDING state',
      'Ambika\'s SL balance deducted by 1',
      'March 28 shows as approved SL on calendar',
    ],
  },
  {
    id: 'TC-12.4',
    title: 'Bulk Upload with Error and Retry Scenario',
    roles: [TEST_USERS.hrAdmin.role],
    steps: [
      '1. Chitra downloads the 49-column template',
      '2. Fills 10 rows but types "Engg" instead of "Engineering" in row 7',
      '3. Uploads — gets validation failure',
      '4. Sees error: "Row 7: Department \'Engg\' not found"',
      '5. Fixes row 7 to "Engineering" in the Excel file',
      '6. Re-uploads the corrected file',
    ],
    expected: [
      'First upload fails completely (all-or-nothing) — zero employees created',
      'After fix, second upload succeeds: "10 employees created, 0 failed"',
    ],
  },
  {
    id: 'TC-12.5',
    title: 'Multi-Level Approval Scenario',
    roles: [TEST_USERS.employee.role, TEST_USERS.manager.role, TEST_USERS.hrAdmin.role],
    steps: [
      '1. Ambika applies 5 days EL (April 14-18)',
      '2. Request goes to Level 1 — Murugan\'s queue',
      '3. Murugan approves at Level 1',
      '4. Request advances to Level 2 — Chitra\'s queue',
      '5. Chitra approves at Level 2 (final)',
    ],
    expected: [
      'After Murugan approves, request moves from his queue to Chitra\'s queue',
      'After Chitra approves, status becomes APPROVED',
      'Ambika\'s EL deducted by 5',
      'Full approval chain recorded',
      'If Murugan had rejected, request would be immediately REJECTED without reaching Chitra',
    ],
  },
  {
    id: 'TC-12.6',
    title: 'Permission Request Scenario',
    roles: [TEST_USERS.employee.role, TEST_USERS.manager.role],
    steps: [
      '1. Ambika clicks "Apply Permission" from attendance page',
      '2. Date: March 31, From Time: 15:00, To Time: 16:30, Reason: "Doctor appointment"',
      '3. Submits — goes to PENDING',
      '4. Murugan approves',
    ],
    expected: [
      'Reason stored as "[Permission 15:00-16:30] Doctor appointment"',
      'After approval, March 31 calendar cell shows "Permission 3:00 PM - 4:30 PM" badge',
    ],
  },
  {
    id: 'TC-12.7',
    title: 'Manager On-Behalf WFH Assignment Scenario',
    roles: [TEST_USERS.manager.role],
    steps: [
      '1. Murugan goes to attendance, selects Ambika from team dropdown',
      '2. Clicks "Apply Event on behalf"',
      '3. Banner: "auto-approved (Manager Direct Assignment)"',
      '4. Selects WFH, Date: April 10, Reason: "WFH assigned by manager"',
      '5. Submits',
    ],
    expected: [
      'Auto-approved via /leaves/hr-assign',
      'No PENDING state',
      'April 10 shows WFH on Ambika\'s calendar immediately',
    ],
  },
];

// ============================================================================
// EXPORT ALL TEST CASES
// ============================================================================

const ALL_TEST_CASES = {
  organization: ORGANIZATION,
  testUsers: TEST_USERS,
  sections: [
    { id: 'TC-1', title: 'Login Flow', count: TC_1_LOGIN_FLOW.length, cases: TC_1_LOGIN_FLOW },
    { id: 'TC-2', title: 'Employee Add Flow', count: TC_2_EMPLOYEE_ADD_FLOW.length, cases: TC_2_EMPLOYEE_ADD_FLOW },
    { id: 'TC-3', title: 'Employee Edit Flow', count: TC_3_EMPLOYEE_EDIT_FLOW.length, cases: TC_3_EMPLOYEE_EDIT_FLOW },
    { id: 'TC-4', title: 'Bulk Upload Flow', count: TC_4_BULK_UPLOAD_FLOW.length, cases: TC_4_BULK_UPLOAD_FLOW },
    { id: 'TC-5', title: 'Shift Creation & Assignment', count: TC_5_SHIFT_FLOW.length, cases: TC_5_SHIFT_FLOW },
    { id: 'TC-6', title: 'Leave Component & Assignment', count: TC_6_LEAVE_COMPONENT_FLOW.length, cases: TC_6_LEAVE_COMPONENT_FLOW },
    { id: 'TC-7', title: 'Employee Leave Apply', count: TC_7_LEAVE_APPLY_FLOW.length, cases: TC_7_LEAVE_APPLY_FLOW },
    { id: 'TC-8', title: 'Manager Approval & Rejection', count: TC_8_MANAGER_APPROVAL_FLOW.length, cases: TC_8_MANAGER_APPROVAL_FLOW },
    { id: 'TC-9', title: 'HR & Super Admin Approval', count: TC_9_HR_SUPER_ADMIN_APPROVAL_FLOW.length, cases: TC_9_HR_SUPER_ADMIN_APPROVAL_FLOW },
    { id: 'TC-10', title: 'Attendance Tracking', count: TC_10_ATTENDANCE_FLOW.length, cases: TC_10_ATTENDANCE_FLOW },
    { id: 'TC-11', title: 'RBAC Visibility & Permissions', count: TC_11_RBAC_VERIFICATION.length, cases: TC_11_RBAC_VERIFICATION },
    { id: 'TC-12', title: 'End-to-End Scenarios', count: TC_12_END_TO_END_SCENARIOS.length, cases: TC_12_END_TO_END_SCENARIOS },
  ],
};

// Print summary
const totalCases = ALL_TEST_CASES.sections.reduce((sum, s) => sum + s.count, 0);
console.log('='.repeat(70));
console.log('HRMS Frontend Flow — Test Case Summary');
console.log('='.repeat(70));
console.log(`Organization : ${ALL_TEST_CASES.organization.name}`);
console.log(`Total Sections : ${ALL_TEST_CASES.sections.length}`);
console.log(`Total Test Cases : ${totalCases}`);
console.log('-'.repeat(70));
ALL_TEST_CASES.sections.forEach((s) => {
  console.log(`  ${s.id.padEnd(7)} ${s.title.padEnd(40)} ${s.count} cases`);
});
console.log('='.repeat(70));

module.exports = ALL_TEST_CASES;
