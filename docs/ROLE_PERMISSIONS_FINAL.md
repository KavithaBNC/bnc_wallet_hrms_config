# Final Role Permissions Structure

## ✅ Correct Role Permissions

### 1. **ORG_ADMIN (Organization Admin)**
- ✅ **Can see ALL data for their organization only**
- ✅ Full access to employees, departments, positions, attendance, leaves within their organization
- ✅ Cannot access other organizations' data
- ✅ Can manage their organization settings

**Example:**
- ORG_ADMIN of "Acme Corp" can see all Acme Corp employees
- ORG_ADMIN of "Acme Corp" CANNOT see "Tech Inc" employees

---

### 2. **SUPER_ADMIN (HRMS Admin / Platform Owner)**
- ✅ **Can see ALL organization data across ALL organizations**
- ✅ Full access to employees, departments, positions, attendance, leaves from ALL organizations
- ✅ Can create organizations
- ✅ Can create ORG_ADMIN users for each organization
- ✅ Can view organization statistics for any organization
- ✅ System-level management

**Example:**
- SUPER_ADMIN can see all employees from "Acme Corp" AND "Tech Inc" AND all other organizations
- SUPER_ADMIN can view statistics for any organization
- SUPER_ADMIN can access any organization's data

---

## 📊 Permission Matrix

| Action | SUPER_ADMIN | ORG_ADMIN | HR_MANAGER | MANAGER | EMPLOYEE |
|--------|-------------|-----------|------------|---------|----------|
| **Create Organizations** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Create ORG_ADMIN** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View All Organizations** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View All Employees (All Orgs)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View All Employees (Own Org)** | ✅ | ✅ | ✅ | ⚠️ Limited | ❌ |
| **View Own Employee Data** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Create Employees** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **View Organization Statistics** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Manage Departments** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Manage Positions** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **View Attendance (All Orgs)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View Attendance (Own Org)** | ✅ | ✅ | ✅ | ⚠️ Team Only | ❌ |
| **View Leaves (All Orgs)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View Leaves (Own Org)** | ✅ | ✅ | ✅ | ⚠️ Team Only | ❌ |

---

## 🔄 Updated Implementation

### RBAC Middleware (`backend/src/middlewares/rbac.ts`)

**SUPER_ADMIN:**
```typescript
case 'SUPER_ADMIN':
  // HRMS_ADMIN (Platform Owner) - Full access to ALL organizations' data
  req.rbac = {
    canViewAll: true,
    canViewSensitive: true,
    restrictToDepartment: false,
    restrictToReports: false,
    organizationId: null, // No restriction - can see all organizations
  };
  break;
```

**ORG_ADMIN:**
```typescript
case 'ORG_ADMIN':
  // Full access within organization
  req.rbac = {
    canViewAll: true,
    canViewSensitive: true,
    restrictToDepartment: false,
    restrictToReports: false,
    organizationId: userOrganizationId, // Restricted to their org
  };
  break;
```

---

## 🎯 Key Differences

### SUPER_ADMIN vs ORG_ADMIN

| Feature | SUPER_ADMIN | ORG_ADMIN |
|---------|-------------|-----------|
| **Scope** | All organizations | One organization only |
| **Can Create Orgs** | ✅ Yes | ❌ No |
| **Can Create ORG_ADMIN** | ✅ Yes | ❌ No |
| **View Employees** | ✅ All orgs | ✅ Own org only |
| **View Statistics** | ✅ All orgs | ✅ Own org only |
| **Data Isolation** | ❌ No (sees all) | ✅ Yes (org-scoped) |

---

## ✅ Summary

**Your understanding is CORRECT:**

1. ✅ **ORG_ADMIN** can see all data **only for their organization**
2. ✅ **SUPER_ADMIN** can see **all organization data** (across all organizations)

**Implementation Status:** ✅ Updated to match your requirements
