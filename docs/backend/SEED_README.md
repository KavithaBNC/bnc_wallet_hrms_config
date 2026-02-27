# Database Seeding Guide

## Overview

This seed script creates comprehensive test data for the HRMS Portal, including:
- 5 test users with different roles (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, MANAGER, EMPLOYEE)
- 1 test organization
- 3 departments (HR, IT, Sales)
- 4 job positions
- 5 employee records

## Quick Start

### Run the Seed Script

```bash
cd backend
npm run seed
```

OR

```bash
cd backend
npx prisma db seed
```

## Test User Credentials

All test users have the same password: **`Test@123`**

### 1. SUPER_ADMIN
- **Email:** `superadmin@test.hrms.com`
- **Role:** SUPER_ADMIN
- **Access:** Full system access
- **Has Employee Profile:** No

### 2. ORG_ADMIN
- **Email:** `orgadmin@test.hrms.com`
- **Role:** ORG_ADMIN
- **Employee Code:** EMP001
- **Department:** Human Resources
- **Position:** HR Manager
- **Access:** Organization admin, can create/update/delete employees

### 3. HR_MANAGER
- **Email:** `hrmanager@test.hrms.com`
- **Role:** HR_MANAGER
- **Employee Code:** EMP002
- **Department:** Human Resources
- **Position:** HR Manager
- **Access:** Can create/update employees, view statistics

### 4. MANAGER
- **Email:** `manager@test.hrms.com`
- **Role:** MANAGER
- **Employee Code:** EMP003
- **Department:** Information Technology
- **Position:** IT Manager
- **Access:** Can view employees, view hierarchy

### 5. EMPLOYEE
- **Email:** `employee@test.hrms.com`
- **Role:** EMPLOYEE
- **Employee Code:** EMP004
- **Department:** Information Technology
- **Position:** Software Developer
- **Reports To:** IT Manager (EMP003)
- **Access:** Can view employees only

## Test Data Created

### Organization
- **Name:** Test Corp Inc
- **Code:** TESTCORP

### Departments
1. Human Resources (HR)
2. Information Technology (IT)
3. Sales (SALES)

### Job Positions
1. HR Manager (HRMGR)
2. IT Manager (ITMGR)
3. Software Developer (SWDEV)
4. Sales Representative (SALESREP)

### Employees
- **5 total employees**
- **4 with user accounts** (can login)
- **1 without user account** (Sarah Sales - EMP005)

## Testing Role-Based Access Control

### Test Scenario 1: Employee Creation

#### ✅ Allowed Roles
- SUPER_ADMIN
- ORG_ADMIN
- HR_MANAGER

```bash
# Login as HR Manager
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hrmanager@test.hrms.com",
    "password": "Test@123"
  }'

# Create employee (should work)
curl -X POST http://localhost:5000/api/v1/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "organizationId": "YOUR_ORG_ID",
    "firstName": "New",
    "lastName": "Employee",
    "email": "new@test.com",
    "phone": "1234567890",
    "dateOfJoining": "2026-01-15"
  }'
```

#### ❌ Blocked Roles
- MANAGER
- EMPLOYEE

```bash
# Login as Employee
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@test.hrms.com",
    "password": "Test@123"
  }'

# Try to create employee (should fail with 403)
curl -X POST http://localhost:5000/api/v1/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{...}'

# Expected Response:
# {
#   "status": "error",
#   "statusCode": 403,
#   "message": "You do not have permission to access this resource..."
# }
```

### Test Scenario 2: Employee Deletion

#### ✅ Allowed Roles
- SUPER_ADMIN
- ORG_ADMIN

#### ❌ Blocked Roles
- HR_MANAGER
- MANAGER
- EMPLOYEE

```bash
# Login as HR Manager
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hrmanager@test.hrms.com",
    "password": "Test@123"
  }'

# Try to delete employee (should fail with 403)
curl -X DELETE http://localhost:5000/api/v1/employees/EMPLOYEE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 403 Forbidden
```

### Test Scenario 3: View Employee Hierarchy

#### ✅ Allowed Roles
- SUPER_ADMIN
- ORG_ADMIN
- HR_MANAGER
- MANAGER

#### ❌ Blocked Roles
- EMPLOYEE

```bash
# Login as Manager
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@test.hrms.com",
    "password": "Test@123"
  }'

# View hierarchy (should work)
curl -X GET http://localhost:5000/api/v1/employees/EMPLOYEE_ID/hierarchy \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Role Permission Matrix

| Action | SUPER_ADMIN | ORG_ADMIN | HR_MANAGER | MANAGER | EMPLOYEE |
|--------|------------|-----------|------------|---------|----------|
| **View Employees** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Employee Details** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Create Employee** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Update Employee** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Employee** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Statistics** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **View Hierarchy** | ✅ | ✅ | ✅ | ✅ | ❌ |

## Frontend Testing

### Step 1: Start the Application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Step 2: Login with Different Roles

Open `http://localhost:3000` and login with any test user.

### Step 3: Test Role-Based UI

1. **As EMPLOYEE** (`employee@test.hrms.com`):
   - ✅ Can view employee list
   - ❌ "Add Employee" button should be hidden or disabled
   - ❌ Edit/Delete actions should be hidden or disabled

2. **As HR_MANAGER** (`hrmanager@test.hrms.com`):
   - ✅ Can view employee list
   - ✅ Can add new employees
   - ✅ Can edit employees
   - ❌ Delete button should be hidden or disabled

3. **As ORG_ADMIN** (`orgadmin@test.hrms.com`):
   - ✅ Can view employee list
   - ✅ Can add new employees
   - ✅ Can edit employees
   - ✅ Can delete employees

### Step 4: Test Employee Creation Flow

1. Login as `hrmanager@test.hrms.com` / `Test@123`
2. Navigate to **Employees** page
3. Click **"Add Employee"**
4. Fill in the form:
   - **Personal Info Tab:**
     - First Name: Test
     - Last Name: User
     - Email: testuser@test.com
     - Phone: 1234567890
     - Date of Birth: 1990-01-01
     - Gender: Male
   - **Employment Tab:**
     - Department: Information Technology
     - Position: Software Developer
     - Reporting Manager: IT Manager (EMP003)
     - Joining Date: 2026-01-15
     - Status: Active
   - **Contact & Address Tab:**
     - Address Line 1: 123 Test St
     - City: Test City
     - State: Test State
     - Postal Code: 12345
     - Country: USA
     - Emergency Contact Name: Test Contact
     - Emergency Contact Relationship: Spouse
     - Emergency Contact Phone: 9876543210
5. Click **"Create Employee"**
6. ✅ Should see success message
7. ✅ Employee should appear in the list with auto-generated code (EMP00006)

## Troubleshooting

### Error: "Can't reach database server"

**Solution:** Make sure your database is running and accessible.

```bash
# Check DATABASE_URL in backend/.env
cat backend/.env | grep DATABASE_URL

# Test connection
cd backend
npx prisma db execute --stdin <<< "SELECT 1;"
```

### Error: "Email already exists"

**Solution:** The seed script tries to delete existing test users first. If this fails, manually delete them:

```sql
-- In pgAdmin or psql
DELETE FROM "Employee" WHERE email LIKE '%@test.hrms.com';
DELETE FROM "User" WHERE email LIKE '%@test.hrms.com';
DELETE FROM "Organization" WHERE code = 'TESTCORP';
```

### Re-run Seed Script

To completely reset test data:

```bash
# Option 1: Run seed script again (it clears existing test data first)
cd backend
npm run seed

# Option 2: Reset entire database (⚠️ CAREFUL - deletes ALL data)
cd backend
npx prisma migrate reset
# This will:
# 1. Drop the database
# 2. Create a new database
# 3. Run all migrations
# 4. Run the seed script automatically
```

## Getting Organization ID

After seeding, you'll need the Organization ID for API calls:

```bash
# Method 1: Check seed script output
npm run seed
# Look for: "Organization created: Test Corp Inc (ID: ...)"

# Method 2: Query database
npx prisma studio
# Open "Organization" table and copy the ID

# Method 3: SQL query
# In pgAdmin:
SELECT id, name, code FROM "Organization" WHERE code = 'TESTCORP';
```

## Notes

- Test users have `@test.hrms.com` domain for easy identification
- All test users share the same password: `Test@123`
- Employee codes are auto-generated: EMP001, EMP002, etc.
- The seed script is **idempotent** - you can run it multiple times safely
- Existing test data will be cleared before creating new data

## Next Steps

1. ✅ Run `npm run seed`
2. ✅ Login to frontend with test users
3. ✅ Test role-based access control
4. ✅ Test employee CRUD operations
5. ✅ Verify permissions work as expected

Happy testing! 🎉
