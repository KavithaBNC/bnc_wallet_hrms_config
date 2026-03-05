# Modules, Role, Role Permissions – Source Audit

**Date:** 2025-03-05  
**Purpose:** Cross-check where modules, role, and role permissions come from after login. Verify Config DB usage vs hardcoded values.

---

## 1. Login Flow

| Step | Source | Details |
|------|--------|---------|
| Frontend login | `auth.service.ts` | `POST /auth/configurator/login` with `{ username, password, company_id }` |
| Backend | `auth.controller.configuratorLogin` | Calls Configurator API, syncs with HRMS, returns `user`, `tokens`, `modules` |
| company_id | **Hardcoded** | `data.company_id ?? 59` in frontend; `CONFIGURATOR_DEFAULT_COMPANY_ID` (default 59) in backend |

---

## 2. Role – Where It Comes From

| Source | Table/API | Location |
|-------|----------|----------|
| **Primary** | HRMS `users` table | `user.role` (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, MANAGER, EMPLOYEE) |
| New user (Configurator) | **Hardcoded** | `CONFIGURATOR_DEFAULT_ROLE` (default `ORG_ADMIN`) in `config.ts` |
| Configurator role mapping | **Hardcoded** | `configuratorRoleIds` in `config.ts`: `{"ORG_ADMIN":31,"HR_MANAGER":30,"MANAGER":29,"EMPLOYEE":28}` |

**Flow:**
- Configurator login returns `user.roles` (Config DB roles)
- HRMS uses `hrmsUser.role` from HRMS `users` table
- `configuratorRoleIds` maps HRMS role → Configurator `role_id` for fetching modules

**Config DB?** Role is from HRMS user table. Configurator role IDs are used only to fetch modules from Config.

---

## 3. Modules – Where They Come From

### 3.1 Dashboard Cards (Assigned Modules Grid)

| Source | Table/API | Location |
|--------|-----------|----------|
| **Config DB** | `project_modules` + `role_module_permissions` | Backend: `configuratorService.getUserAssignedModules()` |
| Stored in | localStorage `modules` | Set at login in `auth.service.ts` |
| Used in | `DashboardPage.tsx` → `AssignedModulesGrid` | `getAssignedModules()` from `configurator-module-mapping.ts` |

**Flow:**
1. Configurator login → backend fetches modules via `getUserAssignedModules(accessToken, roleId, companyId)`
2. Backend calls Configurator API: `/api/v1/user-role-modules/` + `/api/v1/modules` or `/api/v1/project-modules`
3. Returns modules in login response → frontend stores in `localStorage.modules`
4. Dashboard `AssignedModulesGrid` reads from `getAssignedModules()` (localStorage)

**Config DB?** Yes. Dashboard cards use Config DB modules.

### 3.2 Sidebar (Navigation Menu)

| Source | Table/API | Location |
|--------|-----------|----------|
| **Hardcoded** | `APP_MODULES` | `frontend/src/config/modules.ts` |
| Permissions | HRMS `role_permissions` + `permissions` | `permissionService.getUserPermissions()` → `GET /permissions/role-permissions/user/permissions` |
| Visibility logic | `DashboardLayout.tsx` | Filters `APP_MODULES` by `hasView(mod.resource)` from HRMS permissions |

**Flow:**
1. `APP_MODULES` = static list of all possible menus (path, label, resource, visibility)
2. `permissionService.getUserPermissions()` fetches from HRMS `role_permissions`
3. Sidebar shows module if `userPermissionKeys.has(\`${resource}.read\`)` (HRMS permission)

**Config DB?** No. Sidebar uses hardcoded `APP_MODULES` + HRMS `role_permissions`.

---

## 4. Role Permissions – Where They Come From

| Source | Table | Location |
|--------|-------|----------|
| **HRMS DB** | `role_permissions` + `permissions` | `role-permission.service.ts` → `getUserPermissions(role, organizationId)` |
| API | `GET /permissions/role-permissions/user/permissions` | `role-permission.controller.getUserPermissions` |
| Frontend | `permission.service.getUserPermissions()` | Used by `DashboardLayout`, `usePermissions` hook |

**Flow:**
1. User has `role` from HRMS `users` table
2. Backend queries `role_permissions` where `role = user.role` and `organizationId` (for org-scoped)
3. Returns `{ resource, action }` (e.g. `employees.read`, `departments.create`)
4. Frontend builds `userPermissionKeys` (e.g. `Set(['employees.read', 'departments.create'])`)

**Config DB?** No. Role permissions come from HRMS `role_permissions` table.

---

## 5. Hardcoded Values Summary

| Value | Location | Default |
|-------|----------|---------|
| `company_id` | `auth.service.ts` | 59 |
| `CONFIGURATOR_DEFAULT_COMPANY_ID` | `config.ts` | 59 |
| `CONFIGURATOR_DEFAULT_ROLE` | `config.ts` | ORG_ADMIN |
| `configuratorRoleIds` | `config.ts` | `{"ORG_ADMIN":31,"HR_MANAGER":30,"MANAGER":29,"EMPLOYEE":28}` |
| `configuratorHrmsProjectId` | `config.ts` | 5 |
| `APP_MODULES` | `frontend/src/config/modules.ts` | Full list of 50+ menu items |
| `CONFIGURATOR_CODE_TO_CARD` | `configurator-module-mapping.ts` | Code → path/icon/description |
| `CONFIGURATOR_CODE_TO_HRMS_PATH` | `configurator-module-mapping.ts` (backend) | Code → path |
| `employeeAllowedCodes` | `DashboardPage.tsx` | `['ATTENDANCE','EVENT','LEAVES','LEAVE_MANAGEMENT']` |

---

## 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CONFIGURATOR LOGIN                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌───────────────┐           ┌──────────────────┐           ┌─────────────────────┐
│ Configurator  │           │ HRMS users table │           │ Configurator API    │
│ API (auth)    │           │ (role)           │           │ user-role-modules   │
└───────────────┘           └──────────────────┘           │ project_modules    │
        │                             │                     └─────────────────────┘
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐           ┌──────────────────┐           ┌─────────────────────┐
│ JWT tokens    │           │ user.role        │           │ modules[]           │
│ user object   │           │ (HRMS DB)         │           │ → localStorage      │
└───────────────┘           └──────────────────┘           │ → Dashboard cards   │
                                                             └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SIDEBAR (DashboardLayout)                              │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ├── APP_MODULES (hardcoded) ────────────────────────────────────────────────┐
        │                                                                           │
        └── permissionService.getUserPermissions() ──────────────────────────────────┤
                      │                                                             │
                      ▼                                                             ▼
            GET /permissions/role-permissions/user/permissions              Filter: hasView(resource)
                      │                                                             │
                      ▼                                                             │
            HRMS role_permissions + permissions tables  ◄───────────────────────────┘
```

---

## 7. Recommendations

| Area | Current | Recommended |
|------|---------|-------------|
| **Sidebar modules** | APP_MODULES (hardcoded) + HRMS role_permissions | Use Config DB modules (like Dashboard) for consistency |
| **Role** | HRMS users.role | Consider syncing from Config if Config is source of truth |
| **Role permissions** | HRMS role_permissions | Phase 4 plan: migrate to Config `role_module_permissions` |
| **company_id** | Hardcoded 59 | Add company selector or org-based resolution |

---

## 8. Files Reference

| File | Purpose |
|------|---------|
| `frontend/src/services/auth.service.ts` | Login, stores modules in localStorage |
| `frontend/src/config/modules.ts` | APP_MODULES (hardcoded sidebar list) |
| `frontend/src/config/configurator-module-mapping.ts` | getAssignedModules, CONFIGURATOR_CODE_TO_CARD |
| `frontend/src/components/layout/DashboardLayout.tsx` | Sidebar: APP_MODULES + permissionService |
| `frontend/src/pages/DashboardPage.tsx` | Dashboard cards: getAssignedModules (Config) |
| `frontend/src/services/permission.service.ts` | getUserPermissions → HRMS API |
| `backend/src/controllers/auth.controller.ts` | configuratorLogin, getConfiguratorModules |
| `backend/src/services/configurator.service.ts` | getUserAssignedModules, getModules |
| `backend/src/services/role-permission.service.ts` | getUserPermissions (HRMS DB) |
| `backend/src/config/config.ts` | configuratorRoleIds, CONFIGURATOR_DEFAULT_* |
