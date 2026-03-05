# Configurator-Based Multi-Tenant HRMS Architecture

> **Core Rule:** Department, Sub Department, Role, Module, Permission, Branches, Cost Centres — **ONLY from Configurator DB**. HRMS does NOT have these tables.

---

## 1. System Overview

| System | Database | Responsibility |
|--------|----------|----------------|
| **Configurator** | `configurator_db` (PostgreSQL) | Companies, Users (login), Roles, Modules, Permissions, Branches, Cost Centres, Departments, Sub Departments |
| **HRMS** | `hrms_db` (PostgreSQL) | Organization (synced), Employee (HR details), Attendance, Leave, Payroll, Shifts, etc. |

**Reference:** Configurator project at `D:\git\New-Configurator`

---

## 2. Configurator Schema (Source of Truth)

**Important:** Config DB stores all IDs as **INT** (not UUID). Department, sub_department, role, cost_centre, branch, module — all use integer IDs.

| Table | Key Fields | ID Type |
|-------|------------|---------|
| `companies` | id, name, code, primaryDomain, projectIdsCsv | **Int** |
| `users` | id, email, password, companyId, firstName, lastName | **Int** |
| `roles` | id, companyId, code, name, allAccess | **Int** |
| `branches` | id, companyId, branchName, code | **Int** |
| `cost_centres` | id, companyId, name, code | **Int** |
| `departments` | id, costCentreId, name, code | **Int** |
| `sub_departments` | id, departmentId, name, code | **Int** |
| `project_modules` | id, projectId, name, code | **Int** |
| `role_module_permissions` | companyId, roleId, projectId, moduleId, isEnabled | Int |

---

## 3. HRMS Schema (Revised)

### 3.1 Tables HRMS MUST Have (with configurator_id)

| Table | configurator_id Column | Purpose |
|------|------------------------|---------|
| `organizations` | `configurator_company_id` INT | Links to configurator `companies.id` |
| `users` | `configurator_user_id` INT | Links to configurator `users.id` |
| `employees` | `configurator_user_id` INT | Links to configurator `users.id` |

### 3.2 Tables HRMS MUST NOT Have (Fetch from Configurator API)

- ~~departments~~ → `GET /companies/:companyId/departments` (Add via `POST` — proxy to Configurator)
- ~~sub_departments~~ → `GET /companies/:companyId/sub-departments`
- ~~roles~~ → `GET /companies/:companyId/roles`
- ~~branches~~ → `GET /companies/:companyId/branches`
- ~~cost_centres~~ → `GET /companies/:companyId/cost-centres`
- ~~modules~~ → `GET /projects/:projectId/modules`
- ~~permissions~~ → `GET /companies/:companyId/roles/:roleId/projects/:projectId/module-permissions`

### 3.3 HRMS Tables That Reference Configurator (configurator_id)

Config DB uses **INT** for all IDs. HRMS stores `configurator_id` as INT:

```sql
-- Employee: reference configurator entities by ID (all INT in config DB)
ALTER TABLE employees ADD COLUMN department_configurator_id INT;
ALTER TABLE employees ADD COLUMN sub_department_configurator_id INT;
ALTER TABLE employees ADD COLUMN cost_centre_configurator_id INT;
ALTER TABLE employees ADD COLUMN branch_configurator_id INT;
ALTER TABLE employees ADD COLUMN role_configurator_id INT;
```

---

## 4. Flow Diagrams

### 4.1 Company Creation + Company Admin (Config → HRMS)

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Configurator       │     │  company_hrms_sync    │     │  HRMS DB            │
│  (Create Company)   │     │  (in config DB)       │     │                     │
└──────────┬──────────┘     └──────────┬────────────┘     └──────────┬──────────┘
           │                           │                            │
           │ 1. INSERT companies       │                            │
           │    id=int, name="BNC"     │                            │
           │                           │                            │
           │ 2. createSystemAdminFor   │                            │
           │    Company (SYSTEM_ADMIN) │                            │
           │                           │                            │
           │ 3. HRMS project assigned? │                            │
           │    → syncCompanyToHrms()   │                            │
           │                           │ 4. Create organization     │
           │                           │    INSERT organizations     │
           │                           │    (name, address, ...)     │
           │                           │───────────────────────────►│
           │                           │                            │
           │                           │ 5. company_hrms_sync       │
           │                           │    configurator_company_id  │
           │                           │    hrms_company_id          │
           │                           │◄───────────────────────────│
           │                           │                            │
           │ 6. Company Admin created   │                            │
           │    via POST /companies/   │                            │
           │    :id/users + assign     │                            │
           │    COMPANY_ADMIN role     │                            │
           │                           │ 7. user_hrms_sync          │
           │                           │    → HRMS users table      │
           │                           │    → HRMS employees (if     │
           │                           │       company admin is     │
           │                           │       also employee)       │
           │                           │───────────────────────────►│
```

### 4.2 Login Flow (HRMS Portal)

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  HRMS       │     │  Configurator API    │     │  configurator_db    │
│  Portal     │     │  /auth/login         │     │  users table        │
└──────┬──────┘     └──────────┬──────────┘     └──────────┬──────────┘
       │                       │                           │
       │  POST /auth/login     │                           │
       │  { email, password }  │                           │
       │  (company domain?)    │                           │
       │─────────────────────►│                           │
       │                       │  Validate credentials     │
       │                       │  SELECT * FROM users      │
       │                       │  WHERE email=?           │
       │                       │─────────────────────────►│
       │                       │                           │
       │                       │  user + companyId + roles  │
       │                       │◄─────────────────────────│
       │                       │                           │
       │  { user_id, company_id,                           │
       │    role_id, token }   │                           │
       │◄─────────────────────│                           │
       │                       │                           │
       │  HRMS loads employee  │                           │
       │  WHERE configurator_  │                           │
       │  user_id = ?          │                           │
       │  (from hrms_db)        │                           │
       │                       │                           │
```

**Rule:** HRMS NEVER authenticates from hrms_db.users. Login ALWAYS goes to Configurator.

### 4.3 Department Add from HRMS (Company Admin)

Company admin logs into HRMS and adds Department. Department is stored in **Config DB only** (HRMS proxies to Configurator API).

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  HRMS       │     │  HRMS Backend        │     │  Configurator API     │
│  Portal     │     │  (proxy)             │     │  configurator_db      │
└──────┬──────┘     └──────────┬──────────┘     └──────────┬──────────┘
       │                       │                           │
       │  POST /departments     │                           │
       │  { name, code,        │                           │
       │    costCentreId }      │                           │
       │──────────────────────►│                           │
       │                       │  POST /companies/:id/      │
       │                       │  departments               │
       │                       │  (with configurator token)  │
       │                       │──────────────────────────►│
       │                       │                           │
       │                       │  INSERT departments        │
       │                       │  (configurator_db)          │
       │                       │◄───────────────────────────│
       │  { id, name }         │                           │
       │◄──────────────────────│                           │
```

**Same pattern for:** Sub Department, Cost Centre, Branch, Role — HRMS UI → HRMS proxy → Configurator API → Config DB.

### 4.4 Employee Creation (Company Admin in HRMS)

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  HRMS       │     │  Configurator API    │     │  HRMS DB             │
│  (Company   │     │  POST /users         │     │  employees           │
│   Admin)    │     │                      │     │                      │
└──────┬──────┘     └──────────┬──────────┘     └──────────┬──────────┘
       │                       │                           │
       │  Create Employee form │                           │
       │  (department, role from│                           │
       │   Configurator API)    │                           │
       │                       │                           │
       │  STEP 1: Create user in Configurator               │
       │  POST /companies/:id/users                          │
       │  { email, firstName, lastName,                     │
       │    roleIds: [configurator_role_id] }               │
       │─────────────────────►│                           │
       │                       │  INSERT users              │
       │                       │  INSERT user_roles         │
       │                       │  → user_hrms_sync          │
       │  { user_id }          │  (creates HRMS user)       │
       │◄─────────────────────│                           │
       │                       │                           │
       │  STEP 2: Create employee in HRMS                   │
       │  POST /hrms/employees                              │
       │  { configurator_user_id,                            │
       │    department_configurator_id,                     │
       │    cost_centre_configurator_id,                    │
       │    ... }                                            │
       │──────────────────────────────────────────────────►│
       │                       │                           │
       │  { employee_id }      │  INSERT employees          │
       │◄──────────────────────────────────────────────────│
```

**Note:** Configurator `user_hrms_sync` auto-creates HRMS `users` when user is created in Configurator. HRMS only creates `employees` record.

### 4.5 Leave Apply Flow

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  HRMS       │     │  Configurator       │     │  HRMS DB            │
│  Client     │     │  (token + perms)     │     │  leave_requests      │
└──────┬──────┘     └──────────┬──────────┘     └──────────┬──────────┘
       │                       │                           │
       │  POST /leave          │                           │
       │  Authorization: Bearer token                      │
       │  { leave_type, from_date, to_date }               │
       │                       │                           │
       │  1. Verify token      │                           │
       │  2. Get user_id, company_id                       │
       │  3. Check module permission (apply_leave)          │
       │─────────────────────►│                           │
       │  { user_id, company_id, permissions }             │
       │◄─────────────────────│                           │
       │                       │                           │
       │  Get employee_id from employees                   │
       │  WHERE configurator_user_id = user_id             │
       │                       │                           │
       │  INSERT leave_requests                            │
       │  (company_id, employee_id, ...)                   │
       │──────────────────────────────────────────────────►│
```

---

## 5. Configurator APIs for HRMS to Use

| Purpose | Endpoint | When HRMS Uses |
|---------|----------|-----------------|
| Login | `POST /auth/login` | Every HRMS login |
| Departments | `GET /companies/:companyId/departments` | Employee form dropdown |
| Sub Departments | `GET /companies/:companyId/sub-departments` | Employee form dropdown |
| Roles | `GET /companies/:companyId/roles` | User creation, permission check |
| Branches | `GET /companies/:companyId/branches` | Employee form, location |
| Cost Centres | `GET /companies/:companyId/cost-centres` | Employee form |
| Modules | `GET /projects/:projectId/modules` | Module list for HRMS project |
| Role Permissions | `GET /companies/:companyId/roles/:roleId/projects/:projectId/module-permissions` | Check if user can apply_leave, view_attendance, etc. |
| Create User | `POST /companies/:companyId/users` | When creating employee |
| **Add Department** | `POST /companies/:companyId/departments` | HRMS proxy when company admin adds dept |
| **Add Sub Department** | `POST /companies/:companyId/sub-departments` | HRMS proxy |
| **Add Cost Centre** | `POST /companies/:companyId/cost-centres` | HRMS proxy |
| **Add Branch** | `POST /companies/:companyId/branches` | HRMS proxy |
| **Add Role** | `POST /companies/:companyId/roles` | HRMS proxy |

---

## 6. configurator_id Storage in HRMS

**Config DB uses INT for all IDs.** HRMS stores `configurator_id` as INT:

| Config Entity | Config ID Type | HRMS Column Type | Example |
|---------------|----------------|------------------|---------|
| Company | Int | `configurator_company_id` INT | `25`, `59` |
| User | Int | `configurator_user_id` INT | `101`, `205` |
| Role | Int | `role_configurator_id` INT | `3`, `7` |
| Department | Int | `department_configurator_id` INT | `12`, `45` |
| Sub Department | Int | `sub_department_configurator_id` INT | `8`, `22` |
| Cost Centre | Int | `cost_centre_configurator_id` INT | `5`, `11` |
| Branch | Int | `branch_configurator_id` INT | `1`, `2`, `59` |
| Module | Int | `module_configurator_id` INT | `1`, `2` |

**Rule:** HRMS uses UUID for its own primary keys. For config references, use `configurator_id` columns as **INT**.

---

## 7. Sync Tables (in Configurator DB)

| Table | Purpose |
|-------|---------|
| `company_hrms_sync` | configurator_company_id ↔ hrms_company_id |
| `user_hrms_sync` | configurator_user_id ↔ hrms_user_id |
| `cost_centre_hrms_sync` | configurator_cost_centre_id ↔ hrms_cost_centre_id |
| `branch_hrms_sync` | configurator_branch_id ↔ hrms_location_id |

**Note:** If HRMS does NOT have cost_centres, branches, departments tables, then cost_centre_hrms_sync and branch_hrms_sync are NOT needed. HRMS only stores `configurator_id` references.

---

## 8. HRMS Schema Changes Required

### 8.1 Add configurator_id to Existing Tables

```sql
-- organizations: link to configurator company (Config uses INT)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS configurator_company_id INT UNIQUE;

-- users: link to configurator user (synced via user_hrms_sync)
ALTER TABLE users ADD COLUMN IF NOT EXISTS configurator_user_id INT UNIQUE;

-- employees: link to configurator user
ALTER TABLE employees ADD COLUMN IF NOT EXISTS configurator_user_id INT UNIQUE;
```

### 8.2 Employee: Replace FK with configurator_id

Instead of:
- `department_id` → HRMS departments.id  
- `cost_centre_id` → HRMS cost_centres.id  
- `location_id` → HRMS locations.id  

Use (all INT — Config DB):
- `department_configurator_id` → configurator departments.id
- `cost_centre_configurator_id` → configurator cost_centres.id
- `branch_configurator_id` → configurator branches.id

**Migration path:** Keep existing columns during transition; add new configurator_id columns; update HRMS UI to fetch from Configurator and store configurator_id; eventually deprecate HRMS department/cost_centre/location FKs if no longer needed.

### 8.3 Remove or Deprecate (if applicable)

- HRMS `departments` table → Fetch from Configurator
- HRMS `sub_departments` table → Fetch from Configurator  
- HRMS `cost_centres` table → Fetch from Configurator
- HRMS `Permission`, `RolePermission` → Use Configurator role_module_permissions

**Caution:** If HRMS has existing data in these tables, migration is required. Option: Keep HRMS tables for legacy data but stop creating new records; new data uses configurator_id only.

---

## 9. Business Logic Conflicts & Recommendations

| Area | Conflict? | Action |
|------|-----------|--------|
| Employee create | No | Config user create → user_hrms_sync → HRMS user (auto) → HRMS employee create |
| Department add from HRMS | No | HRMS proxy → Configurator API → Config DB |
| Leave apply | No | Config permission check before insert |
| Attendance | No | Filter by configurator_id |
| Payroll (dept-wise) | Minor | Group by `department_configurator_id`; fetch names from Config API for display |
| Reports (dept/branch/cost centre) | Minor | Config API for names; HRMS stores only configurator_id for grouping |
| Approval workflows | Minor | Approver role from Config; check via Config API |

**Recommendation:** Cache department/role/branch/cost centre names from Config API for dropdowns and report display. HRMS stores only `configurator_id` (INT) for references.

---

## 10. Best Practices

| Area | Practice |
|------|----------|
| **Login** | HRMS login screen → Configurator `/auth/login` only. Never check hrms_db.users for password. |
| **Permissions** | HRMS checks `GET /configurator/.../module-permissions` before apply_leave, view_attendance, etc. |
| **Dropdowns** | Employee form: department, role, branch, cost centre → Fetch from Configurator API, store configurator_id (INT). |
| **Add Dept/Role/etc from HRMS** | HRMS proxy to Configurator API; stored in Config DB only. |
| **Token** | JWT from Configurator; HRMS validates token (or calls Configurator verify endpoint). |
| **Company Admin** | Created in Configurator via Companies → Users → Add User, assign COMPANY_ADMIN role. |
| **Employee Create** | 1) Configurator: create user (user_hrms_sync → HRMS users). 2) HRMS: create employee with configurator_user_id + configurator_ids (INT). |

---

## 11. Reference: Configurator Masters (from Screenshots)

From BNC Configurator UI:

- **Companies** → Edit Company (Projects: HRMS, Tally, CRM)
- **Masters** (per company): Cost Centres, Department, Sub Department, Roles, Currency, Users
- **Project Modules** → Modules for HRMS (e.g. Leave, Accepted leave)

All of these are in Configurator. HRMS only stores `configurator_id` references where needed.
