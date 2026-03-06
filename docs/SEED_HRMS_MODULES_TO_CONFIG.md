# HRMS Modules — Config DB-க்கு Seed பண்ணுதல்

BNC Motors company + HRMS project க்கு எல்லா HRMS modules-ஐயும் Configurator `project_modules` table-ல் add பண்ணும் வழி.

---

## Option 1: Configurator API மூலம் (Recommended)

### Step 1: Get Super Admin Token

1. Configurator-ல் login பண்ணுங்க (Super Admin)
2. Browser DevTools → Network → Login request → Response-லிருந்து token copy பண்ணுங்க
3. அல்லது Configurator-ல் token எங்கே return ஆகுதோ அங்கிருந்து எடுக்கலாம்

### Step 2: Set Environment Variables

`backend/.env`-ல் add பண்ணுங்க:

```env
CONFIGURATOR_API_URL=http://localhost:3000
CONFIGURATOR_AUTH_TOKEN=your-super-admin-jwt-token
HRMS_PROJECT_ID=6
```

**HRMS_PROJECT_ID:** Configurator-ல் HRMS project-ன் id.  
- Configurator UI → Projects → HRMS project-க்கு click பண்ணி URL பாருங்க: `projects/6/modules` → project id = 6  
- அல்லது DB-ல்: `SELECT id FROM projects WHERE code = 'HRMS' LIMIT 1;`

### Step 3: Run Script

```bash
cd d:\git\bnc_wallet_hrms_config
npx ts-node scripts/seed-hrms-modules-to-config.ts
```

Script:
- Existing modules skip பண்ணும் (duplicate இல்லை)
- Parent modules முதலில் create பண்ணும், பிறகு children
- எல்லா 36 modules-ஐயும் add பண்ணும்

---

## Option 2: Direct SQL (DB Access இருந்தால்)

### Step 1: Get HRMS Project ID

Configurator DB-ல் run பண்ணுங்க:

```sql
SELECT id FROM projects WHERE code = 'HRMS' LIMIT 1;
```

Result: UUID (e.g. `a1b2c3d4-...`) அல்லது integer (e.g. `6`)

### Step 2: Edit SQL Script

`scripts/seed-hrms-modules-to-config.sql` open பண்ணி, line 35-ல்:

```sql
v_pid TEXT := 'YOUR_HRMS_PROJECT_ID';  -- <<<< REPLACE THIS
```

இதை உங்கள் project id-ஆல் replace பண்ணுங்க.  
Example: `v_pid TEXT := '6';` (integer) அல்லது `v_pid TEXT := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';` (UUID)

### Step 3: Run SQL

**Option A — Batch script (Windows, one-click):**
```bash
scripts\run-seed-config-modules.bat
```
Double-click பண்ணலாம் அல்லது terminal-ல் run பண்ணலாம். Config DB URL already set.

**Option B — Manual psql:**
```bash
psql "postgresql://postgres:Bncdb2026@bnc-db.czjz5u62pd3z.ap-south-1.rds.amazonaws.com:5432/Bnc_Configurator?schema=public&sslmode=require" -f scripts/seed-hrms-modules-company-59-v2.sql
```

**Option C — pgAdmin / DBeaver:** Script file open பண்ணி Execute பண்ணுங்க.

**Note:** `project_id` UUID ஆக இருந்தால் `v_pid::uuid` use பண்ணும். Integer ஆக இருந்தால் script-ல் சில casts மாற்ற வேண்டும் (see script comments).

---

## Modules List (36 total)

| Code | Name |
|------|------|
| DASHBOARD | Dashboard |
| ORGANIZATIONS | Organization Management |
| PERMISSIONS | Module Permission |
| EMPLOYEES | Employees |
| DEPARTMENTS | Department |
| POSITIONS | Position |
| CORE_HR | Core HR |
| COMPOUND_CREATION | Component Creation |
| RULES_ENGINE | Rules Engine |
| VARIABLE_INPUT | Variable Input |
| EVENT_CONFIGURATION | Event Configuration |
| ATTENDANCE_COMPONENTS | Attendance Components |
| APPROVAL_WORKFLOW | Approval Workflow |
| ... | (மொத்தம் 36 modules) |

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `CONFIGURATOR_AUTH_TOKEN required` | Super Admin token set பண்ணுங்க |
| `Project not found` | HRMS_PROJECT_ID சரி இருக்கிறதா பாருங்க |
| `Module with this code already exists` | Already added — skip ஆகும் |
| `401 Unauthorized` | Token expire ஆயிருக்கலாம் — புதிய token எடுங்க |
| **Insert ஆகல (SQL)** | See below |

### SQL Insert Troubleshooting

**1. முதலில் check பண்ணுங்க:**
```bash
psql $CONFIGURATOR_DATABASE_URL -f scripts/check-config-db-before-seed.sql
```

**2. Common errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Company BNC Motors not found` | companies table-ல் BNC இல்லை | `SELECT * FROM companies;` பார்த்து code/name சரி பாருங்க |
| `HRMS project not found` | BNC-க்கு HRMS project assign ஆகல | Configurator-ல் Company edit → Projects → HRMS select பண்ணுங்க |
| `invalid input syntax for type uuid` | projects.id integer ஆக இருக்கலாம் | project_id column type பாருங்க (check script output) |
| `ON CONFLICT` error | unique constraint பெயர் வேறு | V2 script use பண்ணுங்க (WHERE NOT EXISTS use பண்ணும்) |

**3. V2 script (recommended):**
```bash
scripts\run-seed-config-modules.bat
```
அல்லது:
```bash
psql "postgresql://postgres:Bncdb2026@bnc-db.czjz5u62pd3z.ap-south-1.rds.amazonaws.com:5432/Bnc_Configurator?schema=public&sslmode=require" -f scripts/seed-hrms-modules-company-59-v2.sql
```
