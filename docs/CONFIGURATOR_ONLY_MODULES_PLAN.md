# Configurator-Only Module & Role Plan

**Goal:** HRMS-ல் உள்ள `permissions`, `role_permissions`, `organization_modules` எதையும் use பண்ணாமல், **Configurator DB tables மட்டும்** பயன்படுத்தி role-based modules காட்டுவது. எங்கும் conflict இருக்க கூடாது.

---

## 1. HRMS Tables – STOP Using (Conflict Avoid)

| Table | Current Use | Action |
|-------|-------------|--------|
| `permissions` | Master permission list | **DO NOT READ** |
| `role_permissions` | Role → permission mapping | **DO NOT READ** |
| `organization_modules` | Per-org enabled modules | **DO NOT READ** |
| `APP_MODULES` (frontend) | Sidebar source | Replace with Configurator fetch |

---

## 2. Configurator Tables – Single Source

| Table | Columns Used | Purpose |
|-------|--------------|---------|
| `project_modules` | id, name, code, parent_module, project_id | Module list (sidebar) |
| `role_module_permissions` | role_id, module_id, company_id, is_enabled | Role-based access |

---

## 3. Mapping Required (HRMS ↔ Configurator)

### 3.1 Organization ↔ Company

| HRMS | Configurator |
|------|--------------|
| `organizations.id` (UUID) | `role_module_permissions.company_id` (integer) |

**Add to HRMS `organizations` table:**
```sql
ALTER TABLE organizations ADD COLUMN configurator_company_id INTEGER UNIQUE;
```

### 3.2 User Role ↔ Configurator Role

| HRMS `users.role` | Configurator `role_module_permissions.role_id` |
|-------------------|-----------------------------------------------|
| SUPER_ADMIN | 1 (or mapping table) |
| ORG_ADMIN | 31 |
| HR_MANAGER | 38 |
| MANAGER | ... |
| EMPLOYEE | ... |

**Add to HRMS:** Config table or `hrms_role_configurator_mapping`:
```ts
// config/configurator-role-mapping.ts
export const HRMS_ROLE_TO_CONFIGURATOR_ROLE_ID: Record<string, number> = {
  SUPER_ADMIN: 1,
  ORG_ADMIN: 31,
  HR_MANAGER: 38,
  MANAGER: 40,   // example
  EMPLOYEE: 41,  // example
};
```

### 3.3 Module Code → HRMS Path

Configurator `project_modules.code` (e.g. M001, EMPLOYEES) → HRMS route path:

```ts
// config/configurator-module-mapping.ts
export const CONFIGURATOR_CODE_TO_HRMS_PATH: Record<string, string> = {
  M001: '/employees',
  M002: '/departments',
  M005: '/payroll',
  'EMPLOYEES': '/employees',
  'ATTENDANCE': '/attendance',
  'LEAVE': '/leave',
  // ... add all HRMS modules
};
```

---

## 4. New Flow (HRMS Open = Role-Based Modules)

```
User Login (HRMS)
       │
       ▼
Get user.role, user.employee.organizationId
       │
       ▼
Map: organization → configurator_company_id
     role → configurator_role_id
       │
       ▼
Configurator DB: SELECT module_id FROM role_module_permissions
                WHERE company_id = ? AND role_id = ? AND is_enabled = true
       │
       ▼
Join: project_modules WHERE id IN (module_ids)
       │
       ▼
Map: code → path (CONFIGURATOR_CODE_TO_HRMS_PATH)
       │
       ▼
Frontend: Show only these modules in sidebar
```

---

## 5. Implementation Steps

### Step 1: Schema (HRMS)

```prisma
model Organization {
  // ... existing
  configuratorCompanyId Int? @unique @map("configurator_company_id")
}
```

### Step 2: Configurator DB Connection

- Option A: Configurator REST API (preferred – no direct DB)
- Option B: Prisma second datasource to Configurator PostgreSQL

```env
CONFIGURATOR_DB_URL=postgresql://user:pass@host:5432/Bnc_Configurator
# OR
CONFIGURATOR_API_URL=https://configurator.example.com/api
```

### Step 3: New Backend Service

```ts
// backend/src/services/configurator-module.service.ts

export class ConfiguratorModuleService {
  /**
   * Get modules allowed for user (role + company).
   * Reads ONLY from Configurator: project_modules + role_module_permissions.
   */
  async getUserModules(
    configuratorCompanyId: number,
    configuratorRoleId: number,
    projectId: number = 4  // HRMS project
  ): Promise<{ path: string; label: string; code: string }[]> {
    // 1. Fetch role_module_permissions (company_id, role_id, is_enabled=true)
    // 2. Join project_modules
    // 3. Map code → path
    // 4. Return list for sidebar
  }
}
```

### Step 4: New API Endpoint

```
GET /api/v1/configurator/my-modules
  → Returns modules for current user (from Configurator only)
  → No use of permissions, role_permissions, organization_modules
```

### Step 5: Frontend Changes

**DashboardLayout.tsx:**
- Remove: `permissionService.getUserPermissions()`
- Add: `api.get('/configurator/my-modules')` 
- Sidebar: render only modules from this response
- Route guard: check if path is in allowed modules

### Step 6: Permission Middleware (Route Protection)

Replace `rolePermissionService.hasPermission()` with:

```ts
// Check: is user's path in Configurator allowed modules?
const allowedModules = await configuratorModuleService.getUserModules(...);
const resource = pathToResource(req.path);  // /employees → employees
const allowed = allowedModules.some(m => resourceFromCode(m.code) === resource);
```

---

## 6. Conflict Avoidance Checklist

- [ ] `permission.service.ts` – never called for module list
- [ ] `role-permission.service.ts` – never called for hasPermission (replace with Configurator check)
- [ ] `organization-module.service.ts` – never called (or only as fallback if Configurator down)
- [ ] `organization_modules` table – no reads
- [ ] `permissions` table – no reads
- [ ] `role_permissions` table – no reads
- [ ] Frontend `APP_MODULES` – use only for path→component mapping; visibility from Configurator API

---

## 7. Data Setup (One-Time)

1. **Organizations:** Set `configurator_company_id` for each HRMS org (map to Configurator company_id)
2. **Role mapping:** Create `HRMS_ROLE_TO_CONFIGURATOR_ROLE_ID` with correct Configurator role_ids
3. **Configurator:** Ensure `project_modules` has HRMS modules with correct `code`
4. **Configurator:** Ensure `role_module_permissions` has entries for each role+company+module

---

## 8. Fallback (Optional)

If Configurator API/DB is down:
- Option A: Show error "Configurator unavailable"
- Option B: Fallback to HRMS `organization_modules` + `role_permissions` (defeats "no conflict" goal)

Recommendation: No fallback – Configurator is single source. Fix Configurator if down.
