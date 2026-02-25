# Payroll Rules Engine – System Flow

## STEP 1 – Component Creation (Component Master)

- **Table:** `compounds`
- **Purpose:** Store payroll components (Earnings/Deduction). No payroll behaviour is stored here.

| Column            | Type        | Description |
|-------------------|-------------|-------------|
| id                | UUID        | PK |
| organization_id   | UUID        | FK organizations |
| short_name        | VARCHAR(100)| e.g. `basic`, `hra`, `ot` |
| long_name         | VARCHAR(255)| e.g. `Basic Pay`, `House Rent Allowance` |
| component_type    | VARCHAR(50) | **EARNING** or **DEDUCTION** (and others e.g. MASTER, TRANSACTION) |
| type              | VARCHAR(50) | Value type: Number, Percentage, etc. |
| status            | VARCHAR(20) | **ACTIVE** / INACTIVE. Only ACTIVE appear in Rules Engine. |
| (other columns)   |             | is_drop_down, is_compulsory, show_in_payslip, etc. |

**Example rows:**

| short_name | long_name              | component_type | status  |
|------------|------------------------|----------------|---------|
| basic      | Basic Pay              | EARNING        | ACTIVE  |
| hra        | House Rent Allowance   | EARNING        | ACTIVE  |
| ot         | Overtime               | EARNING        | ACTIVE  |
| pf         | Provident Fund         | DEDUCTION      | ACTIVE  |

---

## STEP 2 – Rules Engine Screen Load

When the Rules Engine screen opens:

1. User selects a **Paygroup**.
2. Backend loads **all active components** from `compounds` and merges with **saved rules** for that paygroup.

**Query (conceptual):**

```sql
-- Active components (Earnings/Deduction only)
SELECT * FROM compounds
WHERE organization_id = $1
  AND component_type IN ('EARNING', 'DEDUCTION')
  AND status = 'Active';   -- stored as 'ACTIVE' in DB

-- Saved rules for the selected paygroup
SELECT r.*, c.short_name, c.long_name, c.component_type
FROM paygroup_component_rules r
JOIN compounds c ON c.id = r.compound_id
WHERE r.organization_id = $1 AND r.paygroup_id = $2;
```

**Join / merge logic:**

- For each row from `compounds` (step 1), there is **at most one** row in `paygroup_component_rules` (by `paygroup_id`, `compound_id`).
- If no rule exists → row still appears with **defaults** (Input, Default, no formula, 100%, rounding off, order 0).
- **short_name** and **long_name** are **read-only** and always come from `compounds`.

**Important:**

- User **does not** add/delete rows manually.
- Rows are **fully driven** by `compounds` (and paygroup).
- New component in Component Creation → it **automatically** appears in Rules Engine for every paygroup (with defaults until user saves).

---

## STEP 3 – Rules Configuration (Dynamic Behaviour)

For each component row the user configures (per paygroup):

| Field               | Description |
|---------------------|-------------|
| input_type          | **Input** / **Derived** / **System Derived** |
| component_behavior  | Default / Variable Input / Reimbursement / Deduction / Employer Contribution / System |
| formula             | Enabled **only if** input_type = **Derived** (or System Derived). Disabled and not saved when Input. |
| percentage          | e.g. 100 |
| rounding            | Yes/No |
| rounding_type       | e.g. Nearest, Up, Down (optional) |
| round_off_value     | Optional step for rounding |
| order               | Evaluation order (integer). |

**Table:** `paygroup_component_rules`

| Column             | Type         | Description |
|--------------------|--------------|-------------|
| id                 | UUID         | PK |
| organization_id    | UUID         | |
| paygroup_id        | UUID         | FK paygroups |
| compound_id        | UUID         | FK compounds (component_id in your terms) |
| input_type         | VARCHAR(50)  | INPUT / DERIVED / SYSTEM_DERIVED |
| component_behavior | VARCHAR(50)  | DEFAULT / VARIABLE_INPUT / … |
| formula            | VARCHAR(2000)| Null when input_type = INPUT |
| percentage         | DECIMAL      | Nullable |
| rounding           | BOOLEAN      | |
| rounding_type      | VARCHAR(20)  | Optional |
| round_off_value    | DECIMAL      | Optional |
| order              | INT          | Evaluation order |

**Unique:** `(paygroup_id, compound_id)`.

---

## API Structure

| Method | Path                    | Purpose |
|--------|-------------------------|---------|
| GET    | `/api/v1/rules-engine`  | Load rules for a paygroup (auto-populate from compounds + merge rules). |
| PUT    | `/api/v1/rules-engine`  | Save rules for a paygroup (body: `organizationId`, `paygroupId`, `rules[]`). |

**GET query params:** `organizationId`, `paygroupId`.

**GET response:** `{ data: { rules: RulesEngineRowDto[] } }`  
Each row: `ruleId`, `compoundId`, `shortName`, `longName`, `category`, `inputType`, `componentBehavior`, `formula`, `percentage`, `rounding`, `roundingType`, `roundOffValue`, `order`.

**PUT body:**  
`{ organizationId, paygroupId, rules: [{ compoundId, inputType, componentBehavior, formula, percentage, rounding, roundingType, roundOffValue, order }, ...] }`  
If `inputType === 'Input'`, backend ignores/clears `formula`.

---

## Join Query (Backend)

Rules Engine list is built in code (not a single SQL join) so that **every active compound** gets a row even when no rule exists:

```ts
// 1) All active compounds (EARNING / DEDUCTION)
const compounds = await prisma.compound.findMany({
  where: {
    organizationId,
    componentType: { in: ['EARNING', 'DEDUCTION'] },
    status: { equals: 'ACTIVE', mode: 'insensitive' },
  },
  orderBy: [{ componentType: 'asc' }, { shortName: 'asc' }],
});

// 2) Existing rules for this paygroup
const rules = await prisma.paygroupComponentRule.findMany({
  where: { paygroupId, organizationId },
});
const ruleByCompoundId = new Map(rules.map((r) => [r.compoundId, r]));

// 3) One row per compound; fill in rule or defaults
return compounds.map((c) => toDto(c, ruleByCompoundId.get(c.id) ?? null));
```

Equivalent single-query style (for reference):

```sql
SELECT
  c.id AS compound_id,
  c.short_name,
  c.long_name,
  c.component_type AS category,
  r.id AS rule_id,
  r.input_type,
  r.component_behavior,
  r.formula,
  r.percentage,
  r.rounding,
  r.rounding_type,
  r.round_off_value,
  r."order"
FROM compounds c
LEFT JOIN paygroup_component_rules r
  ON r.compound_id = c.id AND r.paygroup_id = $1
WHERE c.organization_id = $2
  AND c.component_type IN ('EARNING', 'DEDUCTION')
  AND c.status = 'ACTIVE'
ORDER BY c.component_type, c.short_name;
```

---

## Frontend Dynamic Loading Logic

1. **On load / when paygroup changes**
   - Call `GET /api/v1/rules-engine?organizationId=&paygroupId=`.
   - Store result in state (e.g. `rules`).

2. **Tabs**
   - **Earnings:** `rules.filter(r => r.category === 'EARNING')`.
   - **Deductions:** `rules.filter(r => r.category === 'DEDUCTION')`.

3. **Table**
   - **short_name**, **long_name:** read-only (from API).
   - **input_type**, **component_behavior**, **formula**, **percentage**, **rounding**, **order:** editable (dropdowns/inputs).
   - **Formula:** disabled when `input_type === 'Input'`; clear formula when user switches to Input.

4. **Save**
   - Send current table data as `rules[]` in `PUT /api/v1/rules-engine`.
   - Refetch rules after success.

5. **New component**
   - As soon as a new compound (EARNING/DEDUCTION, ACTIVE) is created in Component Creation, the next Rules Engine load for any paygroup will include it (with default rule until user saves).

---

## Payroll Calculation Execution Logic

During payroll run (e.g. per employee, per paygroup):

1. **Load ordered rules**
   - Use `getOrderedRulesForPaygroup(organizationId, paygroupId)` from `payroll-rules-execution.service.ts`.
   - This:
     - Loads active compounds (EARNING/DEDUCTION, status ACTIVE) and paygroup_component_rules.
     - Merges into one list per component.
     - Builds dependency graph from formulas (tokens like `[Basic]`, `[HRA]`).
     - **Topological sort** for Derived components so dependencies are evaluated first.
     - **Throws** if a circular dependency is detected.
     - **Respects** the `order` column (for tie-breaking and ordering INPUTs).

2. **Initial context**
   - Build `initialContext: Record<shortName, number>` from:
     - Salary structure (Default components).
     - Variable input / overrides (Variable Input components).

3. **Evaluate in order**
   - For each rule in the ordered list:
     - **INPUT:** use value from context (structure or variable input).
     - **DERIVED / SYSTEM_DERIVED:** evaluate `formula` using current context (replace `[ShortName]` with context values; safe expression eval).
     - Apply **percentage** (if present).
     - Apply **rounding** (if enabled) using rounding_type and round_off_value.
     - Write result back into context and into payroll result.

4. **Circular dependency**
   - If formula A references B and B (directly or indirectly) references A, topological sort fails and the service throws so payroll does not run with invalid rules.

**Relevant file:** `backend/src/services/payroll-rules-execution.service.ts`  
- `getOrderedRulesForPaygroup`  
- `parseFormulaDependencies`  
- `buildEvaluationOrder`  
- `evaluateFormula`  
- `applyRounding`  
- `evaluatePayrollComponents`

---

## Dynamic Requirements Checklist

| Requirement | Implementation |
|-------------|----------------|
| New component created → auto-appear in Rules Engine | Rules Engine loads from `compounds` (EARNING/DEDUCTION, ACTIVE). No manual add. |
| input_type = Input → formula disabled | Frontend disables and clears formula; backend does not save formula for INPUT. |
| input_type = Derived → formula enabled | Frontend enables formula; backend stores and uses it in payroll. |
| Data saved paygroup-wise | Table `paygroup_component_rules` keyed by `paygroup_id` + `compound_id`. |
| Payroll: respect order | Ordered list built with `order` and topological sort. |
| Payroll: evaluate Derived sequentially | Same ordered list; Derived evaluated after their dependencies. |
| Payroll: prevent circular dependency | Topological sort throws if cycle detected. |

---

## DB Schema Summary (Prisma)

- **Compound:** id, organizationId, componentType, shortName, longName, type, **status** (default ACTIVE), …
- **PaygroupComponentRule:** id, organizationId, paygroupId, compoundId, inputType, componentBehavior, formula, percentage, rounding, roundingType, roundOffValue, order.  
  Unique: `(paygroup_id, compound_id)`.

Migrations:

- `20260223100000_add_paygroup_component_rules` – creates `paygroup_component_rules`.
- `20260223110000_add_status_to_compounds` – adds `status` to `compounds`.

Run from backend: `npx prisma migrate deploy` (or `migrate dev`).
