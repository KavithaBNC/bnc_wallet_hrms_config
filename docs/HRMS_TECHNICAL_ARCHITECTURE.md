# BNC HRMS - Technical System Architecture

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT LAYER                                         │
│                                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐    │
│  │   Web App    │  │  Mobile Web  │  │  Biometric   │  │   Face Attendance        │    │
│  │  (React 18)  │  │  (Responsive)│  │   Devices    │  │   (Webcam/Camera)        │    │
│  │  Vite + TS   │  │  Tailwind    │  │  ESSL/ZKTeco │  │   react-webcam           │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘    │
│         │                  │                  │                       │                  │
└─────────┼──────────────────┼──────────────────┼───────────────────────┼──────────────────┘
          │    HTTPS/REST    │                  │     ATTLOG/HTTP       │
          ▼                  ▼                  ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   API GATEWAY LAYER                                     │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                         Express.js (Port 5001)                                  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────────┐  │    │
│  │  │  Helmet   │ │   CORS   │ │ Rate Limiter│ │ Morgan   │ │  Compression     │  │    │
│  │  │ Security  │ │  Policy  │ │  20/15min   │ │ Logging  │ │  gzip            │  │    │
│  │  │  Headers  │ │          │ │  200/min    │ │          │ │                   │  │    │
│  │  └──────────┘ └──────────┘ └─────────────┘ └──────────┘ └──────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              MIDDLEWARE PIPELINE                                        │
│                                                                                         │
│  ┌──────────────┐   ┌───────────────────┐   ┌──────────────┐   ┌────────────────┐      │
│  │  JWT Auth    │──▶│  Permission Check  │──▶│  RBAC Filter │──▶│  Joi/Zod       │      │
│  │  Middleware  │   │  (Resource:Action) │   │  (Data Scope)│   │  Validation    │      │
│  │             │   │                    │   │              │   │               │      │
│  │ - Verify    │   │ - employees.read   │   │ - Org filter │   │ - Input       │      │
│  │   Token     │   │ - payroll.create   │   │ - Dept scope │   │   Sanitize    │      │
│  │ - Attach    │   │ - attendance.update│   │ - Self only  │   │ - Schema      │      │
│  │   User      │   │ - leave.delete     │   │ - Manager    │   │   Match       │      │
│  │ - Refresh   │   │                    │   │   reports    │   │               │      │
│  └──────────────┘   └───────────────────┘   └──────────────┘   └────────────────┘      │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                APPLICATION LAYER                                        │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                          ROUTE LAYER (45+ Routes)                               │    │
│  │  /api/v1/auth  /api/v1/employees  /api/v1/attendance  /api/v1/payroll          │    │
│  │  /api/v1/leave  /api/v1/departments  /api/v1/shifts  /api/v1/esop  ...         │    │
│  └─────────────────────────────────────────┬───────────────────────────────────────┘    │
│                                             │                                           │
│  ┌─────────────────────────────────────────┴───────────────────────────────────────┐    │
│  │                       CONTROLLER LAYER (50+ Controllers)                        │    │
│  │  auth │ employee │ attendance │ payroll │ leave │ organization │ permission     │    │
│  │  shift │ department │ esop │ fnf │ compliance │ loan │ approval-workflow        │    │
│  └─────────────────────────────────────────┬───────────────────────────────────────┘    │
│                                             │                                           │
│  ┌─────────────────────────────────────────┴───────────────────────────────────────┐    │
│  │                        SERVICE LAYER (45+ Services)                             │    │
│  │                                                                                  │    │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐                 │    │
│  │  │ attendance.svc   │ │ leave-request.svc│ │ employee.svc     │                 │    │
│  │  │ (231 KB)         │ │ (82 KB)          │ │ (65 KB)          │                 │    │
│  │  │ - Punch logic    │ │ - Accrual engine │ │ - CRUD + bulk    │                 │    │
│  │  │ - Shift calc     │ │ - Balance mgmt   │ │ - Change requests│                 │    │
│  │  │ - OT/Late/Early  │ │ - Approval flow  │ │ - Separation/FnF │                 │    │
│  │  │ - Validation     │ │ - Comp-off logic │ │ - Rejoin logic   │                 │    │
│  │  │ - Monthly summary│ │ - Carry-forward  │ │ - Field access   │                 │    │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘                 │    │
│  │                                                                                  │    │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐                 │    │
│  │  │ payroll.svc      │ │ auth.svc         │ │ esop.svc         │                 │    │
│  │  │ - Salary calc    │ │ - JWT issue      │ │ - Grant mgmt     │                 │    │
│  │  │ - Component eng  │ │ - Password hash  │ │ - Vesting        │                 │    │
│  │  │ - Statutory      │ │ - Token refresh  │ │ - Exercise       │                 │    │
│  │  │ - EPF/ESIC/PT/TDS│ │ - Password reset │ │ - Ledger         │                 │    │
│  │  │ - Payslip PDF    │ │ - Email verify   │ │                  │                 │    │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘                 │    │
│  │                                                                                  │    │
│  └──────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  DATA LAYER                                             │
│                                                                                         │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────────────────┐   │
│  │  Prisma ORM 5.8     │  │  Redis 7         │  │  In-Memory Cache               │   │
│  │                     │  │                  │  │                                │   │
│  │  - Type-safe queries│  │  - Token         │  │  - Permission Cache            │   │
│  │  - Migrations       │  │    blacklist     │  │    (permission-cache.ts)       │   │
│  │  - Schema-first     │  │  - Session store │  │  - Role-Permission Map         │   │
│  │  - Relations        │  │  - Rate limiting │  │  - Org Module Config           │   │
│  │  - Transactions     │  │                  │  │                                │   │
│  └─────────┬───────────┘  └──────────────────┘  └──────────────────────────────────┘   │
│            │                                                                            │
│  ┌─────────▼──────────────────────────────────────────────────────────────────────┐     │
│  │                     PostgreSQL 15+ (AWS RDS ap-south-1)                        │     │
│  │                                                                                │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────────────────┐   │     │
│  │  │   Auth &    │ │  Employee   │ │ Attendance  │ │     Payroll &          │   │     │
│  │  │   Access    │ │   Master    │ │   & Time    │ │    Compensation        │   │     │
│  │  │             │ │             │ │             │ │                        │   │     │
│  │  │ users       │ │ employees   │ │ attendance_ │ │ salary_structures      │   │     │
│  │  │ roles       │ │ emp_bank_   │ │  records    │ │ salary_templates       │   │     │
│  │  │ permissions │ │  accounts   │ │ attendance_ │ │ paygroups              │   │     │
│  │  │ role_       │ │ emp_leave_  │ │  logs       │ │ payslips               │   │     │
│  │  │  permissions│ │  balances   │ │ attendance_ │ │ payroll_cycles         │   │     │
│  │  │             │ │ emp_salaries│ │  punches    │ │ variable_inputs        │   │     │
│  │  │             │ │ emp_change_ │ │ shifts      │ │ post_to_payroll        │   │     │
│  │  │             │ │  requests   │ │ shift_rules │ │ statutory_compliances  │   │     │
│  │  │             │ │ emp_        │ │ monthly_    │ │ tax_configurations     │   │     │
│  │  │             │ │  separations│ │  summaries  │ │ compliance_reports     │   │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └────────────────────────┘   │     │
│  │                                                                                │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────────────────┐   │     │
│  │  │   Leave &   │ │Organization │ │   ESOP      │ │   Config &             │   │     │
│  │  │   Events    │ │ Structure   │ │             │ │   Workflow             │   │     │
│  │  │             │ │             │ │             │ │                        │   │     │
│  │  │ leave_types │ │organizations│ │ esop_pools  │ │ approval_workflows     │   │     │
│  │  │ leave_      │ │ departments │ │ esop_grants │ │ workflow_mappings      │   │     │
│  │  │  policies   │ │ sub_depts   │ │ esop_records│ │ rule_settings          │   │     │
│  │  │ leave_      │ │ entities    │ │ vesting_    │ │ validation_process_    │   │     │
│  │  │  requests   │ │ locations   │ │  plans      │ │  rules                 │   │     │
│  │  │ comp_off_   │ │ cost_centres│ │ esop_       │ │ auto_credit_settings   │   │     │
│  │  │  ledgers    │ │ job_        │ │  exercise_  │ │ rights_allocations     │   │     │
│  │  │ attendance_ │ │  positions  │ │  requests   │ │ encashment_carry_      │   │     │
│  │  │  components │ │             │ │ esop_ledger │ │  forwards              │   │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └────────────────────────┘   │     │
│  │                                                                                │     │
│  │                          100+ Tables │ 20+ Enums                               │     │
│  └────────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture (React SPA)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            REACT 18 + VITE + TYPESCRIPT                             │
│                                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                              ROUTING LAYER                                    │  │
│  │                         React Router v6 (Lazy Load)                           │  │
│  │                                                                               │  │
│  │  /login → AuthPage          /dashboard → DashboardPage                       │  │
│  │  /employees → EmployeesPage /attendance → AttendancePage                     │  │
│  │  /payroll → PayrollPage     /leave → LeavePage                               │  │
│  │  /settings → ConfigPages    /profile → ProfilePage                           │  │
│  │                                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  ProtectedRoute (Auth Guard)  │  ProtectedComponent (Permission Guard) │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                              PAGE LAYER (50+ Pages)                           │  │
│  │                                                                               │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐  │  │
│  │  │  Employee   │ │ Attendance  │ │   Payroll    │ │   Leave & Events     │  │  │
│  │  │  Module     │ │  Module     │ │   Module     │ │   Module             │  │  │
│  │  │            │ │            │ │             │ │                     │  │  │
│  │  │ List/Form  │ │ Daily/Mon  │ │ Dashboard   │ │ Request/Approve    │  │  │
│  │  │ Import     │ │ Face/Bio   │ │ Run/History │ │ Balance/Config     │  │  │
│  │  │ Salary     │ │ Shift/Lock │ │ Payslip     │ │ CompOff/Excess     │  │  │
│  │  │ Separation │ │ Validate   │ │ Compliance  │ │ Encashment         │  │  │
│  │  └─────────────┘ └─────────────┘ └──────────────┘ └──────────────────────┘  │  │
│  │                                                                               │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐  │  │
│  │  │   Org &     │ │    ESOP     │ │  Transaction │ │   Configuration      │  │  │
│  │  │ Structure   │ │   Module    │ │   Module     │ │   Module             │  │  │
│  │  │            │ │            │ │             │ │                     │  │  │
│  │  │ Org/Dept   │ │ Pools      │ │ Transfer   │ │ Workflows          │  │  │
│  │  │ Position   │ │ Grants     │ │ Promotion  │ │ Rules/Rights       │  │  │
│  │  │ Entity     │ │ Vesting    │ │ FnF Init   │ │ Auto-Credit        │  │  │
│  │  │ CostCentre │ │ Exercise   │ │ FnF Approve│ │ Permissions        │  │  │
│  │  └─────────────┘ └─────────────┘ └──────────────┘ └──────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                           STATE MANAGEMENT                                    │  │
│  │                                                                               │  │
│  │  ┌─────────────────┐  ┌──────────────────────────┐  ┌─────────────────────┐  │  │
│  │  │  Zustand Stores │  │  React Query (TanStack)  │  │  Component State    │  │  │
│  │  │                 │  │                          │  │                     │  │  │
│  │  │ • authStore     │  │ • Server state cache     │  │ • Form state        │  │  │
│  │  │   (user/token)  │  │ • Auto-refetch           │  │   (React Hook Form) │  │  │
│  │  │ • employeeStore │  │ • Pagination state       │  │ • UI toggles        │  │  │
│  │  │ • departmentStr │  │ • Mutation + invalidate  │  │ • Modal state       │  │  │
│  │  │ • positionStore │  │ • Background sync        │  │ • Filter/Sort       │  │  │
│  │  │ • hrAuditStore  │  │ • Stale-while-revalidate │  │                     │  │  │
│  │  └─────────────────┘  └──────────────────────────┘  └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                          API SERVICE LAYER (40+)                              │  │
│  │                                                                               │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐     │  │
│  │  │  Axios Instance (api.ts)                                            │     │  │
│  │  │  • Base URL: /api/v1                                                │     │  │
│  │  │  • Request interceptor: Attach JWT Bearer token                     │     │  │
│  │  │  • Response interceptor: Auto-refresh on 401 → retry original req   │     │  │
│  │  │  • Error handler: Logout on refresh failure                         │     │  │
│  │  └──────────────────────────────────────────────────────────────────────┘     │  │
│  │                                                                               │  │
│  │  auth.svc │ employee.svc │ attendance.svc │ leave.svc │ payroll.svc          │  │
│  │  department.svc │ shift.svc │ esop.svc │ fnf.svc │ configurator-data.svc    │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                              UI FRAMEWORK                                     │  │
│  │  Tailwind CSS │ React Hook Form │ Zod │ Recharts │ XLSX │ react-datepicker  │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication & Authorization Flow

```
┌──────────┐                    ┌──────────────┐                  ┌──────────────┐
│  Client  │                    │  HRMS Backend│                  │ Configurator │
│  (React) │                    │  (Express)   │                  │  API (BNC)   │
└────┬─────┘                    └──────┬───────┘                  └──────┬───────┘
     │                                 │                                 │
     │  1. POST /auth/login            │                                 │
     │  {email, password}              │                                 │
     │────────────────────────────────▶│                                 │
     │                                 │                                 │
     │                                 │  2. Verify credentials (bcrypt) │
     │                                 │                                 │
     │                                 │  3. POST /auth/token/login      │
     │                                 │  (Sync with Configurator)       │
     │                                 │────────────────────────────────▶│
     │                                 │                                 │
     │                                 │  4. Return config token +       │
     │                                 │     module permissions          │
     │                                 │◀────────────────────────────────│
     │                                 │                                 │
     │                                 │  5. Cache permissions in memory │
     │                                 │     (permission-cache.ts)       │
     │                                 │                                 │
     │  6. Return JWT tokens           │                                 │
     │  {accessToken (15min),          │                                 │
     │   refreshToken (7 days)}        │                                 │
     │◀────────────────────────────────│                                 │
     │                                 │                                 │
     │  7. Store tokens in localStorage│                                 │
     │                                 │                                 │
     │  8. API Request                 │                                 │
     │  Authorization: Bearer {token}  │                                 │
     │────────────────────────────────▶│                                 │
     │                                 │                                 │
     │                                 │  9. Middleware Pipeline:         │
     │                                 │  ┌──────────────────────┐       │
     │                                 │  │ JWT Verify           │       │
     │                                 │  │     ↓                │       │
     │                                 │  │ Permission Check     │       │
     │                                 │  │ (resource:action)    │       │
     │                                 │  │     ↓                │       │
     │                                 │  │ RBAC Data Filter     │       │
     │                                 │  │ (org/dept/self)      │       │
     │                                 │  │     ↓                │       │
     │                                 │  │ Input Validation     │       │
     │                                 │  └──────────────────────┘       │
     │                                 │                                 │
     │  10. Response (filtered data)   │                                 │
     │◀────────────────────────────────│                                 │
     │                                 │                                 │
     │  11. On 401: Auto-refresh       │                                 │
     │  POST /auth/refresh-token       │                                 │
     │────────────────────────────────▶│                                 │
     │                                 │                                 │
     │  12. New access token           │                                 │
     │◀────────────────────────────────│                                 │
     │                                 │                                 │
     │  13. Retry original request     │                                 │
     │────────────────────────────────▶│                                 │
```

---

## 4. RBAC & Multi-Tenancy Model

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ROLE-BASED ACCESS CONTROL                           │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           ROLE HIERARCHY                                │   │
│  │                                                                          │   │
│  │   SUPER_ADMIN ──▶ Full system access (all orgs, all resources)          │   │
│  │        │                                                                 │   │
│  │        ▼                                                                 │   │
│  │   ORG_ADMIN ────▶ Organization-level admin (own org, all resources)     │   │
│  │        │                                                                 │   │
│  │        ▼                                                                 │   │
│  │   HR_MANAGER ───▶ HR operations (own org, HR-specific resources)        │   │
│  │        │                                                                 │   │
│  │        ▼                                                                 │   │
│  │   MANAGER ──────▶ Team management (own dept, team reports)              │   │
│  │        │                                                                 │   │
│  │        ▼                                                                 │   │
│  │   EMPLOYEE ─────▶ Self-service (own data only)                          │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                       PERMISSION MATRIX                                  │   │
│  │                                                                          │   │
│  │  Resource            │  read  │ create │ update │ delete                 │   │
│  │  ────────────────────┼────────┼────────┼────────┼────────                │   │
│  │  employees           │   ✓    │   ✓    │   ✓    │   ✓                    │   │
│  │  attendance          │   ✓    │   ✓    │   ✓    │   ✓                    │   │
│  │  payroll             │   ✓    │   ✓    │   ✓    │   ✗                    │   │
│  │  leave               │   ✓    │   ✓    │   ✓    │   ✓                    │   │
│  │  departments         │   ✓    │   ✓    │   ✓    │   ✓                    │   │
│  │  organizations       │   ✓    │   ✓    │   ✓    │   ✗                    │   │
│  │  shifts              │   ✓    │   ✓    │   ✓    │   ✓                    │   │
│  │  salary_structures   │   ✓    │   ✓    │   ✓    │   ✓                    │   │
│  │  esop                │   ✓    │   ✓    │   ✓    │   ✗                    │   │
│  │  ... (30+ resources) │        │        │        │                        │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                      MULTI-TENANCY (Data Isolation)                      │   │
│  │                                                                          │   │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │   │
│  │  │  Org A   │    │  Org B   │    │  Org C   │    │  Org N   │          │   │
│  │  │          │    │          │    │          │    │          │          │   │
│  │  │ Users    │    │ Users    │    │ Users    │    │ Users    │          │   │
│  │  │ Employees│    │ Employees│    │ Employees│    │ Employees│          │   │
│  │  │ Payroll  │    │ Payroll  │    │ Payroll  │    │ Payroll  │          │   │
│  │  │ Attend.  │    │ Attend.  │    │ Attend.  │    │ Attend.  │          │   │
│  │  └──────────┘    └──────────┘    └──────────┘    └──────────┘          │   │
│  │       ▲               ▲               ▲               ▲                 │   │
│  │       │               │               │               │                 │   │
│  │       └───────────────┴───────────────┴───────────────┘                 │   │
│  │              organizationId filter on ALL queries                        │   │
│  │              (enforced at middleware + service level)                    │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. External Integrations

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HRMS BACKEND (Express.js)                             │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                        Integration Services                               │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│       │              │               │              │             │              │
│       ▼              ▼               ▼              ▼             ▼              │
│  ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │Config-  │  │  iClock    │  │  Face    │  │  Email   │  │  AWS S3 /    │    │
│  │urator   │  │  Biometric │  │  Service │  │  (SMTP)  │  │  MinIO       │    │
│  │  API    │  │  API       │  │          │  │          │  │              │    │
│  └────┬────┘  └─────┬──────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘    │
│       │              │              │              │               │             │
└───────┼──────────────┼──────────────┼──────────────┼───────────────┼─────────────┘
        │              │              │              │               │
        ▼              ▼              ▼              ▼               ▼
┌──────────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────────┐
│ BNC AI       │ │  ESSL /   │ │ Python   │ │  SMTP     │ │  AWS S3         │
│ Configurator │ │  ZKTeco   │ │ FastAPI  │ │  Server   │ │  Object Storage │
│              │ │  Devices  │ │          │ │           │ │                 │
│ bnc-ai.com  │ │           │ │ Face     │ │ Email     │ │ Documents       │
│ :8001        │ │ Biometric │ │ Encoding │ │ Verify    │ │ Payslips        │
│              │ │ Terminals │ │ Matching │ │ Password  │ │ Reports         │
│ • Auth sync  │ │           │ │          │ │ Reset     │ │ Bulk imports    │
│ • Modules    │ │ • ATTLOG  │ │ Port     │ │ Notif.   │ │                 │
│ • Permissions│ │ • Punch   │ │ :8000    │ │           │ │                 │
│ • User roles │ │   data    │ │          │ │ nodemailer│ │                 │
└──────────────┘ └───────────┘ └──────────┘ └───────────┘ └─────────────────┘
```

---

## 6. Deployment Architecture (Docker)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER COMPOSE STACK                               │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────┐                       │
│  │                    NETWORK: hrms-network              │                       │
│  │                                                       │                       │
│  │  ┌──────────────┐    ┌──────────────┐                │                       │
│  │  │   Frontend   │    │   Backend    │                │                       │
│  │  │  React/Vite  │    │  Express.js  │                │                       │
│  │  │              │    │              │                │                       │
│  │  │  Port: 3000  │───▶│  Port: 5001  │                │                       │
│  │  │              │    │              │                │                       │
│  │  │  Static SPA  │    │  REST API    │                │                       │
│  │  └──────────────┘    └──────┬───────┘                │                       │
│  │                              │                        │                       │
│  │            ┌─────────────────┼─────────────────┐      │                       │
│  │            │                 │                  │      │                       │
│  │            ▼                 ▼                  ▼      │                       │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │                       │
│  │  │ PostgreSQL   │  │    Redis     │  │Face Service │ │                       │
│  │  │    15        │  │      7       │  │  Python     │ │                       │
│  │  │              │  │              │  │  FastAPI    │ │                       │
│  │  │  Port: 5432  │  │  Port: 6379  │  │  Port: 8000│ │                       │
│  │  │              │  │              │  │             │ │                       │
│  │  │  hrms_live   │  │  Token cache │  │ Face encode│ │                       │
│  │  │  100+ tables │  │  Blacklist   │  │ Face match │ │                       │
│  │  │              │  │  Rate limit  │  │             │ │                       │
│  │  │ 📁 Volume:   │  │ 📁 Volume:   │  │             │ │                       │
│  │  │ postgres_data│  │ redis_data   │  │             │ │                       │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │                       │
│  │                                                       │                       │
│  │  ┌──────────────┐                                     │                       │
│  │  │   pgAdmin    │                                     │                       │
│  │  │              │                                     │                       │
│  │  │  Port: 5050  │                                     │                       │
│  │  │  DB Admin UI │                                     │                       │
│  │  └──────────────┘                                     │                       │
│  │                                                       │                       │
│  └──────────────────────────────────────────────────────┘                       │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────┐                       │
│  │                  EXTERNAL SERVICES                    │                       │
│  │                                                       │                       │
│  │  AWS RDS (PostgreSQL)  │  BNC Configurator API       │                       │
│  │  ap-south-1            │  bnc-ai.com:8001            │                       │
│  │                        │                              │                       │
│  │  SMTP Server           │  ESSL Biometric Devices     │                       │
│  │  (Email notifications) │  (On-premise terminals)     │                       │
│  │                        │                              │                       │
│  │  AWS S3                │                              │                       │
│  │  (File storage)        │                              │                       │
│  └──────────────────────────────────────────────────────┘                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Data Flow - Key Business Processes

### 7a. Attendance Processing Flow

```
┌────────────┐  ┌───────────┐  ┌────────────┐  ┌───────────┐
│  Biometric │  │   Web     │  │   Face     │  │  Mobile/  │
│  Device    │  │  Check-in │  │  Camera    │  │  Geofence │
└──────┬─────┘  └─────┬─────┘  └──────┬─────┘  └─────┬─────┘
       │              │               │               │
       ▼              ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│              Attendance Ingestion Layer                      │
│                                                             │
│  iClock API ──▶ Parse ATTLOG ──▶ Match Employee             │
│  Web API ──────────────────────▶ Validate Punch             │
│  Face API ──▶ Encode/Match ────▶ Create Record              │
│  Mobile API ──▶ GPS Validate ──▶ Store Punch                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Attendance Processing Engine                    │
│                                                             │
│  1. Map punches to shift schedule                           │
│  2. Calculate work hours (first-in / last-out)              │
│  3. Apply shift rules (grace period, min hours)             │
│  4. Detect: Late │ Early Leave │ Absent │ Half-Day │ OT     │
│  5. Apply validation rules (auto-mark events)               │
│  6. Generate daily attendance status                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Monthly Summary & Validation                   │
│                                                             │
│  • Aggregate daily records into monthly summaries           │
│  • Run validation process rules                             │
│  • Hold/Revert capability for corrections                   │
│  • Regularization workflow for exceptions                   │
│  • Lock monthly data after approval                         │
│  • Feed to Payroll (post-to-payroll mapping)                │
└─────────────────────────────────────────────────────────────┘
```

### 7b. Payroll Processing Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                       INPUT COLLECTION                             │
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  ┌───────────┐ │
│  │  Attendance  │  │   Leave     │  │  Variable  │  │  Loan     │ │
│  │  Summary     │  │   Balance   │  │  Inputs    │  │  EMI      │ │
│  │  (LOP days)  │  │  (Encash)   │  │  (OT/Incv) │  │  Deduct   │ │
│  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  └─────┬─────┘ │
│         │                │               │                │       │
└─────────┼────────────────┼───────────────┼────────────────┼───────┘
          │                │               │                │
          ▼                ▼               ▼                ▼
┌────────────────────────────────────────────────────────────────────┐
│                   PAYROLL CALCULATION ENGINE                       │
│                                                                    │
│  1. Fetch salary structure (components: Basic, HRA, DA, etc.)     │
│  2. Apply attendance-based deductions (LOP)                       │
│  3. Calculate variable components (OT, incentives)                │
│  4. Calculate statutory deductions:                                │
│     ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│     │   EPF    │ │  ESIC    │ │   PT     │ │  TDS     │          │
│     │ 12%+12%  │ │ 0.75%+   │ │ State    │ │ Income   │          │
│     │ of Basic │ │ 3.25%    │ │ slab     │ │ Tax slab │          │
│     └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  5. Calculate net pay = Gross - Deductions                        │
│  6. Generate payslip (PDF via PDFKit)                             │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                      OUTPUT & REPORTING                            │
│                                                                    │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Payslips │  │  Compliance  │  │  Post to   │  │  Bank      │  │
│  │  (PDF)   │  │  Reports     │  │  Payroll   │  │  Statement │  │
│  │          │  │  EPF/ESIC/PT │  │  (Acctg)   │  │            │  │
│  └──────────┘  └──────────────┘  └────────────┘  └────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 8. Technology Stack Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   FRONTEND                     BACKEND                      DATA                │
│   ─────────                    ───────                      ────                │
│   React 18.2                   Express 4.18                 PostgreSQL 15+      │
│   TypeScript 5.3               TypeScript 5.3               Prisma ORM 5.8     │
│   Vite 5.0                     Node.js                      Redis 7            │
│   Tailwind CSS 3.4             JWT (jsonwebtoken)           100+ Tables        │
│   Zustand 4.4                  bcryptjs 2.4                 20+ Enums          │
│   React Query 5.17             Helmet 7.1                                      │
│   React Router 6.21            CORS 2.8                     DEVOPS             │
│   React Hook Form 7.49         Rate Limiter 7.1             ──────             │
│   Zod 3.22                     Multer 2.1                   Docker Compose     │
│   Recharts 2.10                PDFKit 0.17                  AWS RDS            │
│   Axios 1.6                    Winston 3.11                 AWS S3             │
│   XLSX 0.18                    Nodemailer 6.9               pgAdmin 4          │
│   date-fns 3.6                 Joi 17.11                                       │
│   react-webcam 7.2             XLSX 0.18                    INTEGRATIONS       │
│                                Compression 1.7               ────────────       │
│                                                              BNC Configurator  │
│                                                              ESSL/ZKTeco       │
│                                                              Face Service      │
│                                                              SMTP Email        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Module Domain Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            BNC HRMS MODULE MAP                                  │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         CORE MODULES                                    │    │
│  │                                                                         │    │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐                 │    │
│  │  │  Employee     │  │  Organization │  │  Auth &      │                 │    │
│  │  │  Management   │  │  Structure    │  │  Access      │                 │    │
│  │  │              │  │               │  │              │                 │    │
│  │  │ • Master Data│  │ • Org Setup   │  │ • Login/SSO  │                 │    │
│  │  │ • Bulk Import│  │ • Departments │  │ • RBAC       │                 │    │
│  │  │ • Documents  │  │ • Positions   │  │ • Permissions│                 │    │
│  │  │ • Bank A/c   │  │ • Entities    │  │ • Multi-     │                 │    │
│  │  │ • Change Req │  │ • Locations   │  │   Tenancy    │                 │    │
│  │  │ • Rejoin     │  │ • Cost Centre │  │              │                 │    │
│  │  └──────────────┘  └───────────────┘  └──────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                       OPERATIONAL MODULES                               │    │
│  │                                                                         │    │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐                 │    │
│  │  │  Attendance   │  │  Leave &      │  │  Payroll &   │                 │    │
│  │  │  & Time       │  │  Events       │  │  Compensation│                 │    │
│  │  │              │  │               │  │              │                 │    │
│  │  │ • Daily Track│  │ • Leave Types │  │ • Salary Str │                 │    │
│  │  │ • Biometric  │  │ • Accrual     │  │ • Run Payroll│                 │    │
│  │  │ • Face       │  │ • Balance     │  │ • Payslips   │                 │    │
│  │  │ • Geofence   │  │ • Request     │  │ • Components │                 │    │
│  │  │ • Shifts     │  │ • Approval    │  │ • Variable   │                 │    │
│  │  │ • Validation │  │ • Comp-Off    │  │ • Statutory  │                 │    │
│  │  │ • Monthly Sum│  │ • Encashment  │  │ • EPF/ESIC   │                 │    │
│  │  │ • Regularize │  │ • Carry-fwd   │  │ • PT/TDS     │                 │    │
│  │  │ • Excess Time│  │ • Auto-Credit │  │ • Compliance │                 │    │
│  │  └──────────────┘  └───────────────┘  └──────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                       ADVANCED MODULES                                  │    │
│  │                                                                         │    │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐                 │    │
│  │  │  ESOP         │  │  Transactions │  │  Configuration│                │    │
│  │  │  Management   │  │  & Lifecycle  │  │  & Workflow   │                │    │
│  │  │              │  │               │  │              │                 │    │
│  │  │ • Pools      │  │ • Transfer    │  │ • Approval   │                 │    │
│  │  │ • Grants     │  │ • Promotion   │  │   Workflows  │                 │    │
│  │  │ • Vesting    │  │ • Separation  │  │ • Rule       │                 │    │
│  │  │ • Exercise   │  │ • FnF Settle  │  │   Settings   │                 │    │
│  │  │ • Ledger     │  │ • Loans       │  │ • Rights     │                 │    │
│  │  │              │  │               │  │ • Validation │                 │    │
│  │  └──────────────┘  └───────────────┘  └──────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Request Lifecycle (End-to-End)

```
  Browser                    Vite Dev Server / Nginx            Express.js Backend
  ───────                    ────────────────────────            ──────────────────
     │                              │                                  │
     │  1. User Action              │                                  │
     │  (Click/Submit)              │                                  │
     │                              │                                  │
     │  2. React Component          │                                  │
     │     │                        │                                  │
     │     ├─ React Hook Form       │                                  │
     │     │  (Validate w/ Zod)     │                                  │
     │     │                        │                                  │
     │     ├─ React Query           │                                  │
     │     │  (useMutation/Query)   │                                  │
     │     │                        │                                  │
     │     └─ API Service           │                                  │
     │        (axios call)          │                                  │
     │                              │                                  │
     │  3. HTTP Request  ──────────▶│  4. Proxy to Backend             │
     │     /api/v1/...              │     ───────────────▶             │
     │     Bearer: JWT              │                                  │
     │                              │                      5. Middleware Pipeline
     │                              │                      ┌──────────────────┐
     │                              │                      │ Helmet           │
     │                              │                      │ CORS             │
     │                              │                      │ Rate Limit       │
     │                              │                      │ Body Parser      │
     │                              │                      │ JWT Auth         │
     │                              │                      │ Permission Check │
     │                              │                      │ RBAC Filter      │
     │                              │                      │ Validation       │
     │                              │                      └────────┬─────────┘
     │                              │                               │
     │                              │                      6. Controller
     │                              │                         │
     │                              │                      7. Service Layer
     │                              │                         │
     │                              │                      8. Prisma ORM
     │                              │                         │
     │                              │                      9. PostgreSQL
     │                              │                         │
     │                              │                     10. Response
     │                              │  11. Proxy back          │
     │  12. JSON Response ◀─────────│◀─────────────────────────│
     │                              │                          │
     │  13. React Query             │                          │
     │      │                       │                          │
     │      ├─ Update cache         │                          │
     │      ├─ Invalidate queries   │                          │
     │      └─ Re-render component  │                          │
     │                              │                          │
     │  14. UI Update               │                          │
     │      (Tailwind + Recharts)   │                          │
     │                              │                          │
```

---

*Generated: March 2026 | BNC HRMS Technical Architecture v1.0*
