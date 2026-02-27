# Phase 4: Payroll Module - Test Scenarios by Role 🧪

**Date:** January 25, 2026  
**Purpose:** Comprehensive test scenarios for each user role

---

## 👥 Available Roles & Access

### Role Permissions for Payroll Module:

| Role | Create | View | Process | Approve | Mark Paid | Delete |
|------|--------|------|---------|---------|-----------|--------|
| **SUPER_ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ORG_ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **HR_MANAGER** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **MANAGER** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **EMPLOYEE** | ❌ | ✅ (Own only) | ❌ | ❌ | ❌ | ❌ |

**Note:** All roles can VIEW, but only ORG_ADMIN, HR_MANAGER, and SUPER_ADMIN can CREATE/MANAGE.

---

## 🔐 Test User Credentials

### Option 1: Use Existing Users

Check your database for existing users:
```sql
SELECT email, role FROM users WHERE role IN ('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER');
```

### Option 2: Create Test Users

#### Create SUPER_ADMIN:
```bash
# Use the super admin creation script
cd backend
npm run create:super-admin
```

#### Create ORG_ADMIN:
```http
POST http://localhost:5000/api/v1/auth/register
Content-Type: application/json

{
  "email": "orgadmin@test.com",
  "password": "OrgAdmin@123",
  "role": "ORG_ADMIN",
  "organizationId": "YOUR_ORG_ID"
}
```

#### Create HR_MANAGER:
```http
POST http://localhost:5000/api/v1/auth/register
Content-Type: application/json

{
  "email": "hrmanager@test.com",
  "password": "HRManager@123",
  "role": "HR_MANAGER",
  "organizationId": "YOUR_ORG_ID"
}
```

---

## 📋 Test Scenarios by Role

---

## 🎯 Scenario 1: SUPER_ADMIN Testing

### Login Credentials:
```
Email: admin@example.com (or your super admin email)
Password: Admin@123 (or your super admin password)
Role: SUPER_ADMIN
```

### Test Scenario 1.1: Full Payroll Management

**Objective:** Test complete payroll workflow as SUPER_ADMIN

#### Step 1: Login
```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "Admin@123"
}
```

**Expected:** ✅ Token received, role: SUPER_ADMIN

#### Step 2: Get Organization ID
```http
GET http://localhost:5000/api/v1/auth/me
Authorization: Bearer TOKEN
```

**Expected:** ✅ User info with organizationId

#### Step 3: Create Salary Structure
```http
POST http://localhost:5000/api/v1/payroll/salary-structures
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "organizationId": "ORG_ID",
  "name": "Executive Salary Structure",
  "description": "For senior management",
  "components": [
    {
      "name": "Basic Salary",
      "type": "EARNING",
      "calculationType": "FIXED",
      "value": 100000,
      "isTaxable": true,
      "isStatutory": false
    },
    {
      "name": "HRA",
      "type": "EARNING",
      "calculationType": "PERCENTAGE",
      "value": 50,
      "isTaxable": true,
      "isStatutory": false
    },
    {
      "name": "Performance Bonus",
      "type": "EARNING",
      "calculationType": "FIXED",
      "value": 20000,
      "isTaxable": true,
      "isStatutory": false
    }
  ],
  "isActive": true
}
```

**Expected:** ✅ Status 201, Salary structure created

#### Step 4: Assign Salary to Employee
```http
POST http://localhost:5000/api/v1/payroll/employee-salaries
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "employeeId": "EMPLOYEE_ID",
  "salaryStructureId": "SALARY_STRUCTURE_ID",
  "effectiveDate": "2026-01-01",
  "basicSalary": 100000,
  "grossSalary": 170000,
  "netSalary": 150000,
  "paymentFrequency": "MONTHLY",
  "isActive": true
}
```

**Expected:** ✅ Status 201, Salary assigned

#### Step 5: Create Payroll Cycle
```http
POST http://localhost:5000/api/v1/payroll/payroll-cycles
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "organizationId": "ORG_ID",
  "name": "January 2026 Payroll - Super Admin Test",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "paymentDate": "2026-02-05",
  "notes": "Test payroll cycle created by SUPER_ADMIN"
}
```

**Expected:** ✅ Status 201, Cycle created with DRAFT status

#### Step 6: Process Payroll
```http
POST http://localhost:5000/api/v1/payroll/payroll-cycles/CYCLE_ID/process
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "recalculate": false
}
```

**Expected:** ✅ Status 200, Cycle status: PROCESSING, Payslips generated

#### Step 7: Approve Payroll
```http
POST http://localhost:5000/api/v1/payroll/payroll-cycles/CYCLE_ID/approve
Authorization: Bearer TOKEN
```

**Expected:** ✅ Status 200, Cycle status: APPROVED

#### Step 8: Mark as Paid
```http
POST http://localhost:5000/api/v1/payroll/payroll-cycles/CYCLE_ID/mark-paid
Authorization: Bearer TOKEN
```

**Expected:** ✅ Status 200, Cycle status: PAID

#### Step 9: View All Payslips
```http
GET http://localhost:5000/api/v1/payroll/payslips?organizationId=ORG_ID
Authorization: Bearer TOKEN
```

**Expected:** ✅ Status 200, List of payslips with details

---

## 🎯 Scenario 2: ORG_ADMIN Testing

### Login Credentials:
```
Email: orgadmin@test.com (or your org admin email)
Password: OrgAdmin@123 (or your org admin password)
Role: ORG_ADMIN
```

### Test Scenario 2.1: Organization Payroll Management

**Objective:** Test payroll management within organization scope

#### Step 1: Login
```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "orgadmin@test.com",
  "password": "OrgAdmin@123"
}
```

**Expected:** ✅ Token received, role: ORG_ADMIN

#### Step 2: Create Salary Structure (Organization-Specific)
```http
POST http://localhost:5000/api/v1/payroll/salary-structures
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "organizationId": "YOUR_ORG_ID",
  "name": "Standard Employee Structure",
  "components": [
    {
      "name": "Basic Salary",
      "type": "EARNING",
      "calculationType": "FIXED",
      "value": 50000,
      "isTaxable": true,
      "isStatutory": false
    }
  ]
}
```

**Expected:** ✅ Status 201, Structure created for organization

#### Step 3: Create Payroll Cycle
```http
POST http://localhost:5000/api/v1/payroll/payroll-cycles
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "organizationId": "YOUR_ORG_ID",
  "name": "January 2026 Payroll",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "paymentDate": "2026-02-05"
}
```

**Expected:** ✅ Status 201, Cycle created

#### Step 4: Process & Approve
- Process payroll cycle
- Approve payroll cycle
- Mark as paid

**Expected:** ✅ All operations successful

#### Step 5: Verify Organization Isolation
```http
GET http://localhost:5000/api/v1/payroll/payroll-cycles?organizationId=YOUR_ORG_ID
Authorization: Bearer TOKEN
```

**Expected:** ✅ Only cycles for YOUR_ORG_ID are returned

---

## 🎯 Scenario 3: HR_MANAGER Testing

### Login Credentials:
```
Email: hrmanager@test.com (or your HR manager email)
Password: HRManager@123 (or your HR manager password)
Role: HR_MANAGER
```

### Test Scenario 3.1: HR Payroll Operations

**Objective:** Test HR manager's payroll management capabilities

#### Step 1: Login
```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "hrmanager@test.com",
  "password": "HRManager@123"
}
```

**Expected:** ✅ Token received, role: HR_MANAGER

#### Step 2: Create Salary Structure
```http
POST http://localhost:5000/api/v1/payroll/salary-structures
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "organizationId": "YOUR_ORG_ID",
  "name": "HR Test Structure",
  "components": [...]
}
```

**Expected:** ✅ Status 201, Structure created

#### Step 3: Manage Payroll Cycle
- Create cycle
- Process cycle
- Approve cycle
- Mark as paid

**Expected:** ✅ All operations successful

#### Step 4: View Payslips (All Employees)
```http
GET http://localhost:5000/api/v1/payroll/payslips?organizationId=YOUR_ORG_ID
Authorization: Bearer TOKEN
```

**Expected:** ✅ Can view all payslips in organization

---

## 🎯 Scenario 4: MANAGER Testing

### Login Credentials:
```
Email: manager@test.com
Password: Manager@123
Role: MANAGER
```

### Test Scenario 4.1: View-Only Access

**Objective:** Verify MANAGER can only view, not create/modify

#### Step 1: Login
```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "manager@test.com",
  "password": "Manager@123"
}
```

**Expected:** ✅ Token received, role: MANAGER

#### Step 2: Try to Create Salary Structure (Should Fail)
```http
POST http://localhost:5000/api/v1/payroll/salary-structures
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "organizationId": "ORG_ID",
  "name": "Test Structure",
  "components": [...]
}
```

**Expected:** ❌ Status 403, "Forbidden - Insufficient permissions"

#### Step 3: View Payroll Cycles (Should Succeed)
```http
GET http://localhost:5000/api/v1/payroll/payroll-cycles
Authorization: Bearer TOKEN
```

**Expected:** ✅ Status 200, Can view cycles

#### Step 4: Try to Process Payroll (Should Fail)
```http
POST http://localhost:5000/api/v1/payroll/payroll-cycles/CYCLE_ID/process
Authorization: Bearer TOKEN
```

**Expected:** ❌ Status 403, "Forbidden"

---

## 🎯 Scenario 5: EMPLOYEE Testing

### Login Credentials:
```
Email: employee@test.com
Password: Employee@123
Role: EMPLOYEE
```

### Test Scenario 5.1: View Own Payslips Only

**Objective:** Verify EMPLOYEE can only view their own payslips

#### Step 1: Login
```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "employee@test.com",
  "password": "Employee@123"
}
```

**Expected:** ✅ Token received, role: EMPLOYEE

#### Step 2: View Own Payslips
```http
GET http://localhost:5000/api/v1/payroll/payslips/employee/EMPLOYEE_ID
Authorization: Bearer TOKEN
```

**Expected:** ✅ Status 200, Only own payslips returned

#### Step 3: Try to View All Payslips (Should Fail or Filter)
```http
GET http://localhost:5000/api/v1/payroll/payslips?organizationId=ORG_ID
Authorization: Bearer TOKEN
```

**Expected:** ❌ Status 403 or filtered to own payslips only

#### Step 4: Try to Create Payroll Cycle (Should Fail)
```http
POST http://localhost:5000/api/v1/payroll/payroll-cycles
Authorization: Bearer TOKEN
```

**Expected:** ❌ Status 403, "Forbidden"

---

## 🧪 Complete Test Flow (Recommended)

### For ORG_ADMIN or HR_MANAGER:

```bash
# 1. Start Backend
cd backend
npm run dev

# 2. In another terminal, run automated test
npm run test:payroll

# Or test manually with these steps:
```

### Manual Test Flow:

1. **Login** → Get token
2. **Get Organization ID** → From `/auth/me`
3. **Create Salary Structure** → POST `/payroll/salary-structures`
4. **Get Employee List** → GET `/employees`
5. **Assign Salary to Employee** → POST `/payroll/employee-salaries`
6. **Create Payroll Cycle** → POST `/payroll/payroll-cycles`
7. **Process Payroll** → POST `/payroll/payroll-cycles/:id/process`
8. **Approve Payroll** → POST `/payroll/payroll-cycles/:id/approve`
9. **Mark as Paid** → POST `/payroll/payroll-cycles/:id/mark-paid`
10. **View Payslips** → GET `/payroll/payslips`

---

## 📊 Test Results Template

### For Each Role:

| Test Step | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| Login | ✅ Token received | | |
| Create Structure | ✅/❌ Based on role | | |
| View Cycles | ✅ Success | | |
| Process Payroll | ✅/❌ Based on role | | |
| Approve Payroll | ✅/❌ Based on role | | |
| View Payslips | ✅ Success (filtered) | | |

---

## 🎯 Quick Test Commands

### Test as ORG_ADMIN:
```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"orgadmin@test.com","password":"OrgAdmin@123"}' \
  | jq -r '.data.token' > token.txt

# Use token for subsequent requests
TOKEN=$(cat token.txt)
```

### Test as HR_MANAGER:
```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hrmanager@test.com","password":"HRManager@123"}' \
  | jq -r '.data.token' > token.txt
```

---

## ✅ Recommended Test Order

1. **Start with ORG_ADMIN or HR_MANAGER** (Full access)
2. **Test complete workflow** (Create → Process → Approve → Pay)
3. **Test MANAGER** (View-only access)
4. **Test EMPLOYEE** (Own payslips only)
5. **Test SUPER_ADMIN** (Cross-organization if applicable)

---

## 🔍 Verification Points

For each role, verify:

- ✅ **Authentication** - Can login successfully
- ✅ **Authorization** - Can/cannot access endpoints based on role
- ✅ **Data Isolation** - See only organization's data
- ✅ **Operations** - Can perform allowed operations
- ✅ **Error Handling** - Proper 403 errors for forbidden operations

---

## 📝 Notes

- **ORG_ADMIN** and **HR_MANAGER** have identical permissions for payroll
- **MANAGER** can only view, not create/modify
- **EMPLOYEE** can only view their own payslips
- All roles require authentication
- Organization-level data isolation is enforced

---

**Ready to test? Start with ORG_ADMIN or HR_MANAGER for full functionality!** 🚀
