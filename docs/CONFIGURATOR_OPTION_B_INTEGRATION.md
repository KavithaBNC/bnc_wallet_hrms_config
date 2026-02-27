# Configurator Integration – Option B

## Overview

**Option B:** HRMS can add Department, SubDepartment, CostCentre, Branch via Configurator API. Data is stored in **both** Configurator DB and HRMS DB. No conflict with other HRMS modules.

---

## 1. Flow Summary

```
HRMS "Add Department" form
        │
        ▼
HRMS Backend → POST Configurator /api/companies/:companyId/departments
        │
        ▼
Configurator: Creates in Configurator DB
        │
        ▼
Response: { id, name, code, ... }
        │
        ▼
HRMS: INSERT into HRMS departments table (configurator_id, name, code, organization_id)
        │
        ▼
Both DBs have the record
```

---

## 2. What Gets Stored Where

| Action | Configurator DB | HRMS DB |
|--------|-----------------|---------|
| Add Department from HRMS | ✅ (via API) | ✅ (from response) |
| Add Department from Configurator | ✅ | ✅ (after sync or API fetch) |
| Add SubDepartment from HRMS | ✅ (via API) | ✅ |
| Add CostCentre from HRMS | ✅ (via API) | ✅ |
| Add Branch from HRMS | ✅ (via API) | ✅ (as Location) |

---

## 3. HRMS Schema Changes

### 3.1 Add `configurator_id` to HRMS Tables

| Table | New Column | Purpose |
|-------|------------|---------|
| departments | `configurator_id` (UUID, nullable, unique) | Link to Configurator |
| sub_departments | `configurator_id` | Link to Configurator |
| cost_centres | `configurator_id` | Link to Configurator |
| locations | `configurator_branch_id` | Link to Configurator Branch |

### 3.2 Employee Table

| Column | Source |
|--------|--------|
| config_user_id | Configurator (from user create API) |
| department_id | HRMS departments (synced or added via API) |
| cost_centre_id | HRMS cost_centres |
| location_id | HRMS locations |

---

## 4. Configurator APIs HRMS Must Call

### 4.1 Create (Option B – Add from HRMS)

| Entity | Method | Endpoint |
|--------|--------|----------|
| Department | POST | `/api/companies/:companyId/departments` |
| SubDepartment | POST | `/api/companies/:companyId/sub-departments` |
| CostCentre | POST | `/api/companies/:companyId/cost-centres` |
| Branch | POST | `/api/companies/:companyId/branches` |

### 4.2 Fetch (for dropdowns / sync)

| Entity | Method | Endpoint |
|--------|--------|----------|
| Departments | GET | `/api/companies/:companyId/departments` |
| SubDepartments | GET | `/api/companies/:companyId/sub-departments` |
| CostCentres | GET | `/api/companies/:companyId/cost-centres` |
| Branches | GET | `/api/companies/:companyId/branches` |
| Roles | GET | `/api/companies/:companyId/roles` |

### 4.3 Auth

| Action | Method | Endpoint |
|--------|--------|----------|
| Login | POST | `/api/auth/login` (source=company) |
| Validate | GET | `/api/auth/me` |

---

## 5. Sync Options (No Conflict with Option B)

| Method | When | Use Case |
|--------|------|----------|
| **Manual Sync** | Admin clicks "Sync Now" | Configurator-ல் add பண்ணின பிறகு |
| **On-Demand API** | Form load | Sync இல்லாமல் dropdown-க்கு |
| **Option B Add** | HRMS form submit | HRMS-ல் add பண்ணும்போது – both DBs get it |

Option B + Manual Sync together = no duplicate, no conflict.

---

## 6. Conflict Check – Other HRMS Modules

| Module | Uses Department? | Conflict? |
|--------|------------------|-----------|
| Employee | department_id | ❌ No |
| Attendance | department_id | ❌ No |
| Leave | department_id | ❌ No |
| Payroll | department_id | ❌ No |
| WorkflowMapping | department_id | ❌ No |
| RuleSetting | department_id | ❌ No |
| Shifts | - | ❌ No |

All modules use HRMS `department_id`. Source of department (sync or Option B) does not matter.

---

## 7. Implementation Steps

1. Add `configurator_id` to HRMS: departments, sub_departments, cost_centres, locations
2. Add `config_user_id` to HRMS employees
3. Create Configurator API client in HRMS backend
4. HRMS "Add Department" form → call Configurator API → insert into HRMS
5. Same for SubDepartment, CostCentre, Branch
6. Login via Configurator
7. Employee creation → create user in Configurator, then employee in HRMS

---

## 8. Time Estimate

| Task | Time |
|------|------|
| Schema changes (configurator_id columns) | 0.5 day |
| Configurator API client | 0.5 day |
| HRMS Add Department → Configurator API + HRMS insert | 1 day |
| Add SubDepartment, CostCentre, Branch (same pattern) | 1 day |
| Login + Auth middleware | 1 day |
| Employee creation via Configurator | 1 day |
| Testing | 1 day |
| **Total** | **~6 days** |

---

## 9. Environment Variables

```env
CONFIGURATOR_URL=http://localhost:5000
CONFIGURATOR_JWT_SECRET=<same as Configurator>
```

---

## 10. Summary

- **Option B** = HRMS can add Department, SubDepartment, CostCentre, Branch via Configurator API
- Both DBs store the data
- No conflict with Attendance, Leave, Payroll, Rules, Shifts, etc.
- Manual sync optional for Configurator-originated data
- **Estimated time: ~6 days**
