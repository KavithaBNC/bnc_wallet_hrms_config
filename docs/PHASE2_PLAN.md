# Phase 2: Core HR - Employee Management

## Overview
Build complete employee data management system with organizational hierarchy.

**Duration**: 3 weeks
**Status**: 🚀 Starting Now

---

## Scope

### 1. Organization Management
- Create/Update organization profile
- Organization settings
- Upload logo

### 2. Department Management
- CRUD operations for departments
- Hierarchical department structure (parent-child)
- Department head assignment
- Department listing and search

### 3. Job Position Management
- CRUD operations for job positions
- Position levels (Entry, Junior, Senior, Lead, Manager, Director, VP, C-Level)
- Employment types (Full-time, Part-time, Contract, Intern)
- Salary range configuration

### 4. Employee Management
- Complete employee CRUD operations
- Personal information management
- Employment details
- Document management
- Employee directory with advanced search/filter
- Employee hierarchy (reporting structure)
- Bulk employee import (CSV)

---

## Technical Implementation

### Backend (Node.js/Express)

#### A. Services (Business Logic)
1. **`organization.service.ts`** - Organization operations
2. **`department.service.ts`** - Department CRUD & hierarchy
3. **`job-position.service.ts`** - Position management
4. **`employee.service.ts`** - Employee operations

#### B. Controllers (Request Handlers)
1. **`organization.controller.ts`** - Handle org requests
2. **`department.controller.ts`** - Handle dept requests
3. **`job-position.controller.ts`** - Handle position requests
4. **`employee.controller.ts`** - Handle employee requests

#### C. Routes (API Endpoints)
1. **`organization.routes.ts`**
   - `GET /api/v1/organizations/:id`
   - `PUT /api/v1/organizations/:id`
   - `POST /api/v1/organizations/:id/logo`

2. **`department.routes.ts`**
   - `GET /api/v1/departments` (list with pagination)
   - `GET /api/v1/departments/:id`
   - `POST /api/v1/departments`
   - `PUT /api/v1/departments/:id`
   - `DELETE /api/v1/departments/:id`
   - `GET /api/v1/departments/:id/hierarchy` (get tree)

3. **`job-position.routes.ts`**
   - `GET /api/v1/positions` (list with pagination)
   - `GET /api/v1/positions/:id`
   - `POST /api/v1/positions`
   - `PUT /api/v1/positions/:id`
   - `DELETE /api/v1/positions/:id`

4. **`employee.routes.ts`**
   - `GET /api/v1/employees` (list/search with pagination)
   - `GET /api/v1/employees/:id`
   - `POST /api/v1/employees`
   - `PUT /api/v1/employees/:id`
   - `DELETE /api/v1/employees/:id` (soft delete)
   - `GET /api/v1/employees/:id/hierarchy` (reporting structure)
   - `POST /api/v1/employees/bulk-import` (CSV upload)

#### D. Validation Schemas (Zod)
1. **`organization.validation.ts`** - Org schemas
2. **`department.validation.ts`** - Dept schemas
3. **`job-position.validation.ts`** - Position schemas
4. **`employee.validation.ts`** - Employee schemas

---

### Frontend (React.js)

#### A. Pages
1. **Organization Settings** (`/settings/organization`)
   - View/Edit organization profile
   - Logo upload
   - Settings management

2. **Department Management** (`/hr/departments`)
   - Department list (table view)
   - Department hierarchy (tree view)
   - Create/Edit department modal
   - Delete confirmation

3. **Job Position Management** (`/hr/positions`)
   - Position list (table view)
   - Create/Edit position modal
   - Filter by department/level/type

4. **Employee Directory** (`/hr/employees`)
   - Employee list with advanced filters
   - Search by name, email, department, position
   - Pagination
   - Quick actions (view, edit, deactivate)

5. **Employee Details** (`/hr/employees/:id`)
   - Personal info tab
   - Employment details tab
   - Documents tab
   - Attendance history tab
   - Leave history tab

6. **Add/Edit Employee** (`/hr/employees/new`, `/hr/employees/:id/edit`)
   - Multi-step form
   - Step 1: Personal information
   - Step 2: Employment details
   - Step 3: Bank & Tax information
   - Step 4: Documents upload

#### B. Components
1. **EmployeeCard** - Employee profile card
2. **DepartmentTree** - Hierarchical department view
3. **EmployeeSearch** - Advanced search filters
4. **EmployeeForm** - Reusable employee form
5. **DepartmentForm** - Department create/edit form
6. **PositionForm** - Position create/edit form
7. **OrgHierarchy** - Organization chart visualization

#### C. Services
1. **`organization.service.ts`** - API calls for organizations
2. **`department.service.ts`** - API calls for departments
3. **`position.service.ts`** - API calls for positions
4. **`employee.service.ts`** - API calls for employees

#### D. State Management (Zustand)
1. **`orgStore.ts`** - Organization state
2. **`departmentStore.ts`** - Department state
3. **`positionStore.ts`** - Position state
4. **`employeeStore.ts`** - Employee state

---

## Implementation Order

### Week 1: Backend Foundation (Days 1-5)
- [x] Phase 1 Complete ✅
- [ ] Day 1: Organization service, controller, routes, validation
- [ ] Day 2: Department service, controller, routes, validation
- [ ] Day 3: Job Position service, controller, routes, validation
- [ ] Day 4-5: Employee service (complex - CRUD operations)

### Week 2: Backend Completion & Frontend Start (Days 6-10)
- [ ] Day 6: Employee controller, routes, validation
- [ ] Day 7: Test all backend endpoints with Postman/curl
- [ ] Day 8: Organization & Department frontend pages
- [ ] Day 9: Job Position frontend page
- [ ] Day 10: Employee directory page

### Week 3: Frontend Completion & Testing (Days 11-15)
- [ ] Day 11-12: Employee detail page & Add/Edit forms
- [ ] Day 13: Bulk import functionality
- [ ] Day 14: UI polish & responsive design
- [ ] Day 15: End-to-end testing & bug fixes

---

## API Endpoints Summary

### Organizations
- `GET /api/v1/organizations/:id` - Get organization
- `PUT /api/v1/organizations/:id` - Update organization
- `POST /api/v1/organizations/:id/logo` - Upload logo

### Departments (18 endpoints)
- `GET /api/v1/departments` - List departments
- `GET /api/v1/departments/:id` - Get department
- `POST /api/v1/departments` - Create department
- `PUT /api/v1/departments/:id` - Update department
- `DELETE /api/v1/departments/:id` - Delete department
- `GET /api/v1/departments/:id/hierarchy` - Get hierarchy

### Positions (5 endpoints)
- `GET /api/v1/positions` - List positions
- `GET /api/v1/positions/:id` - Get position
- `POST /api/v1/positions` - Create position
- `PUT /api/v1/positions/:id` - Update position
- `DELETE /api/v1/positions/:id` - Delete position

### Employees (7 endpoints)
- `GET /api/v1/employees` - List/Search employees
- `GET /api/v1/employees/:id` - Get employee
- `POST /api/v1/employees` - Create employee
- `PUT /api/v1/employees/:id` - Update employee
- `DELETE /api/v1/employees/:id` - Delete (soft)
- `GET /api/v1/employees/:id/hierarchy` - Get reporting hierarchy
- `POST /api/v1/employees/bulk-import` - Bulk CSV import

**Total**: ~21 API endpoints

---

## Database Schema (Already Created ✅)

Tables used in Phase 2:
- ✅ `organizations` - Organization master data
- ✅ `departments` - Department with hierarchy
- ✅ `job_positions` - Job positions with salary ranges
- ✅ `employees` - Complete employee data
- ✅ `users` - User accounts (linked to employees)

---

## File Structure

```
backend/src/
├── services/
│   ├── auth.service.ts ✅
│   ├── email.service.ts ✅
│   ├── organization.service.ts 🆕
│   ├── department.service.ts 🆕
│   ├── job-position.service.ts 🆕
│   └── employee.service.ts 🆕
├── controllers/
│   ├── auth.controller.ts ✅
│   ├── organization.controller.ts 🆕
│   ├── department.controller.ts 🆕
│   ├── job-position.controller.ts 🆕
│   └── employee.controller.ts 🆕
├── routes/
│   ├── auth.routes.ts ✅
│   ├── organization.routes.ts 🆕
│   ├── department.routes.ts 🆕
│   ├── job-position.routes.ts 🆕
│   └── employee.routes.ts 🆕
└── utils/
    └── validation.ts (update with new schemas) 🆕

frontend/src/
├── pages/
│   ├── auth/ ✅
│   ├── OrganizationSettings.tsx 🆕
│   ├── DepartmentPage.tsx 🆕
│   ├── PositionPage.tsx 🆕
│   ├── EmployeeDirectory.tsx 🆕
│   ├── EmployeeDetail.tsx 🆕
│   └── EmployeeForm.tsx 🆕
├── components/
│   ├── common/ ✅
│   ├── employee/
│   │   ├── EmployeeCard.tsx 🆕
│   │   ├── EmployeeSearch.tsx 🆕
│   │   └── EmployeeTable.tsx 🆕
│   ├── department/
│   │   ├── DepartmentTree.tsx 🆕
│   │   └── DepartmentForm.tsx 🆕
│   └── position/
│       └── PositionForm.tsx 🆕
├── services/
│   ├── auth.service.ts ✅
│   ├── organization.service.ts 🆕
│   ├── department.service.ts 🆕
│   ├── position.service.ts 🆕
│   └── employee.service.ts 🆕
└── store/
    ├── authStore.ts ✅
    ├── orgStore.ts 🆕
    ├── departmentStore.ts 🆕
    ├── positionStore.ts 🆕
    └── employeeStore.ts 🆕
```

---

## Key Features to Implement

### 1. Advanced Search & Filters
- Search by name, email, employee code
- Filter by department, position, employment type, status
- Date range filters (joining date)
- Export filtered results

### 2. Organizational Hierarchy
- Visual org chart
- Department tree with drag-drop reordering
- Employee reporting structure visualization

### 3. Bulk Operations
- CSV import for employees
- CSV export for reporting
- Bulk status updates

### 4. Data Validation
- Email uniqueness
- Employee code auto-generation
- Required field validation
- Date validations (DOB, joining date)

### 5. Permissions
- SUPER_ADMIN: Full access
- ORG_ADMIN: Organization-level access
- HR_MANAGER: HR operations access
- MANAGER: View own department only
- EMPLOYEE: View own profile only

---

## Success Criteria

Phase 2 is complete when:
- ✅ All 21 API endpoints working
- ✅ All CRUD operations tested
- ✅ Frontend pages responsive
- ✅ Search and filters working
- ✅ Data validation in place
- ✅ Role-based access working
- ✅ Employee directory loads <2 seconds
- ✅ No TypeScript errors
- ✅ No console errors
- ✅ Code committed and pushed to git

---

## Notes
- Prisma schema already has all necessary models ✅
- Authentication middleware already implemented ✅
- Role-based authorization ready to use ✅
- Focus on code quality and reusability
- Keep components small and testable
- Use React Query for data fetching
- Implement optimistic UI updates

---

**Let's build Phase 2! 🚀**
