# HRMS Frontend Flow — Complete End-to-End Test Cases

**Organization**: Infosys
**Test Users**: Aakkash (Super Admin), Chitra (HR Admin), Murugan (Manager), Ambika (Employee)

---

## TC-1: LOGIN FLOW

### TC-1.1: Company Verification — Valid Company
**Role**: Any user
**Precondition**: Application is open at `/login`
**Steps**: Enter "Infosys" in the Company Name field and click Verify.
**Expected**: The company is verified successfully. The login form expands to show Email and Password fields. No error message is displayed.

### TC-1.2: Company Verification — Invalid Company
**Role**: Any user
**Precondition**: Application is open at `/login`
**Steps**: Enter "XYZCorp" in the Company Name field and click Verify.
**Expected**: An error message "Company not found" is displayed. Email and Password fields do NOT appear. The user cannot proceed further.

### TC-1.3: Company Verification — Empty Company Name
**Role**: Any user
**Precondition**: Application is open at `/login`
**Steps**: Leave the Company Name field empty and click Verify.
**Expected**: Validation error is shown. The form does not submit.

### TC-1.4: Super Admin Login — Valid Credentials
**Role**: Aakkash (Super Admin)
**Precondition**: Company "Infosys" is verified successfully
**Steps**: Enter email "Aakkash.T.M@bncmotors.in" and password "mO%%DJuWq6" and click Login.
**Expected**: Login succeeds. Four tokens (HRMS accessToken, HRMS refreshToken, Configurator accessToken, Configurator refreshToken) and the user object are stored in localStorage. The user is redirected to `/dashboard`. The sidebar shows ALL modules including Dashboard, Employees, Departments, Positions, Organizations, Module Permission, Core HR, Event Configuration, Time Attendance, Leave, Attendance, Payroll, Reports, Statutory Compliance, ESOP. An organization selector dropdown is visible in the header/sidebar.

### TC-1.5: HR Admin Login — Valid Credentials
**Role**: Chitra (HR Admin)
**Precondition**: Company "Infosys" is verified successfully
**Steps**: Enter email "chitra.rajan199@testmail.com" and password "anoOw0#HL!" and click Login.
**Expected**: Login succeeds. User is redirected to `/dashboard`. The sidebar shows Dashboard, Employees, Departments, Positions, Core HR, Event Configuration, Time Attendance, Leave, Attendance, Payroll, Reports. The sidebar does NOT show Organizations or Module Permission pages. All data is scoped to Infosys organization only — no org switcher is visible.

### TC-1.6: Manager Login — Valid Credentials
**Role**: Murugan (Manager)
**Precondition**: Company "Infosys" is verified successfully
**Steps**: Enter email "murugan.babu198@testmail.com" and password "#zhzY!cmQ%" and click Login.
**Expected**: Login succeeds. User is redirected to `/dashboard`. The sidebar shows only Dashboard, Employees (team view), Attendance, Leave/Apply Event, Event Approvals. The sidebar does NOT show Event Configuration, Shift Master, Approval Workflow, Payroll, Reports, or any admin-level modules. The dashboard shows team-level statistics (team present count, team leave count, pending approvals).

### TC-1.7: Employee Login — Valid Credentials
**Role**: Ambika (Employee)
**Precondition**: Company "Infosys" is verified successfully
**Steps**: Enter email "ambika.reddy195@testmail.com" and password "yqjBVfUkfV" and click Login.
**Expected**: Login succeeds. User is redirected to `/dashboard`. The sidebar shows only Dashboard, Profile, Attendance (own calendar), Leave/Apply Event. The sidebar does NOT show Employees list, Departments, any configuration modules, any approval pages, or any admin modules. The dashboard shows personal data — own attendance summary, own leave balance, own recent leave requests.

### TC-1.8: Login — Invalid Password
**Role**: Any user
**Precondition**: Company "Infosys" is verified successfully
**Steps**: Enter a valid email with an incorrect password and click Login.
**Expected**: Login fails. An error message like "Invalid credentials" or "Incorrect password" is displayed. The user remains on the login page. No tokens are stored in localStorage.

### TC-1.9: Login — Invalid Email
**Role**: Any user
**Precondition**: Company "Infosys" is verified successfully
**Steps**: Enter a non-existent email "random@testmail.com" with any password and click Login.
**Expected**: Login fails. An error message is displayed. The user remains on the login page.

### TC-1.10: Session Persistence After Page Refresh
**Role**: Any logged-in user
**Precondition**: User is already logged in and on the dashboard
**Steps**: Refresh the browser page (F5).
**Expected**: The user remains logged in. The dashboard reloads. The ProtectedRoute component reads the tokens from localStorage, the Zustand auth store rehydrates, and the user is NOT redirected to the login page. The sidebar modules remain the same as before refresh.

### TC-1.11: Logout Flow
**Role**: Any logged-in user
**Precondition**: User is logged in
**Steps**: Click the logout button/option in the header or user menu.
**Expected**: All four tokens and the user object are cleared from localStorage. The user is redirected to `/login`. Attempting to navigate to `/dashboard` directly via URL redirects back to `/login`.

### TC-1.12: Unauthenticated Route Access
**Role**: Unauthenticated user
**Precondition**: No user is logged in (localStorage is clear)
**Steps**: Navigate directly to `/dashboard` via the browser URL bar.
**Expected**: The ProtectedRoute component detects isAuthenticated is false and redirects the user to `/login`.

### TC-1.13: Role Normalization
**Role**: Any user
**Precondition**: User logs in and the Configurator returns a role with prefix like "HRMS001_SUPER_ADMIN"
**Steps**: Login and inspect the normalized role stored in the auth store.
**Expected**: The role is normalized to "SUPER_ADMIN" (prefix stripped). All RBAC checks throughout the application use this normalized role.

---

## TC-2: EMPLOYEE ADD FLOW

### TC-2.1: Create Employee Button Visibility — Super Admin
**Role**: Aakkash (Super Admin)
**Precondition**: Aakkash is logged in and navigates to `/employees`
**Steps**: Observe the Employees page.
**Expected**: The "Create Employee" button is visible. The "Import" button is also visible. Both buttons are clickable.

### TC-2.2: Create Employee Button Visibility — HR Admin
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is logged in and navigates to `/employees`
**Steps**: Observe the Employees page.
**Expected**: The "Create Employee" button is visible. The "Import" button is also visible.

### TC-2.3: Create Employee Button Visibility — Manager
**Role**: Murugan (Manager)
**Precondition**: Murugan is logged in and navigates to `/employees`
**Steps**: Observe the Employees page.
**Expected**: The "Create Employee" button is NOT visible. The "Import" button is NOT visible. The "Delete" button is NOT visible on any row. Murugan can only view employees in his team.

### TC-2.4: Create Employee Button Visibility — Employee
**Role**: Ambika (Employee)
**Precondition**: Ambika is logged in
**Steps**: Attempt to navigate to `/employees`.
**Expected**: Ambika either cannot see the Employees page in her sidebar, or if she navigates via URL, she sees a very restricted view with NO create, edit, or delete buttons. She may be redirected to her own profile.

### TC-2.5: Paygroup Selection Modal
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on `/employees` and clicks "Create Employee"
**Steps**: Observe the modal that appears before the form.
**Expected**: A Paygroup Selection Modal appears showing all paygroups configured for Infosys (e.g., "Monthly"). Chitra must select a paygroup before proceeding. The employee form does NOT load until a paygroup is selected. Clicking Cancel or closing the modal returns to the employee list.

### TC-2.6: Employee Form — Company Details Tab Validation (All Required Fields Empty)
**Role**: Chitra (HR Admin)
**Precondition**: Paygroup is selected and the employee form is open in create mode
**Steps**: Leave all fields empty on the Company Details tab and click Save.
**Expected**: Validation errors appear for: First Name ("required, min 2 chars"), Date of Birth ("required"), Gender ("required"), Date of Joining ("required"), Department ("required"), Designation ("required"), Place of Tax Deduction ("required"). The form does NOT submit.

### TC-2.7: Employee Form — Company Details Tab Validation (First Name Too Short)
**Role**: Chitra (HR Admin)
**Precondition**: Employee form is open in create mode
**Steps**: Enter "A" (1 character) in First Name. Fill all other required fields correctly. Click Save.
**Expected**: Validation error on First Name: "Minimum 2 characters required." The form does NOT submit.

### TC-2.8: Employee Form — Personal Tab Validation (Invalid Email)
**Role**: Chitra (HR Admin)
**Precondition**: Employee form is open, Personal Information tab is active
**Steps**: Enter "invalid-email" in the Email field (without @ symbol). Fill Phone Number. Click Save.
**Expected**: Validation error on Email: "Must be a valid email format." The form does NOT submit.

### TC-2.9: Employee Form — Personal Tab Validation (Missing Phone)
**Role**: Chitra (HR Admin)
**Precondition**: Employee form is open, Personal Information tab is active
**Steps**: Fill Email correctly but leave Phone Number empty. Click Save.
**Expected**: Validation error on Phone Number: "Required." The form does NOT submit.

### TC-2.10: Employee Form — Successful Creation with Minimum Required Fields
**Role**: Chitra (HR Admin)
**Precondition**: Employee form is open in create mode
**Steps**: Fill Company tab — First Name: "Ravi", Gender: "Male", DOB: "1990-01-15", DOJ: "2026-04-01", Department: "Engineering", Designation: "Developer", Place of Tax Deduction: "METRO". Fill Personal tab — Email: "ravi.kumar@testmail.com", Phone: "9876543210". Click Save.
**Expected**: The frontend sends POST to `/api/v1/employees`. The employee is created successfully. A temporary password is displayed on screen. The UI shows success message. Navigating to `/employees` shows the new employee "Ravi" in the list.

### TC-2.11: Employee Form — Duplicate Email Rejection
**Role**: Chitra (HR Admin)
**Precondition**: Employee "Ravi" with email "ravi.kumar@testmail.com" already exists
**Steps**: Create another employee with the same email "ravi.kumar@testmail.com".
**Expected**: The backend returns an error. The frontend shows an error banner: "Email already exists" or similar. The employee is NOT created.

### TC-2.12: Employee Form — Inline Master Creation (Department Not Found)
**Role**: Chitra (HR Admin)
**Precondition**: Employee form is open in create mode
**Steps**: In the Department dropdown, search for "Marketing" which does not exist. Observe the option to create a new department inline.
**Expected**: An option or button like "Create New Department" appears. Clicking it opens an inline modal where Chitra can enter the new department name and save it. After saving, the new department appears in the dropdown and is automatically selected.

### TC-2.13: Employee Form — All 11 Tabs Are Navigable
**Role**: Chitra (HR Admin)
**Precondition**: Employee form is open in create mode
**Steps**: Click through all 11 tabs: Company Details, Personal Information, Statutory Details, Bank Details, Salary Details, Assets Management, Academic Qualifications, Previous Employment, Family Members, Others, ESOP Records.
**Expected**: All 11 tabs are clickable and each renders its respective form fields. The ESOP tab shows a read-only section. Switching tabs does NOT lose data entered in other tabs.

### TC-2.14: Employee Form — Reporting Manager Dropdown
**Role**: Chitra (HR Admin)
**Precondition**: Employee form is open, Company Details tab
**Steps**: Click the Reporting Manager dropdown and search for "Murugan".
**Expected**: A searchable dropdown appears showing employees who can be managers. "Murugan Babu" appears in the results. Selecting him sets Murugan as the reporting manager for the new employee.

### TC-2.15: Super Admin — Organization Selector on Employee Create
**Role**: Aakkash (Super Admin)
**Precondition**: Aakkash is on `/employees`
**Steps**: Observe whether an organization selector is available. Switch to a different organization and click "Create Employee."
**Expected**: Aakkash sees an organization selector/switcher. He can switch to another organization and create employees there. The departments, positions, and paygroups shown in the form correspond to the selected organization.

---

## TC-3: EMPLOYEE EDIT FLOW

### TC-3.1: Edit Button Visibility — HR Admin
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on `/employees` viewing the employee list
**Steps**: Observe the action buttons on each employee row.
**Expected**: An "Edit" button/icon is visible on each employee row because Chitra has the `can_edit` permission for employees.

### TC-3.2: Edit Button Visibility — Employee
**Role**: Ambika (Employee)
**Precondition**: Ambika navigates to her own profile
**Steps**: Observe the page.
**Expected**: The profile is displayed in read-only (view) mode. There is NO "Edit" button. Ambika cannot modify any of her own data.

### TC-3.3: Edit Employee — Pre-populated Data
**Role**: Chitra (HR Admin)
**Precondition**: Chitra clicks Edit on Ambika's row in the employee list
**Steps**: Observe the employee form that loads.
**Expected**: The form navigates to `/employees/edit/:id`. All fields are pre-populated with Ambika's existing data — her first name, last name, email, department, designation, DOB, DOJ, etc. All tabs contain Ambika's data.

### TC-3.4: Edit Employee — Partial Update
**Role**: Chitra (HR Admin)
**Precondition**: Edit form for Ambika is open
**Steps**: Change only the Phone Number from "9876543210" to "9876543999". Click Save.
**Expected**: The frontend sends PUT to `/api/v1/employees/:id` with only the changed field. The update succeeds. The UI shows "Employee updated successfully." Ambika's phone number is now "9876543999" in the system.

### TC-3.5: Edit Employee — Tab-Level RBAC for Manager
**Role**: Murugan (Manager)
**Precondition**: Murugan navigates to `/employees/edit/:id` for a team member (if edit permission is configured)
**Steps**: Observe which tabs are editable and which are read-only.
**Expected**: Murugan may be able to edit the Company Details tab but the Salary tab and Statutory tab render in read-only mode because he does not have `employee_salary.update` or `employee_statutory.update` permissions.

### TC-3.6: View Mode — Employee Views Own Profile
**Role**: Ambika (Employee)
**Precondition**: Ambika navigates to `/employees/view/:id` (her own ID)
**Steps**: Observe the form.
**Expected**: All fields are displayed but NONE are editable. There is no Save button. All tabs show data in read-only mode. There is no "Edit" button at the top because Ambika's role does not have edit permission.

### TC-3.7: Password Reset — HR Admin
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on the Employees page
**Steps**: Click the "Reset Password" action on Ambika's row.
**Expected**: A confirmation modal appears. After confirming, the backend generates a new password. The modal displays the new temporary password. Chitra notes it down to share with Ambika.

### TC-3.8: Role Change — HR Admin
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on the Employees page
**Steps**: Click the "Change Role" action on an employee row.
**Expected**: A modal appears with a dropdown showing all Configurator roles (Employee, Manager, HR Admin, etc.). Chitra selects a new role (e.g., "Manager") and saves. The employee's role is updated in both HRMS and the Configurator.

### TC-3.9: Soft Delete — HR Admin
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on the Employees page
**Steps**: Click the "Delete" action on an employee row.
**Expected**: A confirmation modal appears. After confirming, the employee's status is set to "SEPARATED" (soft delete). The employee record is NOT permanently deleted. When filtering by "Separated" status, the employee still appears. The employee can no longer log in.

### TC-3.10: Face Encoding Update
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on the Employees page
**Steps**: Click the "Update Face" action on Ambika's row.
**Expected**: The FaceCapture component opens, activating the webcam. Chitra positions Ambika's face in the camera. A capture button saves the face encoding (128-float array). The encoding is sent to the backend and stored for biometric attendance matching.

---

## TC-4: BULK UPLOAD FLOW

### TC-4.1: Import Button Visibility — HR Admin
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on `/employees`
**Steps**: Observe the page.
**Expected**: The "Import" button is visible next to the "Create Employee" button.

### TC-4.2: Import Button Visibility — Manager/Employee
**Role**: Murugan (Manager) / Ambika (Employee)
**Precondition**: User is on `/employees`
**Steps**: Observe the page.
**Expected**: The "Import" button is NOT visible.

### TC-4.3: Download Template
**Role**: Chitra (HR Admin)
**Precondition**: Chitra navigates to `/employees/import`
**Steps**: Click the "Download Template" button.
**Expected**: An Excel (.xlsx) file downloads with 49 predefined column headers: S.No, Paygroup, Associate Code, Associate First Name, Associate Last Name, Gender, Department, Sub Department, Cost Centre, Designation, Role, Father Name, Blood Group, Date of Birth, Date of Joining, Pan Card Number, Bank Name, Account No, Bank IFSC Code, Permanent E-Mail Id, Official E-Mail Id, and all other columns. The file is empty except for the header row.

### TC-4.4: File Upload — Valid Excel File
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on `/employees/import`
**Steps**: Drag and drop a valid .xlsx file with 5 employee rows onto the upload zone. All required fields (Name, Email, DOJ, DOB, Gender, Department, Sub Dept, Cost Centre, Paygroup, Place of Tax Deduction) are filled correctly with exact matches to master data.
**Expected**: The file name appears in the upload zone. The "Upload" button becomes active. After clicking Upload, the UI shows a "Validating" spinner. After validation passes, a green success banner appears: "5 employees created, 0 failed." Navigating to the employee list shows 5 new employees.

### TC-4.5: File Upload — Invalid File Type
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on `/employees/import`
**Steps**: Try to upload a .pdf or .doc file.
**Expected**: The system rejects the file. An error message appears: "Only .xlsx, .xls, and .csv files are accepted."

### TC-4.6: File Upload — Oversized File
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on `/employees/import`
**Steps**: Try to upload a file larger than 50 MB.
**Expected**: The system rejects the file. An error message about file size limit is displayed.

### TC-4.7: Bulk Upload — All-or-Nothing Validation Failure
**Role**: Chitra (HR Admin)
**Precondition**: Excel file has 10 rows, but row 7 has Department "Engg" (which doesn't match "Engineering" in Configurator)
**Steps**: Upload the file.
**Expected**: The entire upload fails. ZERO employees are created. The UI shows a "Validation Failed" state with a red banner. An error table displays: "Row 7: Department 'Engg' not found in Configurator." All other rows are NOT processed even if they are valid.

### TC-4.8: Bulk Upload — Missing Required Field
**Role**: Chitra (HR Admin)
**Precondition**: Excel file has rows where Email column is empty for some rows
**Steps**: Upload the file.
**Expected**: Validation fails for the rows with missing email. Since it is all-or-nothing, the entire upload is rejected. Error table lists each failed row with the message about missing email.

### TC-4.9: Bulk Upload — Flexible Date Parsing
**Role**: Chitra (HR Admin)
**Precondition**: Excel file has DOB in various formats — "1990-01-15", "15/01/1990", "Jan 15, 1990", and an Excel serial date number
**Steps**: Upload the file.
**Expected**: All date formats are parsed correctly. The dates are converted to ISO format. The upload succeeds if all other fields are valid.

### TC-4.10: Bulk Upload — Reporting Manager Resolution
**Role**: Chitra (HR Admin)
**Precondition**: Excel file has "Reporting Manager" column filled with "Murugan Babu" for several employees. Murugan already exists in the system.
**Steps**: Upload the file.
**Expected**: After employee creation (first pass), the system performs a second pass to resolve reporting managers by matching the name "Murugan Babu" to the existing employee record. The success response includes `managersSet: N` indicating how many reporting managers were successfully linked.

### TC-4.11: Bulk Upload — Salary Record Creation
**Role**: Chitra (HR Admin)
**Precondition**: Excel file has "Fixed Gross" column filled with values like "50000". The `createSalaryRecords` option is enabled.
**Steps**: Upload the file with salary creation enabled.
**Expected**: After employee creation, a third pass creates salary records for each employee using the Fixed Gross value. The salary records appear when viewing the employee's Salary tab.

### TC-4.12: Bulk Upload — Success Response Details
**Role**: Chitra (HR Admin)
**Precondition**: Upload of 10 valid employee rows succeeds
**Steps**: Observe the success response.
**Expected**: The green banner shows: total: 10, success: 10 (or success + updated), failed: 0, managersSet count, and configuratorSyncStatus: "success". The UI clearly communicates how many records were created, updated, skipped, or failed.

---

## TC-5: SHIFT CREATION AND ASSIGNMENT FLOW

### TC-5.1: Shift Master Page — Access by HR Admin
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is logged in
**Steps**: Navigate to `/time-attendance/shift-master`.
**Expected**: The Shift Master page loads showing a list of existing shifts. A "Create Shift" button is visible.

### TC-5.2: Shift Master Page — Access Denied for Employee
**Role**: Ambika (Employee)
**Precondition**: Ambika is logged in
**Steps**: Attempt to navigate to `/time-attendance/shift-master` via URL.
**Expected**: Ambika is redirected to the dashboard or sees an access denied state. The Shift Master page is not accessible.

### TC-5.3: Create Shift — General Shift
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on the Shift Master page
**Steps**: Click "Create Shift." Enter: Shift Name "General Shift", Shift Code "GS", Start Time "09:00", End Time "18:00", First Half End "13:00", Second Half Start "14:00", Break Duration "60 minutes", Work Hours "8", Grace Period "15 minutes." Toggle Overtime Enabled as needed. Click Save.
**Expected**: The shift is created successfully. "General Shift" appears in the shift master list with all the configured times displayed.

### TC-5.4: Create Shift — Validation (Missing Required Fields)
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on the Create Shift form
**Steps**: Leave Shift Name and Start Time empty. Click Save.
**Expected**: Validation errors appear for required fields. The shift is NOT created.

### TC-5.5: Assign Shift to Employee
**Role**: Chitra (HR Admin)
**Precondition**: "General Shift" exists. Chitra navigates to `/time-attendance/shift-assign`.
**Steps**: Click "Create Assignment." Select "General Shift" from the shift dropdown. Select Ambika from the employee multi-select. Set Effective Date to "2026-04-01". Set Priority to 1. Click Save.
**Expected**: The shift assignment rule is created. Ambika's attendance will now be tracked against the General Shift timings from April 1 onwards.

### TC-5.6: Bulk Shift Assignment via Grid
**Role**: Chitra (HR Admin)
**Precondition**: Chitra navigates to `/time-attendance/associate-shift-grid`
**Steps**: Observe the grid with employees as rows and dates as columns. Assign "General Shift" to multiple employees for the same date range.
**Expected**: The grid allows visual selection and assignment. After saving, all selected employees have the shift assigned for the selected dates.

### TC-5.7: Shift Change for Individual Employee
**Role**: Chitra (HR Admin)
**Precondition**: Ambika is currently assigned to "General Shift"
**Steps**: Navigate to `/time-attendance/associate-shift-change`. Select Ambika and change her shift to "Night Shift" (if it exists) from a specific date.
**Expected**: Ambika's shift assignment is updated. Her attendance from the new effective date is tracked against the new shift timings.

---

## TC-6: LEAVE COMPONENT CREATION AND ASSIGNMENT FLOW

### TC-6.1: Create Attendance Component — EL
**Role**: Chitra (HR Admin)
**Precondition**: Chitra navigates to `/event-configuration/attendance-components`
**Steps**: Click "Create Component." Enter: Event Name "Earned Leave", Short Name "EL", Event Category "Leave", Authorized: Yes, Consider As Work Hours: Yes, Has Balance: Yes, Allow Datewise: Yes, Allow Hourly: No, Requires Approval: Yes. Click Save.
**Expected**: The "Earned Leave" attendance component is created and appears in the components list.

### TC-6.2: Create Attendance Component — Permission (Hourly Type)
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is on the attendance components page
**Steps**: Click "Create Component." Enter: Event Name "Permission", Short Name "PERM", Event Category "Permission", Allow Hourly: Yes, Allow Datewise: No, Requires Approval: Yes. Click Save.
**Expected**: The "Permission" component is created. Its Allow Hourly flag is Yes and Allow Datewise is No, meaning this component works on time-based entries within a single day.

### TC-6.3: Create Leave Type — EL with Balance Rules
**Role**: Chitra (HR Admin)
**Precondition**: Chitra navigates to `/event/leave-type` or `/event/leave-type/create`
**Steps**: Click "Create Leave Type." Enter: Name "Earned Leave", Code "EL", Default Days Per Year: 18, Is Paid: Yes, Max Carry Forward: 15, Accrual Type: Monthly, Requires Approval: Yes, Can Be Negative: No. Click Save.
**Expected**: The EL leave type is created. It will accrue 1.5 days per month (18/12), allow carry forward up to 15 days, and require approval for all requests.

### TC-6.4: Create Leave Type — SL with No Carry Forward
**Role**: Chitra (HR Admin)
**Steps**: Create leave type: Name "Sick Leave", Code "SL", Default Days Per Year: 12, Is Paid: Yes, Max Carry Forward: 0, Accrual Type: Monthly. Click Save.
**Expected**: The SL leave type is created with 0 carry forward, meaning unused SL days are lost at year-end.

### TC-6.5: Rights Allocation — Assign EL Balance to Employees
**Role**: Chitra (HR Admin)
**Precondition**: EL leave type exists. Chitra navigates to `/event-configuration/rights-allocation`.
**Steps**: Create an allocation for Paygroup "Monthly", Leave Type "EL", Opening Balance: 18 days for the year 2026.
**Expected**: EmployeeLeaveBalance records are created for all employees in the "Monthly" paygroup. Each employee gets 18 EL days as opening balance. When Ambika checks her leave balance, she sees EL: 18 available.

### TC-6.6: Event Balance Entry — Manual Balance Adjustment
**Role**: Chitra (HR Admin)
**Precondition**: Chitra navigates to `/event/balance-entry`
**Steps**: Search for Ambika. View her EL balance. Manually adjust the opening balance from 18 to 20.
**Expected**: Ambika's EL opening balance is updated to 20. The available balance recalculates as: 20 (opening) + accrued + carried forward - used.

### TC-6.7: Configure Approval Workflow
**Role**: Chitra (HR Admin)
**Precondition**: Chitra navigates to `/event-configuration/approval-workflow`
**Steps**: Create a workflow with type "Leave Approval" and define it to handle Leave events.
**Expected**: The approval workflow is created and available for mapping.

### TC-6.8: Configure Workflow Mapping — Single Level
**Role**: Chitra (HR Admin)
**Precondition**: Approval workflow exists. Chitra navigates to `/event-configuration/workflow-mapping`.
**Steps**: Create a mapping linking the workflow to the "Engineering" department with approval Level 1 = Reporting Manager. Set priority to 1.
**Expected**: The mapping is created. When any employee in the Engineering department applies for leave, the request will route to their reporting manager for approval.

### TC-6.9: Configure Workflow Mapping — Multi-Level
**Role**: Chitra (HR Admin)
**Steps**: Create a mapping with approval Level 1 = Reporting Manager, Level 2 = HR. Link to Engineering department.
**Expected**: Leave requests from Engineering employees will first go to their reporting manager, and after manager approval, advance to HR for final approval.

### TC-6.10: Access Denied — Employee Tries to Access Event Configuration
**Role**: Ambika (Employee)
**Steps**: Attempt to navigate to `/event-configuration/attendance-components` via URL.
**Expected**: Ambika is redirected to dashboard. She cannot access any configuration pages.

---

## TC-7: EMPLOYEE LEAVE APPLY FLOW

### TC-7.1: Apply Leave — Full Day EL
**Role**: Ambika (Employee)
**Precondition**: Ambika is logged in, has EL balance of 18 days, workflow is configured
**Steps**: Navigate to `/attendance`. Click "Apply Leave." Select "Earned Leave" from Type dropdown. Enter From Date: "2026-04-07", To Date: "2026-04-09", Duration: Full Day, Reason: "Family wedding celebration and travel." Click Submit.
**Expected**: The frontend validates all fields pass. POST is sent to `/api/v1/leaves/requests`. A PENDING leave request is created with totalDays: 3. The request is assigned to Murugan (reporting manager) at approval Level 1. Ambika is redirected to `/attendance` with a green success banner "Leave applied successfully!" Calendar shows pending indicators on April 7, 8, 9.

### TC-7.2: Apply Leave — Balance Hint Display
**Role**: Ambika (Employee)
**Precondition**: Ambika has EL balance: opening 18, used 3, available 15
**Steps**: On Apply Event page, select "Earned Leave" from Type dropdown.
**Expected**: A balance hint is displayed showing: Opening Balance: 18, Used: 3, Available: 15. Ambika can see her remaining balance before submitting the request.

### TC-7.3: Apply Leave — Half Day (First Half)
**Role**: Ambika (Employee)
**Steps**: Select "Earned Leave", From Date: "2026-04-10", To Date: "2026-04-10", Duration: "First Half", Reason: "Personal work in the morning." Click Submit.
**Expected**: The system calculates totalDays as 0.5. The reason is stored as "[First Half] Personal work in the morning." The request is created with 0.5 days. On the calendar, April 10 shows a "First Half" label.

### TC-7.4: Apply Leave — Half Day (Second Half)
**Role**: Ambika (Employee)
**Steps**: Same as above but select "Second Half" duration.
**Expected**: totalDays is 0.5. Reason prepended with "[Second Half]". Calendar shows "Second Half" badge.

### TC-7.5: Apply Leave — Validation: Missing Leave Type
**Role**: Ambika (Employee)
**Steps**: Leave the Type dropdown empty. Fill other fields. Click Submit.
**Expected**: Validation error: "Please select a leave type." The form does NOT submit.

### TC-7.6: Apply Leave — Validation: Missing Start Date
**Role**: Ambika (Employee)
**Steps**: Select a leave type. Leave From Date empty. Fill other fields. Click Submit.
**Expected**: Validation error: "Please select a start date." The form does NOT submit.

### TC-7.7: Apply Leave — Validation: End Date Before Start Date
**Role**: Ambika (Employee)
**Steps**: Select From Date: "2026-04-10", To Date: "2026-04-08". Click Submit.
**Expected**: Validation error: "End date must be greater than or equal to start date." The form does NOT submit.

### TC-7.8: Apply Leave — Validation: Reason Too Short
**Role**: Ambika (Employee)
**Steps**: Fill all fields correctly but enter Reason: "sick" (less than 10 characters). Click Submit.
**Expected**: Validation error: "Reason must be at least 10 characters long." The form does NOT submit.

### TC-7.9: Apply Leave — Insufficient Balance
**Role**: Ambika (Employee)
**Precondition**: Ambika has only 2 EL days remaining
**Steps**: Apply for 5 days of EL.
**Expected**: The backend returns an error: "Insufficient leave balance." The frontend displays a red error banner with this message. The request is NOT created.

### TC-7.10: Apply Leave — No Workflow Configured
**Role**: Ambika (Employee)
**Precondition**: No approval workflow mapping exists for Ambika's department/paygroup
**Steps**: Apply for leave.
**Expected**: The backend returns an error: "No approval workflow configured." The frontend displays the error. The request is NOT created.

### TC-7.11: Apply Permission — Time-Based
**Role**: Ambika (Employee)
**Steps**: Click "Apply Permission" from Attendance page. The Permission component is pre-selected. Enter Date: "2026-03-31", From Time: "15:00", To Time: "16:30", Reason: "Doctor appointment at hospital." Click Submit.
**Expected**: The reason is stored as "[Permission 15:00-16:30] Doctor appointment at hospital." The request is created as PENDING. On the calendar, after approval, March 31 shows "Permission 3:00 PM - 4:30 PM" badge.

### TC-7.12: Apply On Duty
**Role**: Ambika (Employee)
**Steps**: Click "Apply On Duty" from Attendance page. Select "On Duty" component. Enter From Date: "2026-04-12", To Date: "2026-04-12", Reason: "Client site visit for project demo." Click Submit.
**Expected**: The reason is stored as "[Onduty On Duty] Client site visit for project demo." The request is created as PENDING. On the calendar, April 12 shows OD indicator after approval.

### TC-7.13: View Own Leave Requests
**Role**: Ambika (Employee)
**Precondition**: Ambika has submitted multiple leave requests
**Steps**: Navigate to `/leave`.
**Expected**: The Leave page shows a list of Ambika's requests with status badges — PENDING (yellow), APPROVED (green), REJECTED (red), CANCELLED (gray). Each row shows leave type, dates, days, reason, and status.

### TC-7.14: Cancel Own Pending Request
**Role**: Ambika (Employee)
**Precondition**: Ambika has a PENDING leave request
**Steps**: On the Leave page, click "Cancel" on the pending request.
**Expected**: The request status changes to CANCELLED. The leave balance is NOT affected (it was never deducted since it was pending). The calendar indicators for those dates are removed.

### TC-7.15: Cannot Cancel Approved Request
**Role**: Ambika (Employee)
**Precondition**: Ambika has an APPROVED leave request
**Steps**: Attempt to cancel the approved request.
**Expected**: The "Cancel" option is either not available or clicking it is rejected by the backend. Approved requests require a different cancellation flow.

---

## TC-8: MANAGER APPROVAL AND REJECTION FLOW

### TC-8.1: Leave Approval Page — Access by Manager
**Role**: Murugan (Manager)
**Precondition**: Murugan is logged in
**Steps**: Navigate to `/event/approvals`.
**Expected**: The Leave Approval page loads. It shows pending leave requests from employees who report to Murugan. Filters are available for Workflow Type, Leave Type, Date range, and Status (default: PENDING).

### TC-8.2: Leave Approval Page — Access Denied for Employee
**Role**: Ambika (Employee)
**Steps**: Attempt to navigate to `/event/approvals` via URL.
**Expected**: Ambika is redirected to the dashboard. The approval page is not accessible to the Employee role.

### TC-8.3: Approve Leave Request — Single Level
**Role**: Murugan (Manager)
**Precondition**: Ambika has a PENDING EL request for 3 days. Single-level workflow is configured.
**Steps**: On the approval page, locate Ambika's request. Enter remark: "Approved, enjoy!" Click the "Approve" button.
**Expected**: PUT is sent to `/api/v1/leaves/requests/:id/approve`. The status changes to APPROVED. Ambika's EL balance is deducted by 3 days. The approval is recorded in the approvalHistory with Murugan's ID, timestamp, and remark. The request disappears from the pending list (or shows as Approved with status filter set to All).

### TC-8.4: Reject Leave Request
**Role**: Murugan (Manager)
**Precondition**: Ambika has a PENDING leave request
**Steps**: Click the "Reject" button on Ambika's request. A rejection modal appears. Enter rejection reason: "Please reschedule due to project deadline." Confirm rejection.
**Expected**: PUT is sent to `/api/v1/leaves/requests/:id/reject`. The status changes to REJECTED. Ambika's leave balance is NOT deducted. The rejection reason is stored in approval history. Ambika sees the rejection with Murugan's comments on her Leave page.

### TC-8.5: Reject Without Reason — Validation
**Role**: Murugan (Manager)
**Steps**: Click "Reject" on a request. Leave the rejection reason empty in the modal. Try to confirm.
**Expected**: Validation prevents submission. The rejection reason is mandatory. A message like "Please enter a rejection reason" is shown.

### TC-8.6: Bulk Approve Multiple Requests
**Role**: Murugan (Manager)
**Precondition**: Multiple PENDING requests exist from team members
**Steps**: Select 3 pending requests using checkboxes. Click "Bulk Approve." Enter a common remark: "All approved." Confirm.
**Expected**: All 3 requests are approved. Each one's balance is deducted. Approval history records Murugan as the approver for all 3.

### TC-8.7: Column Picker — Customize Table Columns
**Role**: Murugan (Manager)
**Steps**: Click the column picker button. Uncheck "Hours" and "Entry By" columns. Close the picker.
**Expected**: The "Hours" and "Entry By" columns are hidden from the table. Other columns remain visible. The column selection persists during the session.

### TC-8.8: Filter by Leave Type
**Role**: Murugan (Manager)
**Steps**: Select "Sick Leave" from the Leave Type filter dropdown.
**Expected**: The table shows only SL requests. EL, CL, and other type requests are filtered out.

### TC-8.9: Filter by Status — Show All
**Role**: Murugan (Manager)
**Steps**: Change the Status filter from "PENDING" to "ALL."
**Expected**: The table shows all requests — PENDING, APPROVED, REJECTED, and CANCELLED — from Murugan's team members. Approved and rejected requests do not show Approve/Reject action buttons.

### TC-8.10: Pagination
**Role**: Murugan (Manager)
**Precondition**: More than 10 pending requests exist
**Steps**: Observe the pagination. Change page size to 20. Navigate to page 2.
**Expected**: Page size changes to 20 results per page. Page 2 shows the next set of results. Total count is displayed.

### TC-8.11: Manager View Toggle — My Requests vs Team Requests
**Role**: Murugan (Manager)
**Precondition**: Murugan is on `/leave` page
**Steps**: Toggle from "Team Requests" to "My Requests."
**Expected**: The list switches from showing team members' requests to showing Murugan's own personal leave requests. Toggle back to "Team Requests" shows team data again.

### TC-8.12: Multi-Level Approval — Level 1 Approve, Advance to Level 2
**Role**: Murugan (Manager) → Chitra (HR Admin)
**Precondition**: Two-level workflow: Level 1 = Manager, Level 2 = HR. Ambika has a PENDING request at Level 1.
**Steps**: Murugan approves the request at Level 1.
**Expected**: The status does NOT become APPROVED yet. Instead, currentApprovalLevel advances from 1 to 2. The assignedApproverEmployeeId changes from Murugan's ID to Chitra's ID. The request disappears from Murugan's pending queue. It appears in Chitra's approval queue.

### TC-8.13: Multi-Level Approval — Level 2 Final Approve
**Role**: Chitra (HR Admin)
**Precondition**: Request is at Level 2, assigned to Chitra
**Steps**: Chitra sees the request in her approval queue. She can see that Murugan approved at Level 1 (in approval history). She clicks Approve.
**Expected**: This is the final level. Status changes to APPROVED. Balance is deducted. Full two-level approval chain is recorded in approvalHistory JSON.

### TC-8.14: Multi-Level Approval — Level 1 Reject Stops Chain
**Role**: Murugan (Manager)
**Precondition**: Two-level workflow. Ambika's request is at Level 1.
**Steps**: Murugan rejects the request at Level 1 with reason.
**Expected**: The request is immediately set to REJECTED. It does NOT advance to Level 2. Chitra never sees this request in her queue. Balance is NOT deducted.

---

## TC-9: HR AND SUPER ADMIN APPROVAL FLOW

### TC-9.1: HR Admin Sees All Org Requests
**Role**: Chitra (HR Admin)
**Steps**: Navigate to `/event/approvals`.
**Expected**: Chitra sees ALL pending requests from ALL employees in the Infosys organization, regardless of department or reporting hierarchy. This includes requests from employees who do not report to her.

### TC-9.2: Super Admin Sees All Orgs
**Role**: Aakkash (Super Admin)
**Steps**: Navigate to `/event/approvals`.
**Expected**: Aakkash sees pending requests across ALL organizations. An organization filter is available to narrow by specific org.

### TC-9.3: HR Admin Approves Any Employee's Request
**Role**: Chitra (HR Admin)
**Precondition**: An employee from a different team (not reporting to Chitra) has a pending request
**Steps**: Chitra approves the request.
**Expected**: The approval succeeds. Chitra can approve any request in the organization regardless of reporting hierarchy.

### TC-9.4: Direct Assignment — HR Applies Leave on Behalf (Auto-Approved)
**Role**: Chitra (HR Admin)
**Precondition**: Chitra is viewing Ambika's attendance
**Steps**: Click "Apply Event on behalf" for Ambika. The Apply Event page loads with a blue banner: "Assigning on behalf of Ambika Reddy — will be auto-approved (HR Direct Assignment)." Select "Sick Leave", Date: "2026-03-28", Reason: "Sick leave applied by HR." Click Submit.
**Expected**: The frontend calls `POST /api/v1/leaves/hr-assign` (NOT `/leaves/requests`). The leave is created with status APPROVED immediately. NO PENDING state. NO workflow routing. Ambika's SL balance is deducted immediately. Calendar shows approved SL for March 28.

### TC-9.5: Direct Assignment — Manager Applies Leave on Behalf (Auto-Approved)
**Role**: Murugan (Manager)
**Precondition**: Murugan is viewing Ambika's attendance (team member)
**Steps**: Click "Apply Event on behalf" for Ambika. Banner shows: "Assigning on behalf of Ambika Reddy — will be auto-approved (Manager Direct Assignment)." Select "Work From Home", Date: "2026-04-10", Reason: "WFH assigned by manager." Submit.
**Expected**: Same as TC-9.4 — calls `/leaves/hr-assign`, auto-approved, no PENDING, balance deducted immediately.

### TC-9.6: Direct Assignment — Super Admin Applies on Behalf
**Role**: Aakkash (Super Admin)
**Steps**: Select any employee from any organization. Apply leave on behalf.
**Expected**: Auto-approved via `/leaves/hr-assign`. Works across organizations.

### TC-9.7: Direct Assignment — Banner Confirmation
**Role**: Chitra (HR Admin)
**Steps**: Navigate to Apply Event on behalf of an employee. Observe the banner.
**Expected**: A prominent blue banner is visible at the top of the form clearly stating: "Assigning on behalf of [Employee Name] — will be auto-approved (HR Direct Assignment)." This banner ensures the user knows the leave will skip the approval workflow.

### TC-9.8: Self-Apply by HR Goes Through Normal Workflow
**Role**: Chitra (HR Admin)
**Steps**: Chitra applies leave for HERSELF (not on behalf of anyone).
**Expected**: The request goes through the normal workflow — status is PENDING, routed to Chitra's own reporting manager or configured approver. It does NOT auto-approve. The `/leaves/requests` endpoint is used (not `/leaves/hr-assign`).

---

## TC-10: ATTENDANCE TRACKING FLOW

### TC-10.1: Attendance Calendar — Employee View
**Role**: Ambika (Employee)
**Precondition**: Ambika is logged in and has attendance records for the current month
**Steps**: Navigate to `/attendance`.
**Expected**: A monthly calendar grid loads showing each day. Days with attendance show check-in time (green if on time, red if late), check-out time (red if early), work hours, and OT hours. Leave days show the leave type badge. Today's cell is highlighted. No employee selector is visible — Ambika can only see her own calendar.

### TC-10.2: Attendance Calendar — Late Arrival Indicator
**Role**: Ambika (Employee)
**Precondition**: Ambika has General Shift (9 AM start, 15 min grace). She checked in at 9:20 AM on a specific day.
**Steps**: View that day on the calendar.
**Expected**: The check-in time "9:20 AM" is shown in red. A late indicator shows "Late: 20 mins" (since 9:20 is beyond the 9:15 grace cutoff).

### TC-10.3: Attendance Calendar — On-Time Arrival (Within Grace)
**Role**: Ambika (Employee)
**Precondition**: Ambika checked in at 9:10 AM (within 15-min grace)
**Steps**: View that day on the calendar.
**Expected**: The check-in time "9:10 AM" is shown in green. No late indicator.

### TC-10.4: Attendance Calendar — Leave Overlay
**Role**: Ambika (Employee)
**Precondition**: Ambika has approved EL on April 7-9
**Steps**: View the calendar for April 2026.
**Expected**: April 7, 8, and 9 show "EL" badges with approved leave color coding. No check-in/check-out data is shown for those days.

### TC-10.5: Attendance Calendar — Permission Timing Display
**Role**: Ambika (Employee)
**Precondition**: Ambika has an approved permission on March 31 with reason "[Permission 15:00-16:30] Doctor appointment"
**Steps**: View March 31 on the calendar.
**Expected**: The cell shows "Permission 3:00 PM - 4:30 PM" parsed from the reason. The regular attendance data for the rest of the day is also shown.

### TC-10.6: Attendance Calendar — Half Day Display
**Role**: Ambika (Employee)
**Precondition**: Ambika has an approved half-day leave with reason "[First Half] Personal work"
**Steps**: View that day on the calendar.
**Expected**: The cell shows "First Half" label. The second half attendance data is also displayed.

### TC-10.7: Monthly Details Sidebar
**Role**: Ambika (Employee)
**Steps**: On the Attendance page, observe the right-side sidebar.
**Expected**: The MonthlyDetailsSidebar shows: Present Days, Absent Days, Leave Days (with breakdown by type — EL: X, SL: Y), LOP Days, Half Days, Holiday Days, Weekend Days, Overtime Hours, Paid Days, Total Working Days. All numbers match the calendar visual.

### TC-10.8: Manager — Team Employee Selector
**Role**: Murugan (Manager)
**Steps**: Navigate to `/attendance`.
**Expected**: Murugan sees his own calendar by default. A team selector dropdown is available showing his direct reports (including Ambika). Selecting Ambika switches the calendar to show Ambika's attendance.

### TC-10.9: HR Admin — Full Employee Selector
**Role**: Chitra (HR Admin)
**Steps**: Navigate to `/attendance`.
**Expected**: Chitra sees an employee selector showing ALL employees in the Infosys organization. She can select any employee and view their attendance calendar.

### TC-10.10: Super Admin — Organization Switcher on Attendance
**Role**: Aakkash (Super Admin)
**Steps**: Navigate to `/attendance`.
**Expected**: Aakkash sees an organization switcher in addition to the employee selector. He can switch to any organization and view any employee's attendance.

### TC-10.11: Attendance Regularization — Employee Requests Correction
**Role**: Ambika (Employee)
**Precondition**: Ambika forgot to check out on a specific day; her record shows no check-out time
**Steps**: Request an attendance regularization for that day with corrected check-out time "18:00" and reason "Forgot to punch out."
**Expected**: A regularization request is created with status PENDING. It appears in Murugan's (manager) approval queue.

### TC-10.12: Attendance Regularization — Manager Approves
**Role**: Murugan (Manager)
**Precondition**: Ambika's regularization request is pending
**Steps**: Murugan reviews and approves the regularization.
**Expected**: The attendance record for that day is updated with the corrected check-out time. Work hours are recalculated. The regularization status changes to APPROVED.

### TC-10.13: Attendance Lock — HR Locks Month
**Role**: Chitra (HR Admin)
**Precondition**: Chitra navigates to `/time-attendance/attendance-lock`
**Steps**: Select organization: Infosys, Year: 2026, Month: February. Enter remarks: "Locked for payroll processing." Click Lock.
**Expected**: February 2026 attendance is locked for all Infosys employees. No further edits, regularizations, or manual entries are allowed for that month. Attempting to modify any February record returns an error.

### TC-10.14: Attendance Lock — Prevented Edits After Lock
**Role**: Chitra (HR Admin)
**Precondition**: February 2026 is locked
**Steps**: Attempt to record a manual attendance entry for a February date.
**Expected**: The operation is blocked. An error message indicates that the month is locked and no changes are permitted.

### TC-10.15: Attendance Lock Page — Access Denied for Manager/Employee
**Role**: Murugan (Manager) / Ambika (Employee)
**Steps**: Attempt to navigate to `/time-attendance/attendance-lock` via URL.
**Expected**: The user is redirected to the dashboard. The Attendance Lock page is not accessible.

---

## TC-11: RBAC VISIBILITY AND PERMISSION VERIFICATION

### TC-11.1: Super Admin — Full Sidebar Modules
**Role**: Aakkash (Super Admin)
**Steps**: Login and observe the sidebar.
**Expected**: All modules are visible: Dashboard, Employees, Departments, Positions, Organizations, Module Permission, User Roles, Core HR, Event Configuration (with all sub-items), Time Attendance (with all sub-items), Leave, Attendance, Payroll (with all sub-items), Reports, Statutory Compliance, ESOP, Separation, Loans, Transfer and Promotions.

### TC-11.2: HR Admin — No Organizations/Module Permission
**Role**: Chitra (HR Admin)
**Steps**: Login and observe the sidebar.
**Expected**: Sidebar does NOT contain "Organizations" or "Module Permission" pages. Everything else similar to Super Admin but scoped to Infosys.

### TC-11.3: Manager — No Configuration Modules
**Role**: Murugan (Manager)
**Steps**: Login and observe the sidebar.
**Expected**: Sidebar does NOT contain Event Configuration, Shift Master, Shift Assign, Approval Workflow, Payroll, Reports, Statutory Compliance, ESOP, or any admin-level modules. Only shows Dashboard, Employees (team), Attendance, Leave/Apply Event, Event Approvals.

### TC-11.4: Employee — Minimal Sidebar
**Role**: Ambika (Employee)
**Steps**: Login and observe the sidebar.
**Expected**: Sidebar shows ONLY Dashboard, Profile, Attendance (own), Leave/Apply Event. No employee list, no configuration, no approvals, no admin modules.

### TC-11.5: Employee — Direct URL Access to Admin Page
**Role**: Ambika (Employee)
**Steps**: Type `/employees` directly in the browser URL bar.
**Expected**: Ambika is either redirected to dashboard or sees a restricted view with no action buttons. The DashboardLayout checks path access and blocks unauthorized navigation.

### TC-11.6: Super Admin Wildcard Permission
**Role**: Aakkash (Super Admin)
**Precondition**: The backend returns empty permissions for Super Admin (implicit full access)
**Steps**: The usePermissions hook processes the empty response.
**Expected**: The system sets a wildcard permission "*" for Super Admin. All canView(), canAdd(), canEdit(), canDelete() checks return true. All buttons and actions are visible.

### TC-11.7: Employee Form Tab RBAC — HR Admin Full Edit
**Role**: Chitra (HR Admin)
**Steps**: Open an employee's edit form. Check all 11 tabs.
**Expected**: All tabs are editable. Chitra can modify Company Details, Personal, Statutory, Bank, Salary, Assets, Academic, Previous Employment, Family, Others. Only ESOP is read-only.

### TC-11.8: Employee Form Tab RBAC — Employee Read-Only
**Role**: Ambika (Employee)
**Steps**: Open her own profile view.
**Expected**: ALL tabs are in read-only mode. No Save button. No edit capability on any tab.

### TC-11.9: Attendance Page — Employee Cannot View Others
**Role**: Ambika (Employee)
**Steps**: On `/attendance`, look for employee selector or team dropdown.
**Expected**: No employee selector is available. Ambika can ONLY see her own attendance calendar. There is no way to switch to another employee's view.

### TC-11.10: Leave Approval Page — Employee Cannot Access
**Role**: Ambika (Employee)
**Steps**: Check if "Event Approvals" appears in sidebar. Try navigating to `/event/approvals` via URL.
**Expected**: "Event Approvals" is not in the sidebar. Navigating via URL redirects to dashboard because `getModulePermissions('/event/approvals').can_view` is false for Employee role.

---

## TC-12: END-TO-END SCENARIO TEST CASES

### TC-12.1: Complete Employee Onboarding Scenario
**Roles**: Aakkash → Chitra → New Employee
**Steps**:
1. Aakkash logs in, navigates to `/employees`, clicks "Create Employee"
2. Selects paygroup "Monthly"
3. Fills Company tab: First Name "Priya", Department "Engineering", Designation "Developer", DOJ "2026-04-01", Reporting Manager "Murugan Babu", Place of Tax "METRO"
4. Fills Personal tab: Email "priya.sharma@testmail.com", Phone "9876543210"
5. Clicks Save
6. Notes down the temporary password displayed
7. Chitra logs in, goes to Shift Assign, assigns "General Shift" to Priya from April 1
8. Chitra goes to Rights Allocation, allocates EL: 18 days, SL: 12 days to Priya
9. Priya logs in with the temporary password
**Expected**: At each step, the operation succeeds. Priya's dashboard shows leave balance EL: 18, SL: 12. Her attendance calendar is ready to track against General Shift. She can apply leave that will route to Murugan.

### TC-12.2: Complete Leave Request and Approval Scenario
**Roles**: Ambika → Murugan
**Steps**:
1. Ambika logs in, goes to `/attendance`, clicks "Apply Leave"
2. Selects EL, From: April 7, To: April 9, Reason: "Family wedding celebration"
3. Submits — sees success banner, calendar shows pending indicators
4. Murugan logs in, goes to `/event/approvals`
5. Sees Ambika's request: 3 days EL, April 7-9
6. Enters remark: "Approved!" and clicks Approve
7. Ambika logs back in, checks leave balance and calendar
**Expected**: Ambika's EL balance is reduced by 3 (e.g., 18 → 15). Calendar shows April 7-9 as approved EL (green). Murugan's pending queue no longer shows this request.

### TC-12.3: HR Direct Assignment Scenario
**Roles**: Chitra
**Steps**:
1. Chitra logs in, goes to `/attendance`, selects Ambika
2. Notices Ambika was absent on March 28 with no leave applied
3. Clicks "Apply Event on behalf"
4. Blue banner confirms auto-approval. Selects SL, Date: March 28, Reason: "Sick leave - applied by HR"
5. Submits
**Expected**: Leave is created with APPROVED status immediately. NO PENDING state. Ambika's SL balance is deducted by 1. March 28 shows as approved SL on calendar.

### TC-12.4: Bulk Upload with Error and Retry Scenario
**Roles**: Chitra
**Steps**:
1. Chitra downloads the 49-column template
2. Fills 10 rows but types "Engg" instead of "Engineering" in row 7
3. Uploads — gets validation failure
4. Sees error: "Row 7: Department 'Engg' not found"
5. Fixes row 7 to "Engineering" in the Excel file
6. Re-uploads the corrected file
**Expected**: First upload fails completely (all-or-nothing). Zero employees created. After fix, second upload succeeds: "10 employees created, 0 failed."

### TC-12.5: Multi-Level Approval Scenario
**Roles**: Ambika → Murugan → Chitra
**Steps**:
1. Ambika applies 5 days EL (April 14-18)
2. Request goes to Level 1 — Murugan's queue
3. Murugan approves at Level 1
4. Request advances to Level 2 — Chitra's queue
5. Chitra approves at Level 2 (final)
**Expected**: After Murugan approves, the request moves from his queue to Chitra's queue. After Chitra approves, status becomes APPROVED. Ambika's EL deducted by 5. Full approval chain is recorded. If Murugan had rejected, request would be immediately REJECTED without reaching Chitra.

### TC-12.6: Permission Request Scenario
**Roles**: Ambika → Murugan
**Steps**:
1. Ambika clicks "Apply Permission" from attendance page
2. Date: March 31, From Time: 15:00, To Time: 16:30, Reason: "Doctor appointment"
3. Submits — goes to PENDING
4. Murugan approves
**Expected**: Reason is stored as "[Permission 15:00-16:30] Doctor appointment." After approval, March 31 calendar cell shows "Permission 3:00 PM - 4:30 PM" badge.

### TC-12.7: Manager On-Behalf WFH Assignment Scenario
**Roles**: Murugan
**Steps**:
1. Murugan goes to attendance, selects Ambika from team dropdown
2. Clicks "Apply Event on behalf"
3. Banner: "auto-approved (Manager Direct Assignment)"
4. Selects WFH, Date: April 10, Reason: "WFH assigned by manager"
5. Submits
**Expected**: Auto-approved via `/leaves/hr-assign`. No PENDING. April 10 shows WFH on Ambika's calendar immediately.
