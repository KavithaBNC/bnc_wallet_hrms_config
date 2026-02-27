# RBAC Implementation Verification

## ✅ Quick Verification Checklist

### Backend Components

- [x] **RBAC Middleware** (`backend/src/middlewares/rbac.ts`)
  - [x] `employeeListAccess` middleware with organization filtering
  - [x] `getEmployeeFieldsByRole` for field-level access control
  - [x] Organization ID validation and auto-injection
  - [x] Cross-organization access blocked

- [x] **Routes** (`backend/src/routes/employee.routes.ts`)
  - [x] `employeeListAccess` middleware applied to GET /employees
  - [x] Route ordering correct (specific routes before generic)

- [x] **Controller** (`backend/src/controllers/employee.controller.ts`)
  - [x] Uses `getEmployeeFieldsByRole` for field filtering
  - [x] Passes selectFields to service

- [x] **Service** (`backend/src/services/employee.service.ts`)
  - [x] `getAll` method accepts optional selectFields parameter
  - [x] Database-level field filtering implemented

### Frontend Components

- [x] **RBAC Utilities** (`frontend/src/utils/rbac.ts`)
  - [x] `canCreateEmployee` function
  - [x] `canUpdateEmployee` function
  - [x] `canDeleteEmployee` function

- [x] **Protected UI** (`frontend/src/pages/EmployeesPage.tsx`)
  - [x] Conditional "New Employee" button rendering
  - [x] Conditional "Edit" button rendering
  - [x] Conditional "Delete" button rendering

### Test Data

- [x] **Seed Script** (`backend/prisma/seed.ts`)
  - [x] SUPER_ADMIN user
  - [x] ORG_ADMIN user with employee profile
  - [x] HR_MANAGER user with employee profile
  - [x] MANAGER user with employee profile
  - [x] EMPLOYEE user with employee profile
  - [x] Test organization created
  - [x] Departments and positions created

---

## 🧪 Manual Testing Guide

### Prerequisites

1. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   # Backend runs on http://localhost:5000
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   # Frontend runs on http://localhost:3000
   ```

3. **Seed Test Data (if not done):**
   ```bash
   cd backend
   npm run seed
   ```

---

## 🚀 Quick Test (Automated)

Run the automated test script:

```bash
cd /home/user/hrms_2026
./test_rbac.sh
```

This will:
- ✅ Login all test users
- ✅ Test employee list access for each role
- ✅ Verify organization-based filtering
- ✅ Test cross-organization access blocking
- ✅ Test create/delete permissions
- ✅ Generate detailed report

---

## 🖱️ Manual UI Testing

### Test 1: EMPLOYEE Role (Read-Only)

1. **Login:**
   - URL: http://localhost:3000
   - Email: `employee@test.hrms.com`
   - Password: `Test@123`

2. **Navigate to Employees Page**

3. **Expected Behavior:**
   - ✅ Can view employee list
   - ❌ "New Employee" button hidden
   - ❌ "Edit" button hidden
   - ❌ "Delete" button hidden
   - ✅ "View" button visible
   - ✅ Only basic employee fields shown (no sensitive data)

---

### Test 2: MANAGER Role (View Only)

1. **Login:**
   - Email: `manager@test.hrms.com`
   - Password: `Test@123`

2. **Navigate to Employees Page**

3. **Expected Behavior:**
   - ✅ Can view employee list
   - ❌ "New Employee" button hidden
   - ❌ "Edit" button hidden
   - ❌ "Delete" button hidden
   - ✅ "View" button visible
   - ✅ Some sensitive fields visible (phone, email, dateOfJoining)
   - ❌ No salary, address, emergency contacts

---

### Test 3: HR_MANAGER Role (Create & Update)

1. **Login:**
   - Email: `hrmanager@test.hrms.com`
   - Password: `Test@123`

2. **Navigate to Employees Page**

3. **Expected Behavior:**
   - ✅ Can view employee list
   - ✅ "New Employee" button visible
   - ✅ "Edit" button visible
   - ❌ "Delete" button hidden
   - ✅ All sensitive fields visible
   - ✅ Can create new employees
   - ✅ Can edit employees

4. **Test Create:**
   - Click "New Employee"
   - Fill all fields
   - Submit
   - Should succeed ✅

5. **Test Delete (should fail):**
   - Try to delete via API (button hidden in UI)
   - Should get 403 error ❌

---

### Test 4: ORG_ADMIN Role (Full Access)

1. **Login:**
   - Email: `orgadmin@test.hrms.com`
   - Password: `Test@123`

2. **Navigate to Employees Page**

3. **Expected Behavior:**
   - ✅ Can view employee list
   - ✅ "New Employee" button visible
   - ✅ "Edit" button visible
   - ✅ "Delete" button visible
   - ✅ All sensitive fields visible
   - ✅ Can create employees
   - ✅ Can edit employees
   - ✅ Can delete employees

4. **Test Full CRUD:**
   - Create employee ✅
   - Edit employee ✅
   - Delete employee ✅
   - All should succeed

---

### Test 5: SUPER_ADMIN Role (System-Wide)

1. **Login:**
   - Email: `superadmin@test.hrms.com`
   - Password: `Test@123`

2. **Expected Behavior:**
   - ✅ Can access all organizations
   - ✅ No organization filter enforced
   - ✅ Full CRUD access
   - ✅ Can view all data

---

## 🔒 Security Testing

### Test Cross-Organization Access

**Using curl (replace TOKEN and ORG_IDs):**

```bash
# Login as ORG_ADMIN
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"orgadmin@test.hrms.com","password":"Test@123"}' \
  | jq -r '.data.tokens.accessToken')

# Get user's organizationId
MY_ORG=$(curl -s -X GET http://localhost:5000/api/v1/employees?limit=1 \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data.employees[0].organizationId')

echo "My Organization: $MY_ORG"

# Try to access different organization
FAKE_ORG="00000000-0000-0000-0000-000000000000"

curl -X GET "http://localhost:5000/api/v1/employees?organizationId=$FAKE_ORG" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Expected Response: 403 Forbidden
# {
#   "status": "error",
#   "statusCode": 403,
#   "message": "Access denied. You can only view employees from your organization."
# }
```

**Result:** Should get 403 error ✅

---

## 📊 Expected Permission Matrix

| Action | SUPER_ADMIN | ORG_ADMIN | HR_MANAGER | MANAGER | EMPLOYEE |
|--------|:-----------:|:---------:|:----------:|:-------:|:--------:|
| **View Employees** | ✅ All Orgs | ✅ Own Org | ✅ Own Org | ✅ Own Org | ✅ Own Org |
| **View Sensitive Data** | ✅ Full | ✅ Full | ✅ Full | 🔶 Partial | ❌ None |
| **Create Employee** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Update Employee** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Employee** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Cross-Org Access** | ✅ | ❌ | ❌ | ❌ | ❌ |

**Legend:**
- ✅ = Allowed
- ❌ = Denied
- 🔶 = Limited (phone, email, dateOfJoining only)

---

## 🐛 Troubleshooting

### Issue: "Employee profile not found"

**Cause:** User account exists but no employee record

**Solution:**
```sql
-- Check if user has employee record
SELECT u.email, u.role, e.id as employee_id, e."organizationId"
FROM "User" u
LEFT JOIN "Employee" e ON u.id = e."userId"
WHERE u.email = 'your@email.com';

-- If employee is NULL, create one or run seed script
```

### Issue: "Cannot reach database"

**Cause:** Database not accessible from current machine

**Solution:**
- Run tests on the machine where pgAdmin works
- Check AWS RDS security group allows your IP
- Verify database is running

### Issue: All roles have same permissions

**Cause:** RBAC middleware not applied or not working

**Solution:**
1. Check route order in `employee.routes.ts`
2. Verify middleware is imported and used
3. Check backend logs for errors
4. Restart backend server

### Issue: Cross-org access not blocked

**Cause:** Organization filtering not working

**Solution:**
1. Verify `employeeListAccess` middleware is async
2. Check Prisma query is fetching organizationId
3. Verify query parameter override logic
4. Check backend logs for errors

---

## ✅ Success Indicators

All tests pass if:

1. ✅ EMPLOYEE role has no create/edit/delete buttons
2. ✅ MANAGER role has no create/edit/delete buttons
3. ✅ HR_MANAGER can create/edit but not delete
4. ✅ ORG_ADMIN can create/edit/delete
5. ✅ SUPER_ADMIN has full access
6. ✅ Non-SUPER_ADMIN users blocked from other organizations
7. ✅ Sensitive data hidden for EMPLOYEE/MANAGER roles
8. ✅ Database queries only fetch required fields per role

---

## 📝 Test Results Template

```
Test Date: __________
Tester: __________

EMPLOYEE Role:
[ ] View employees
[ ] No create button
[ ] No edit button
[ ] No delete button
[ ] No sensitive data in response

MANAGER Role:
[ ] View employees
[ ] No create button
[ ] No edit button
[ ] No delete button
[ ] Partial sensitive data (phone, email, dateOfJoining)

HR_MANAGER Role:
[ ] View employees
[ ] Create employee works
[ ] Edit employee works
[ ] Delete employee blocked (403)
[ ] Full sensitive data visible

ORG_ADMIN Role:
[ ] View employees
[ ] Create employee works
[ ] Edit employee works
[ ] Delete employee works
[ ] Full sensitive data visible

SUPER_ADMIN Role:
[ ] View all organizations
[ ] Full CRUD access
[ ] No restrictions

Security Tests:
[ ] Cross-org access blocked for ORG_ADMIN
[ ] Cross-org access blocked for HR_MANAGER
[ ] Cross-org access blocked for MANAGER
[ ] Cross-org access blocked for EMPLOYEE
[ ] SUPER_ADMIN can access all orgs

Performance Tests:
[ ] EMPLOYEE role gets smaller payload
[ ] Database queries only fetch required fields
[ ] No post-processing field filtering
```
