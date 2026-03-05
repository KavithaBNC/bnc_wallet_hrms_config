# HRMS Modules from Config DB — Working Plan

> **Goal:** HRMS modules stored in Config DB. Org Admin adds modules via form. Role-based module assignment and display from Config.

---

## 1. Current State vs Target

| Aspect | Current (HRMS) | Target (Config DB) |
|--------|----------------|-------------------|
| **Module definition** | `APP_MODULES` hardcoded in `frontend/config/modules.ts` | `project_modules` in Config DB (HRMS project) |
| **Module storage** | `organization_modules` (resource strings per org) | Config `project_modules` + `role_module_permissions` |
| **Add module** | Super Admin only, via Module Permission page | Org Admin form → Config API |
| **Role-module assignment** | `role_permissions` + `permissions` in HRMS | Config `role_module_permissions` |
| **Sidebar display** | Filter `APP_MODULES` by HRMS `getUserPermissions()` | Filter by Config `getModulePermissionsForUser()` |

---

## 2. Configurator API Reference

### 2.1 Module CRUD (Configurator)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/projects/:projectId/modules` | List all modules for HRMS project |
| POST | `/projects/:projectId/modules` | Create module |
| PUT | `/projects/:projectId/modules/:moduleId` | Update module |
| DELETE | `/projects/:projectId/modules/:moduleId` | Delete module |

**Create Module Request Body:**
```json
{
  "name": "Leave",
  "code": "M-001",
  "description": "employee leave",
  "parentModuleId": null
}
```

**Note:** Configurator uses `project_id` in path. HRMS project ID (e.g. `6`) must be known — from Config `projects` table where `code = 'HRMS'`.

### 2.2 Role-Module Permissions (Configurator)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/companies/:companyId/roles/:roleId/projects/:projectId/module-permissions` | Get all module permissions for role |
| PATCH | `/companies/:companyId/roles/:roleId/projects/:projectId/modules/:moduleId/permission` | Enable/disable module for role |

**Set Permission Request Body:**
```json
{
  "enabled": true
}
```

**Response (get permissions):**
```json
{
  "status": "success",
  "data": {
    "permissions": {
      "1": { "isEnabled": true, "name": null },
      "2": { "isEnabled": false, "name": null }
    }
  }
}
```

---

## 3. Mapping: Config Module vs HRMS Resource

HRMS uses `resource` (e.g. `employees`, `leaves`, `payroll`) for permission checks. Config uses `module.code` (e.g. `M-001`, `LEAVE`).

**Recommendation:** Use `module.code` = HRMS `resource` for consistency.

| Config module.code | HRMS resource | Path |
|--------------------|---------------|------|
| `dashboard` | `dashboard` | `/dashboard` |
| `employees` | `employees` | `/employees` |
| `leaves` | `leaves` | `/leave`, `/attendance/apply-event` |
| `payroll` | `payroll` | `/payroll` |
| `attendance` | `attendance` | `/attendance` |
| ... | ... | ... |

**Config `project_modules` columns:** `id`, `project_id`, `name`, `code`, `description`, `parent_module_id`, `parent_module` (name)

- `code` = resource string used in HRMS for permission checks
- `name` = display label in sidebar

---

## 4. Working Plan — Phases

### Phase 1: Configurator Client in HRMS

**Tasks:**
1. Add `CONFIGURATOR_API_URL` to HRMS `.env`
2. Create `backend/src/services/configurator.client.ts`:
   - `getModules(projectId)` → GET /projects/:projectId/modules
   - `createModule(projectId, { name, code, description, parentModuleId })` → POST
   - `updateModule(projectId, moduleId, data)` → PUT
   - `deleteModule(projectId, moduleId)` → DELETE
   - `getRoleModulePermissions(companyId, roleId, projectId)` → GET
   - `setModulePermission(companyId, roleId, projectId, moduleId, enabled)` → PATCH
3. Resolve HRMS project ID: `getProjectByCode('HRMS')` or store `HRMS_PROJECT_ID` in env

**Deliverable:** HRMS backend can call Configurator APIs.

---

### Phase 2: Org Admin — Add Module Form

**Tasks:**
1. **HRMS Backend:** New route `POST /api/config/modules` (proxy to Configurator)
   - Validate user is Org Admin (or Super Admin)
   - Get `companyId` from user token (configurator_company_id)
   - Get `projectId` = HRMS project ID
   - Call Configurator `createModule(projectId, req.body)`
   - Return created module

2. **HRMS Frontend:** New page or modal "Add Module"
   - Form fields: Name, Code (resource), Description, Parent Module (dropdown from Config)
   - Parent Module: fetch from `GET /api/config/modules` (list)
   - Submit → `POST /api/config/modules`

3. **Access:** Show "Add Module" only for Org Admin / Super Admin (e.g. in Module Permission page or Settings)

**Deliverable:** Org Admin can add modules; stored in Config DB.

---

### Phase 3: Role-Based Module Assignment

**Tasks:**
1. **Replace HRMS Module Permission logic** with Config API:
   - Current: Org Admin assigns resources to roles via `role_permissions` + `permissions`
   - New: Org Admin assigns modules to roles via Config `role_module_permissions`

2. **HRMS Backend:** New endpoints (or extend existing):
   - `GET /api/config/companies/:companyId/roles/:roleId/module-permissions` → proxy to Config
   - `PATCH /api/config/companies/:companyId/roles/:roleId/modules/:moduleId/permission` → proxy to Config

3. **HRMS Frontend — Module Permission Page:**
   - Fetch modules from Config: `GET /api/config/modules`
   - Fetch roles from Config: `GET /api/config/companies/:companyId/roles`
   - For each role, fetch module permissions: `GET /api/config/.../module-permissions`
   - UI: Matrix (roles × modules) with Enable/Disable toggle
   - On toggle: `PATCH /api/config/.../modules/:moduleId/permission` with `{ enabled: true/false }`

4. **Role ID mapping:** Config roles use `roles.id` (INT). HRMS uses `UserRole` enum. Need mapping:
   - `ORG_ADMIN` → Config role code `ORG_ADMIN` (fetch role id from Config)
   - `HR_MANAGER` → Config role code `HR_MANAGER`
   - etc.

**Deliverable:** Org Admin assigns modules to roles via Config; role_module_permissions in Config DB.

---

### Phase 4: Role-Based Module Display (Sidebar)

**Tasks:**
1. **HRMS Backend:** New endpoint `GET /api/auth/modules` or extend `getCurrentUser`:
   - After login, user has: `companyId`, `roleIds` (from Config)
   - For each role, fetch module permissions from Config
   - Merge: user sees module if ANY of their roles has `isEnabled: true` for that module
   - Return: `{ modules: [{ id, code, name, path?, parentModuleId }] }`

2. **Path mapping:** Config modules have `code` and `name`. HRMS needs `path` for routing.
   - Option A: Add `path` column to Config `project_modules` (migration)
   - Option B: HRMS keeps static mapping `code → path` (e.g. `leaves` → `/leave`)
   - **Recommendation:** Option B initially — minimal Config changes

3. **HRMS Frontend — Sidebar:**
   - Replace: `APP_MODULES` filtered by `permissionService.getUserPermissions()`
   - With: Fetch `GET /api/auth/modules` (or from user object) → list of modules user can see
   - Build sidebar from this list; use static `code → path` map for routing

4. **Fallback:** If Config API fails, fall back to current HRMS permission logic (optional).

**Deliverable:** Sidebar shows only modules assigned to user's role(s) from Config.

---

### Phase 5: Deprecate HRMS Module Tables

**Tasks:**
1. Stop writing to `organization_modules` for new orgs
2. Stop using `role_permissions` for module access (keep for other permissions if needed)
3. Migrate existing `organization_modules` data to Config (one-time script) — if needed
4. Eventually remove `organization_modules` usage from HRMS

**Deliverable:** HRMS fully uses Config for modules.

---

## 5. Data Flow Diagrams

### 5.1 Org Admin Adds Module

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  HRMS       │     │  HRMS Backend       │     │  Configurator API    │
│  Org Admin  │     │  (proxy)            │     │  configurator_db     │
└──────┬──────┘     └──────────┬──────────┘     └──────────┬──────────┘
       │                       │                           │
       │  Add Module form      │                           │
       │  { name, code, desc,  │                           │
       │    parentModuleId }   │                           │
       │──────────────────────►│                           │
       │                       │  POST /projects/6/modules │
       │                       │  (HRMS project id = 6)     │
       │                       │──────────────────────────►│
       │                       │                           │
       │                       │  INSERT project_modules    │
       │                       │◄───────────────────────────│
       │  { id, name, code }    │                           │
       │◄──────────────────────│                           │
```

### 5.2 Role-Based Module Assignment

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  HRMS       │     │  HRMS Backend       │     │  Configurator API    │
│  Org Admin  │     │  (proxy)            │     │  role_module_        │
│  Module     │     │                     │     │  permissions         │
│  Perm Page  │     │                     │     │                     │
└──────┬──────┘     └──────────┬──────────┘     └──────────┬──────────┘
       │                       │                           │
       │  Toggle: Role X,      │                           │
       │  Module Y = Enable    │                           │
       │──────────────────────►│                           │
       │                       │  PATCH /companies/:cid/    │
       │                       │  roles/:rid/projects/6/   │
       │                       │  modules/:mid/permission │
       │                       │  { enabled: true }       │
       │                       │──────────────────────────►│
       │                       │  UPSERT role_module_       │
       │                       │  permissions              │
       │                       │◄───────────────────────────│
       │  Success              │                           │
       │◄──────────────────────│                           │
```

### 5.3 Sidebar — Role-Based Module Display

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  HRMS       │     │  HRMS Backend       │     │  Configurator API    │
│  Frontend   │     │                     │     │                     │
└──────┬──────┘     └──────────┬──────────┘     └──────────┬──────────┘
       │                       │                           │
       │  GET /api/auth/modules│                           │
       │  (after login)        │                           │
       │──────────────────────►│                           │
       │                       │  User has roleIds from    │
       │                       │  token / Config           │
       │                       │                           │
       │                       │  For each roleId:          │
       │                       │  GET /companies/:cid/    │
       │                       │  roles/:rid/projects/6/   │
       │                       │  module-permissions       │
       │                       │──────────────────────────►│
       │                       │  { 1: enabled, 2: enabled }│
       │                       │◄───────────────────────────│
       │                       │  Merge: modules with      │
       │                       │  isEnabled=true           │
       │  { modules: [...] }    │                           │
       │◄──────────────────────│                           │
       │                       │                           │
       │  Render sidebar from  │                           │
       │  modules list         │                           │
```

---

## 6. Config project_modules — Suggested Schema Extension

If you want HRMS path in Config (optional):

```sql
ALTER TABLE project_modules ADD COLUMN IF NOT EXISTS path VARCHAR(255);
-- e.g. path = '/leave' for module code 'leaves'
```

Otherwise, HRMS keeps static map: `const CODE_TO_PATH = { leaves: '/leave', employees: '/employees', ... }`.

---

## 7. HRMS Project ID in Configurator

Configurator `projects` table has `id` and `code`. HRMS project has `code = 'HRMS'`.

**Option A:** Store in HRMS `.env`:
```
HRMS_PROJECT_ID=6
```

**Option B:** Fetch at runtime:
```javascript
const project = await configuratorClient.getProjectByCode('HRMS');
const projectId = project.id;
```

---

## 8. Summary Checklist

| # | Task | Phase |
|---|------|-------|
| 1 | Create Configurator API client in HRMS backend | 1 |
| 2 | Resolve HRMS project ID (env or API) | 1 |
| 3 | Org Admin Add Module form (proxy to Config) | 2 |
| 4 | Replace Module Permission page with Config role-module API | 3 |
| 5 | Map Config role codes to HRMS UserRole | 3 |
| 6 | New endpoint: get user's modules from Config | 4 |
| 7 | Sidebar: fetch modules from Config, not HRMS permissions | 4 |
| 8 | Static code→path map for routing | 4 |
| 9 | Deprecate organization_modules, role_permissions for modules | 5 |

---

## 9. API Reference (bnc-ai.com:8001)

From your Swagger screenshot, the external API uses:
- `POST /api/v1/modules/` with `project_id`, `code`, `name`, `description`, `parent_module`

If HRMS integrates with that API instead of Configurator directly, use the same structure. The Configurator project uses `/projects/:projectId/modules` (projectId in path). Adjust client accordingly based on which API you use.
