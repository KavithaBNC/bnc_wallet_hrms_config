## Payroll Rules Engine – Test Cases

This document tracks automated and logical test cases for the **Payroll Rules Engine** and its execution service.

- Backend service: `backend/src/services/payroll-rules-execution.service.ts`
- Jest tests: `backend/src/services/payroll-rules-execution.service.test.ts`

All tests listed below are currently **passing**.

---

## 1. Formula and Dependency Helpers

- **parseFormulaDependencies**
  - Returns empty array for `null`, empty, or whitespace-only formulas.
  - Extracts single and multiple `[ShortName]` references.
  - Trims names inside brackets (e.g., `[ HRA ] → "HRA"`).
  - Deduplicates when the same component appears multiple times.

- **buildEvaluationOrder**
  - Inputs (`inputType = INPUT`) always come first, ordered by `order`.
  - Derived components (`DERIVED`, `SYSTEM_DERIVED`) are ordered so that dependencies are evaluated before dependants.
  - Detects cycles and throws:  
    `Circular dependency in formulas involving: ...`

---

## 2. Safe Formula Evaluation and Rounding

- **evaluateFormula**
  - Replaces `[ShortName]` tokens using the provided context and evaluates arithmetic.
  - Returns `0` for:
    - Empty / null formulas.
    - Formulas containing disallowed characters (anything other than digits, spaces, `+ - * / ( )` and dots).
    - Syntax errors or runtime errors during evaluation.
  - If a referenced key is missing in context (e.g. `[pf]` but no `pf` key), the expression is treated as invalid and returns `0`.

- **applyRounding**
  - `NEAREST`: rounds to nearest multiple of `roundOffValue` (or 1 if not set).
  - `UP`: rounds up (ceiling) to the next multiple.
  - `DOWN`: rounds down (floor) to the previous multiple.
  - Unknown / null `roundingType` leaves the value unchanged.

---

## 3. getOrderedRulesForPaygroup (DB mocked in tests)

Using a mocked Prisma client, we validate:

- **Active component filtering**
  - Only `Compound` rows with `status = 'ACTIVE'` are included.
  - Inactive compounds are excluded from the returned rules.

- **Missing or inactive references**
  - For `DERIVED` / `SYSTEM_DERIVED` rules, each `[ShortName]` in `formula` must match an active component.
  - If a referenced component is missing or inactive, the service throws:  
    `Derived formula references component "X" which is Inactive or not found. Only Active components may be used in formulas.`

- **Rule merging and ordering**
  - Combines `Compound` + `PaygroupComponentRule` into a unified `RuleForExecution` list.
  - Ensures:
    - Correct `inputType`, `componentBehavior`, `formula`, `percentage`, `rounding`, `roundingType`, `roundOffValue`, `order`.
    - Inputs are ordered before derived components when evaluating.

---

## 4. evaluatePayrollComponents (Core Execution Flow)

These tests call `evaluatePayrollComponents(orderedRules, initialContext)` directly.

- **Basic behavior**
  - Input components read their value from `initialContext[shortName]` or default to `0` if missing.
  - Derived components:
    - Use `evaluateFormula` on their `formula`.
    - Then apply `percentage` if set (value × percentage / 100).
    - Then apply rounding if `rounding = true`.
  - Evaluation order respects `orderedRules`, so later formulas can depend on earlier results.

- **Example tests**
  - Uses initial context for INPUT components and evaluates a simple derived formula.
  - Applies percentage (e.g. PF = `[basic_pay]` with `percentage = 12` → `0.12 × basic_pay`).
  - Applies rounding with `NEAREST` and a step value (e.g. round to nearest 10).
  - Confirms that missing INPUT values are treated as `0`.

---

## 5. Gross Driven Payroll – Key Test Case

**Goal:** Validate gross-driven breakup where only `FIXED_GROSS` is an input, and other components are fully derived from it.

### 5.1 Rules

1. `FIXED_GROSS` – **Input**
2. `basic_pay` – **Derived**  
   Formula: `[FIXED_GROSS] * 50 / 100`
3. `hra` – **Derived**  
   Formula: `[basic_pay] * 40 / 100`
4. `other_allowance` – **Derived**  
   Formula: `[FIXED_GROSS] - ([basic_pay] + [hra])`

Order used in the test:

1. `FIXED_GROSS` (order 0, INPUT)  
2. `basic_pay` (order 1, DERIVED)  
3. `hra` (order 2, DERIVED)  
4. `other_allowance` (order 3, DERIVED)

### 5.2 Input

- `initialContext = { FIXED_GROSS: 18000 }`

### 5.3 Expected Output

- `basic_pay = 9000`  
  `= 18000 × 50 / 100`
- `hra = 3600`  
  `= 9000 × 40 / 100`
- `other_allowance = 5400`  
  `= 18000 − (9000 + 3600)`

Validation:

- `basic_pay + hra + other_allowance = 9000 + 3600 + 5400 = 18000`
- Sum equals `FIXED_GROSS`.
- No circular dependency error (evaluation order works correctly).

Status:

- Implemented as Jest test  
  `Gross Driven Payroll: FIXED_GROSS input → basic_pay, hra, other_allowance derived; total equals FIXED_GROSS`  
  in `payroll-rules-execution.service.test.ts` → **Pass**

---

## 6. How to Run These Tests

From the `backend` folder:

```bash
npx jest src/services/payroll-rules-execution.service.test.ts
```

Or to run only the gross-driven test:

```bash
npx jest src/services/payroll-rules-execution.service.test.ts -t \"Gross Driven\"
```

