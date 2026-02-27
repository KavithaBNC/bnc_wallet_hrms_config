# Configurator–HRMS Modules Integration – Discussion & Decisions

**Date:** Feb 26, 2025  
**Context:** Configurator as single source for modules; HRMS integration approach.

---

## 1. Definitions

### 1.1 HRMS Module Terms

| Term | Definition | Location |
|------|-------------|----------|
| **resource** | Unique identifier for a module used in permission checks (e.g. `employees`, `attendance`, `leaves`) | `permissions` table, `APP_MODULES`, `organization_modules` |
| **path** | Frontend route (e.g. `/employees`, `/attendance`) | `frontend/src/config/modules.ts` |
| **label** | Display name shown in sidebar (e.g. "Employees", "Event") | `APP_MODULES` |
| **controller** | Backend route handler; determined by path (e.g. `/employees` → `employee.controller`) | `backend/src/routes/*.ts` |

### 1.2 Configurator Module Terms

| Term | Definition | Location |
|------|-------------|----------|
| **name** | Display name (e.g. "Employees", "Attendance") | `project_modules` table |
| **code** | Unique identifier, uppercase (e.g. `EMPLOYEES`, `ATTENDANCE`) | `project_modules` table, required in create form |

### 1.3 HRMS Tables Related to Modules

| Table | Purpose | Stores |
|-------|---------|--------|
| **organization_modules** | Per-org enabled modules | `organization_id` + `resource` (VARCHAR) |
| **permissions** | Master list of permissions | `resource` + `action` (read/create/update/delete) |
| **role_permissions** | Role → permission mapping | `role_id` + `permission_id` + `organization_id` |

**Note:** HRMS has **no** dedicated `modules` table. Master module definitions (path, label, resource) live in **code** (`APP_MODULES`, `ASSIGNABLE_MODULE_RESOURCES`).

---

## 2. Discussion Summary

### 2.1 HRMS Table vs Configurator for Modules

**Question:** HRMS modules were loaded from `organization_modules`. If we switch to Configurator, will there be conflict?

**Decision:** No conflict if:
- HRMS stops reading from `organization_modules` for module list
- HRMS fetches modules from Configurator API
- HRMS uses Configurator response for sidebar, permissions, etc.

**Migration:**
1. Add Configurator API fetch for modules
2. Replace HRMS module usage with Configurator data
3. Deprecate/remove HRMS `organization_modules` table (optional, can keep as fallback)

---

### 2.2 Module Name vs Controller Mapping

**Question:** Configurator module form only has module name – how does HRMS identify the correct controller?

**Finding:** Configurator module form has **both** `name` and `code`:
- `name` – display (e.g. "Employees", "Event")
- `code` – required, unique, uppercase (e.g. `EMPLOYEES`, `ATTENDANCE`)

**Mapping approach:**
- Use Configurator `code` → HRMS `resource`
- HRMS keeps mapping: `code.toLowerCase()` or explicit `CONFIGURATOR_CODE_TO_HRMS_RESOURCE` config
- Example: `EMPLOYEES` → `employees` → path `/employees` → `employee.controller`

---

### 2.3 New Module in HRMS – Where to Add?

**Question:** If we create a new module in HRMS, should it be added to Configurator? Should HRMS store it?

**Decision:**

| Data | Where to store |
|------|----------------|
| Master module list (path, resource, label) | HRMS code – `APP_MODULES`, `ASSIGNABLE_MODULE_RESOURCES` |
| Per-org enabled modules | Configurator (fetch via API) or HRMS `organization_modules` (if no Configurator) |

**New module flow:**
1. HRMS developer adds to code (modules.ts, routes, permissions)
2. Configurator admin adds module in Configurator UI (or HRMS syncs via API)
3. HRMS fetches from Configurator for org-level enable/disable

---

### 2.4 Configurator-First Approach (Chosen)

**Question:** Can we use Configurator module add form as primary, and HRMS fetches from there?

**Decision:** Yes. Configurator-first flow:

```
Configurator Module Add Form (single place)
        │
        ▼
Configurator stores module (name, code, project)
        │
        ▼
HRMS fetches modules from Configurator API
        │
        ▼
HRMS maps code → resource, shows in sidebar / permissions
```

**Benefits:**
- Single source of truth for "which modules exist"
- Future modules: add in Configurator first → HRMS developer adds code + mapping
- HRMS `organization_modules` table becomes optional

---

## 3. Logic & Architecture

### 3.1 Current HRMS Module Flow

```
organization_modules (org_id, resource)
        │
        ▼
organization-module.service.getModules(orgId) → string[] (resources)
        │
        ▼
Frontend: APP_MODULES filtered by resources → sidebar, Module Permission screen
        │
        ▼
Backend: role_permissions + permissions → authorize checks
```

### 3.2 Proposed Configurator-Based Flow

```
Configurator API: GET /projects/:projectId/modules
        │
        ▼
Response: [{ id, name, code, ... }]
        │
        ▼
HRMS: map code → resource (CONFIGURATOR_CODE_TO_HRMS_RESOURCE)
        │
        ▼
Filter APP_MODULES by mapped resources → sidebar, permissions
```

### 3.3 Mapping: Configurator Code → HRMS Resource

| Configurator code | HRMS resource | Path |
|-------------------|---------------|------|
| EMPLOYEES | employees | /employees |
| ATTENDANCE | attendance | /attendance |
| EVENT / LEAVES | leaves | /leave |
| DEPARTMENTS | departments | /departments |
| PAYROLL | payroll | /payroll |
| SHIFTS | shifts | /time-attendance/shift-master |
| ... | ... | ... |

**Implementation:** HRMS config file `configurator-module-mapping.ts`:

```ts
export const CONFIGURATOR_CODE_TO_HRMS_RESOURCE: Record<string, string> = {
  EMPLOYEES: 'employees',
  ATTENDANCE: 'attendance',
  EVENT: 'leaves',
  LEAVES: 'leaves',
  DEPARTMENTS: 'departments',
  PAYROLL: 'payroll',
  SHIFTS: 'shifts',
  // ... add as new modules come
};
```

---

## 4. Implementation Checklist

- [ ] Create Configurator API client in HRMS backend
- [ ] Add `CONFIGURATOR_CODE_TO_HRMS_RESOURCE` mapping config
- [ ] Modify `organization-module.service.getModules()` to fetch from Configurator (with fallback to `organization_modules`)
- [ ] Ensure Configurator project has HRMS modules with correct codes
- [ ] Update frontend to use Configurator-sourced modules for sidebar
- [ ] (Optional) Add "Sync modules to Configurator" if HRMS adds new module and needs to push

---

## 5. Open Doubts / To Decide

| # | Doubt | Options |
|---|-------|---------|
| 1 | Configurator project structure: One project per HRMS org, or one project for all? | TBD |
| 2 | Company vs Organization: Configurator uses `company`; HRMS uses `organization`. Mapping? | TBD |
| 3 | Configurator module "enabled for company" – how does that map to HRMS org? | TBD |
| 4 | Fallback: If Configurator API fails, use `organization_modules` or show error? | TBD |
| 5 | New module: Manual add in Configurator vs HRMS "Sync to Configurator" button? | Prefer Configurator add; sync optional |

---

## 6. Login, Auth & User Storage

### 6.1 Login Source

| Current | With Configurator |
|---------|-------------------|
| HRMS `users` table | Configurator `users` (company admin) or `configurator_users` (system admin) |
| HRMS `/auth/login` | Configurator `/auth/login` |

### 6.2 Company Super Admin – Tables

| DB | Table | Column for link |
|----|-------|-----------------|
| Configurator | `users` | `company_id` |
| HRMS | `users` (if kept) | `organization_id` |

**Recommended:** User in Configurator only; HRMS uses JWT from Configurator.

### 6.3 Employee Create – Tables Touched

| Step | Configurator | HRMS |
|------|--------------|------|
| User create | `users` (INSERT) | - |
| Employee create | - | `employees` (INSERT, config_user_id) |

**Why user table:** Employee needs login – auth, password, role. User stores that.

---

## 7. Config DB vs HRMS DB – Data Storage Split

### 7.1 What Goes Where

| Configurator DB | HRMS DB |
|-----------------|---------|
| Users (auth) | Organizations (minimal sync) |
| Companies | Employees (HR data + config_user_id) |
| Departments | Attendance |
| Sub Departments | Payroll |
| Cost Centres | Shifts |
| Branches (Locations) | Leave |
| Roles | Rules, Workflow |
| Modules | Event Config, Core HR, etc. |

### 7.2 User & Employee Tables

| Table | Location | Purpose |
|-------|----------|---------|
| **users** | Configurator only | Auth, login, roles |
| **employees** | HRMS only | HR data; `config_user_id` → Configurator user |

**Flow:**
```
Configurator: users (email, password, role)
                    │
                    └── config_user_id ──► HRMS: employees (dept, position, salary, ...)
```

### 7.3 HRMS Store Nothing – Everything in Config (Except HRMS Modules)

**Config DB stores:** Users, Company, Dept, SubDept, Cost Centre, Branch, Roles, Modules – all shared/master data.

**HRMS DB stores:** Only HRMS modules – Attendance, Payroll, Shifts, Leave, Rules, Employees (HR data).

---

## 8. Departments, Cost Centres, Locations – Configurator as Source

### 8.1 Options

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A** | Config only; HRMS fetches on-demand | No sync | API calls for every dropdown; Config down = no data |
| **B** | Config source; HRMS syncs (recommended) | Fast lookups; existing FK structure | Sync logic needed |

### 8.2 Employee Link

- **Option A:** `config_department_id`, `config_cost_centre_id`, `config_branch_id` in employee
- **Option B:** HRMS `departments`, `cost_centres`, `locations` with `configurator_id`; employee keeps `department_id` → HRMS table

---

## 9. Integration Time Estimate & Conflict Analysis

### 9.1 Time Estimate

| Task | Days |
|------|------|
| Auth – Configurator login | 1–2 |
| Users – Config only | 0.5–1 |
| Company / Org | 0.5 |
| Dept, Cost Centre, Branch | 1–2 |
| Modules – Config source | 1 |
| Employee – config_user_id | 1 |
| Schema changes | 0.5–1 |
| Testing | 2–3 |
| **Total** | **~8–12 days** |

### 9.2 HRMS Conflict Check

| Area | Conflict? |
|------|-----------|
| Auth | No |
| Users | No |
| Departments | No |
| Cost Centres | No |
| Locations | No |
| Modules | No |

### 9.3 Other Modules (Attendance, Payroll, etc.)

| Module | Conflict? | Reason |
|--------|-----------|--------|
| Attendance | No | employee_id, organization_id only |
| Payroll | No | employee_id, organization_id only |
| Shifts | No | employee_id, shift_id |
| Leave | No | employee_id |
| Rules / Workflow | Minor | department_id → config_department_id if needed |

---

## 10. Organization Table – Why HRMS Still Needs It

### 10.1 HRMS Uses organization_id Everywhere

| Table | Column | Purpose |
|-------|--------|---------|
| employees | organization_id | Employee belongs to org |
| attendance | organization_id | Filter by org |
| payroll | organization_id | Filter by org |
| departments | organization_id | Org-wise departments |
| cost_centres | organization_id | Org-wise cost centres |
| shifts | organization_id | Org-wise shifts |
| leave_requests | organization_id | Org-wise leave |
| ... | ... | All HRMS modules |

### 10.2 Recommendation

**Keep `organizations` table in HRMS** – minimal, synced from Configurator companies.

| Column | Purpose |
|--------|---------|
| id | Primary key |
| name | Display |
| configurator_company_id | Link to Configurator company |

All HRMS FKs (employee.organization_id, etc.) remain unchanged.

---

## 11. Related Docs

- [CONFIGURATOR_OPTION_B_INTEGRATION.md](./CONFIGURATOR_OPTION_B_INTEGRATION.md) – Department, SubDepartment, CostCentre, Branch integration
- `frontend/src/config/modules.ts` – HRMS `APP_MODULES`
- `backend/src/services/organization-module.service.ts` – Current module service
