# HRMS Role Structure Clarification

## ✅ Correct Role Structure (As Per Your Requirement)

### HRMS ADMIN (Platform/System Owner)
- **Role Name**: `HRMS_ADMIN` or `SUPER_ADMIN` (to be renamed)
- **Responsibilities**:
  - ✅ Creates Organizations
  - ✅ Creates Organization Super Admin for each org
  - ✅ System-level settings
  - ❌ **NO access to org's internal data** (employees, departments, attendance, leaves, etc.)

### ORG_ADMIN (Organization Super Admin)
- **Role Name**: `ORG_ADMIN`
- **Responsibilities**:
  - ✅ Full access to their organization's data
  - ✅ Manages employees, departments, positions
  - ✅ Manages leave policies, attendance settings
  - ✅ Can create HR_MANAGER, MANAGER, EMPLOYEE roles within their org
  - ❌ Cannot access other organizations' data

### HR_MANAGER
- **Role Name**: `HR_MANAGER`
- **Responsibilities**:
  - ✅ Full access within their organization
  - ✅ Manages HR operations (employees, leaves, attendance)
  - ❌ Cannot access other organizations' data

### MANAGER
- **Role Name**: `MANAGER`
- **Responsibilities**:
  - ✅ View team members
  - ✅ Approve leaves for team
  - ✅ View team attendance
  - ❌ Limited sensitive data access

### EMPLOYEE
- **Role Name**: `EMPLOYEE`
- **Responsibilities**:
  - ✅ View own profile
  - ✅ Apply for leaves
  - ✅ Check-in/out for attendance
  - ❌ Cannot view other employees' data

---

## ⚠️ Current Implementation Issue

**Current Behavior:**
- `SUPER_ADMIN` has **FULL ACCESS** to all organizations' data
- Can view all employees, departments, attendance, leaves across all orgs
- This does NOT match your requirement

**Required Behavior:**
- `HRMS_ADMIN` (or renamed `SUPER_ADMIN`) should:
  - ✅ Create organizations
  - ✅ Create ORG_ADMIN users for each organization
  - ✅ Manage system settings
  - ❌ **BLOCKED** from viewing any organization's internal data

---

## 🔧 Required Changes

### 1. Update RBAC Middleware
**File**: `backend/src/middlewares/rbac.ts`

**Current Code (Line 57-65):**
```typescript
case 'SUPER_ADMIN':
  // Full access - can view all organizations
  req.rbac = {
    canViewAll: true,
    canViewSensitive: true,
    restrictToDepartment: false,
    restrictToReports: false,
    organizationId: null, // No restriction
  };
  break;
```

**Required Change:**
```typescript
case 'SUPER_ADMIN': // or 'HRMS_ADMIN'
  // Platform admin - NO access to org data
  // Can only manage organizations, not their data
  return next(new AppError(
    'HRMS Admin cannot access organization data. Use organization-specific admin account.',
    403
  ));
  break;
```

### 2. Update Organization Routes
**File**: `backend/src/routes/organization.routes.ts`

**Current**: SUPER_ADMIN can view all organizations ✅ (correct)
**Required**: SUPER_ADMIN can create organizations ✅ (correct)
**Required**: SUPER_ADMIN can create ORG_ADMIN users ✅ (needs implementation)

### 3. Block Data Access Endpoints
**Files**: All data access routes (employees, departments, attendance, leaves, etc.)

**Required**: Add check to block SUPER_ADMIN from accessing:
- `/api/v1/employees` (except for creating ORG_ADMIN)
- `/api/v1/departments` (except system-level)
- `/api/v1/attendance`
- `/api/v1/leaves`
- Any organization-specific data

### 4. Create ORG_ADMIN User Endpoint
**New Endpoint**: `POST /api/v1/organizations/:id/admins`

**Purpose**: Allow HRMS_ADMIN to create ORG_ADMIN users for specific organizations

---

## 📋 Implementation Plan

### Phase 1: Restrict Data Access
1. ✅ Update `rbac.ts` to block SUPER_ADMIN from org data
2. ✅ Update all service methods to check role before data access
3. ✅ Add specific error messages for HRMS_ADMIN trying to access org data

### Phase 2: Create ORG_ADMIN Endpoint
1. ✅ Create `POST /api/v1/organizations/:id/admins` endpoint
2. ✅ Allow HRMS_ADMIN to create ORG_ADMIN users
3. ✅ Link ORG_ADMIN to specific organization

### Phase 3: System Settings
1. ✅ Create system settings endpoints (HRMS_ADMIN only)
2. ✅ Separate organization settings from system settings

---

## 🎯 Summary

**Your requirement is CORRECT!**

The current implementation needs to be updated to:
- ✅ Keep SUPER_ADMIN ability to create organizations
- ✅ Add ability to create ORG_ADMIN for each org
- ✅ **BLOCK** SUPER_ADMIN from accessing any organization's internal data
- ✅ Ensure ORG_ADMIN has full access to their organization only

Would you like me to implement these changes?
