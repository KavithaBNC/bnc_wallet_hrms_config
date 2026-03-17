/**
 * Payroll Rules Execution
 * Uses PaygroupComponentRule + Compound to:
 * - Load rules for a paygroup in evaluation order (respects order column)
 * - Build dependency graph from formula references [ShortName]
 * - Topological sort for Derived components; throw on circular dependency
 * - Safe formula evaluation with a context of component values
 */

import { prisma } from '../utils/prisma';

export interface RuleForExecution {
  compoundId: string;
  shortName: string;
  longName: string;
  category: string;
  inputType: string;
  componentBehavior: string;
  formula: string | null;
  percentage: number | null;
  rounding: boolean;
  roundingType: string | null;
  roundOffValue: number | null;
  order: number;
}

/** Extract component short names referenced in formula, e.g. [Basic], [HRA] -> ['Basic','HRA'] */
export function parseFormulaDependencies(formula: string | null): string[] {
  if (!formula?.trim()) return [];
  const matches = formula.matchAll(/\[([^\]]+)\]/g);
  const set = new Set<string>();
  for (const m of matches) set.add(m[1].trim());
  return [...set];
}

/**
 * Extract all component dependencies from a CONDITIONAL JSON formula.
 * Scans both condition and then expressions in every row for:
 *   - [BracketRef] syntax (same as Derived formulas)
 *   - Bare identifiers that match known component shortNames (resolved later by caller)
 */
export function parseConditionalDependencies(
  formulaJson: string | null,
  knownShortNames: Set<string>
): string[] {
  if (!formulaJson?.trim()) return [];
  let rows: { condition?: string; then?: string }[];
  try {
    rows = JSON.parse(formulaJson);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];

  const deps = new Set<string>();
  for (const row of rows) {
    const text = `${row.condition ?? ''} ${row.then ?? ''}`;
    // Bracket syntax [ShortName]
    for (const m of text.matchAll(/\[([^\]]+)\]/g)) {
      deps.add(m[1].trim());
    }
    // Bare identifiers — only add if they match a known component
    for (const m of text.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
      if (knownShortNames.has(m[1])) deps.add(m[1]);
    }
  }
  return [...deps];
}

/** Check if a rule type participates in dependency-sorted evaluation */
function isDerivedType(inputType: string): boolean {
  return inputType === 'DERIVED' || inputType === 'SYSTEM_DERIVED' || inputType === 'CONDITIONAL';
}

/** Topological sort of rules by formula dependencies; respects rule.order for tie-break. Throws if cycle. */
export function buildEvaluationOrder(
  rules: RuleForExecution[],
  shortNameToRule: Map<string, RuleForExecution>
): RuleForExecution[] {
  const knownShortNames = new Set(rules.map((r) => r.shortName));
  const derived = rules.filter((r) => isDerivedType(r.inputType));
  const inDegree = new Map<string, number>();
  const edges = new Map<string, string[]>();

  for (const r of derived) {
    inDegree.set(r.shortName, 0);
    edges.set(r.shortName, []);
  }
  for (const r of derived) {
    const deps = r.inputType === 'CONDITIONAL'
      ? parseConditionalDependencies(r.formula, knownShortNames)
      : parseFormulaDependencies(r.formula);
    for (const d of deps) {
      const depRule = shortNameToRule.get(d);
      if (depRule && isDerivedType(depRule.inputType)) {
        edges.get(depRule.shortName)!.push(r.shortName);
        inDegree.set(r.shortName, (inDegree.get(r.shortName) ?? 0) + 1);
      }
    }
  }

  const queue: RuleForExecution[] = derived.filter((r) => inDegree.get(r.shortName) === 0);
  const result: RuleForExecution[] = [];
  const inputRules = rules.filter((r) => r.inputType === 'INPUT').sort((a, b) => a.order - b.order);
  result.push(...inputRules);

  while (queue.length > 0) {
    queue.sort((a, b) => a.order - b.order);
    const r = queue.shift()!;
    result.push(r);
    for (const nextShort of edges.get(r.shortName) ?? []) {
      const newDeg = (inDegree.get(nextShort) ?? 1) - 1;
      inDegree.set(nextShort, newDeg);
      if (newDeg === 0) {
        const nextRule = shortNameToRule.get(nextShort);
        if (nextRule) queue.push(nextRule);
      }
    }
  }

  if (result.length < rules.length) {
    const remaining = rules.filter((r) => !result.includes(r));
    throw new Error(`Circular dependency in formulas involving: ${remaining.map((r) => r.shortName).join(', ')}`);
  }
  return result;
}

/** Safe evaluate expression: replace [ShortName] with context[shortName], then evaluate numbers and + - * / ( ). */
export function evaluateFormula(formula: string | null, context: Record<string, number>): number {
  if (!formula?.trim()) return 0;
  let expr = formula.trim();
  for (const [key, value] of Object.entries(context)) {
    const token = `[${key}]`;
    if (expr.includes(token)) expr = expr.split(token).join(String(value));
  }
  // Also replace bare component names (for conditional then/condition expressions that omit brackets)
  for (const [key, value] of Object.entries(context)) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    expr = expr.replace(re, String(value));
  }
  const allowed = /^[\d\s+\-*/().]+$/;
  if (!allowed.test(expr)) return 0;
  try {
    const fn = new Function(`return (${expr})`);
    const out = fn();
    return typeof out === 'number' && Number.isFinite(out) ? out : 0;
  } catch {
    return 0;
  }
}

/**
 * Safely evaluate a numeric expression string.
 * Only allows digits, spaces, +, -, *, /, (, ), .
 */
function safeEvalNumber(expr: string): number {
  const cleaned = expr.trim();
  if (!cleaned) return 0;
  const allowed = /^[\d\s+\-*/().]+$/;
  if (!allowed.test(cleaned)) return 0;
  try {
    const fn = new Function(`return (${cleaned})`);
    const out = fn();
    return typeof out === 'number' && Number.isFinite(out) ? out : 0;
  } catch {
    return 0;
  }
}

/**
 * Evaluate a comparison condition expression, e.g. "FGROSS <= 21000"
 * Substitutes context values for component names, then evaluates the comparison.
 * Supports: <=, >=, ==, !=, <, >
 */
export function evaluateCondition(
  condition: string | null,
  context: Record<string, number>
): boolean {
  if (!condition?.trim()) return false;

  let expr = condition.trim();
  // Replace [BracketRef] first
  for (const [key, value] of Object.entries(context)) {
    const token = `[${key}]`;
    if (expr.includes(token)) expr = expr.split(token).join(String(value));
  }
  // Replace bare component names (longest first to avoid partial matches)
  const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    expr = expr.replace(re, String(context[key]));
  }

  // Parse comparison: <left> <operator> <right>
  const match = expr.match(/^(.+?)\s*(<=|>=|==|!=|<|>)\s*(.+)$/);
  if (!match) return false;

  const left = safeEvalNumber(match[1]);
  const operator = match[2];
  const right = safeEvalNumber(match[3]);

  switch (operator) {
    case '<=': return left <= right;
    case '>=': return left >= right;
    case '==': return left === right;
    case '!=': return left !== right;
    case '<':  return left < right;
    case '>':  return left > right;
    default:   return false;
  }
}

/**
 * Evaluate a CONDITIONAL formula (JSON array of IF/ELSE rules).
 * Processes rows top-to-bottom: first IF whose condition is true wins.
 * ELSE acts as default fallback (no condition needed).
 * Returns 0 if no condition matches and no ELSE exists.
 */
export function evaluateConditionalFormula(
  formulaJson: string | null,
  context: Record<string, number>
): number {
  if (!formulaJson?.trim()) return 0;

  let rows: { type: string; condition: string; then: string }[];
  try {
    rows = JSON.parse(formulaJson);
  } catch {
    return 0;
  }
  if (!Array.isArray(rows)) return 0;

  for (const row of rows) {
    if (row.type === 'IF') {
      if (evaluateCondition(row.condition, context)) {
        return evaluateFormula(row.then, context);
      }
    } else if (row.type === 'ELSE') {
      return evaluateFormula(row.then, context);
    }
  }
  return 0;
}

export function applyRounding(
  value: number,
  roundingType: string | null,
  roundOffValue: number | null
): number {
  const step = roundOffValue != null && roundOffValue > 0 ? roundOffValue : 1;
  switch (roundingType?.toUpperCase()) {
    case 'NEAREST':
      return Math.round(value / step) * step;
    case 'UP':
      return Math.ceil(value / step) * step;
    case 'DOWN':
      return Math.floor(value / step) * step;
    default:
      return value;
  }
}

/**
 * Load all rules for a paygroup with compound details, ordered for payroll execution.
 * 1. Fetch active compounds (EARNING/DEDUCTION, status=ACTIVE) and paygroup_component_rules.
 * 2. Merge: each compound has one rule (or defaults).
 * 3. Sort by rule.order, then by formula dependencies (topological) for Derived components.
 * 4. Throw if circular dependency detected.
 */
export async function getOrderedRulesForPaygroup(
  organizationId: string,
  paygroupId: string
): Promise<RuleForExecution[]> {
  const compoundsRaw = await prisma.compound.findMany({
    where: {
      organizationId,
      componentType: { in: ['EARNING', 'DEDUCTION'] },
    },
    orderBy: [{ componentType: 'asc' }, { shortName: 'asc' }],
  });
  const compounds = compoundsRaw.filter(
    (c) => !(c as { status?: string }).status || String((c as { status?: string }).status).toUpperCase() === 'ACTIVE'
  );

  const rules = await prisma.paygroupComponentRule.findMany({
    where: { paygroupId, organizationId },
    include: { compound: true },
  });
  const ruleByCompoundId = new Map(rules.map((r) => [r.compoundId, r]));

  const list: RuleForExecution[] = compounds.map((c) => {
    const r = ruleByCompoundId.get(c.id);
    return {
      compoundId: c.id,
      shortName: c.shortName,
      longName: c.longName,
      category: c.componentType,
      inputType: r?.inputType ?? 'INPUT',
      componentBehavior: r?.componentBehavior ?? 'DEFAULT',
      formula: r?.formula ?? null,
      percentage: r?.percentage != null ? Number(r.percentage) : 100,
      rounding: r?.rounding ?? false,
      roundingType: r?.roundingType ?? null,
      roundOffValue: r?.roundOffValue != null ? Number(r.roundOffValue) : null,
      order: r?.order ?? 0,
    };
  });

  const activeShortNames = new Set(list.map((r) => r.shortName));
  const activeShortNamesLower = new Set(list.map((r) => r.shortName.toLowerCase()));
  for (const rule of list) {
    if ((rule.inputType === 'DERIVED' || rule.inputType === 'SYSTEM_DERIVED') && rule.formula) {
      const deps = parseFormulaDependencies(rule.formula);
      for (const ref of deps) {
        if (!activeShortNamesLower.has(ref.trim().toLowerCase())) {
          throw new Error(`Derived formula references component "${ref}" which is Inactive or not found. Only Active components may be used in formulas.`);
        }
      }
    }
    if (rule.inputType === 'CONDITIONAL' && rule.formula) {
      const deps = parseConditionalDependencies(rule.formula, activeShortNames);
      for (const ref of deps) {
        if (!activeShortNamesLower.has(ref.trim().toLowerCase())) {
          throw new Error(`Conditional formula references component "${ref}" which is Inactive or not found. Only Active components may be used in formulas.`);
        }
      }
    }
  }

  const shortNameToRule = new Map(list.map((r) => [r.shortName, r]));
  return buildEvaluationOrder(list, shortNameToRule);
}

/**
 * Evaluate all components for one employee/context.
 * - context: initial values keyed by shortName (e.g. from salary structure or variable input).
 * - Returns final component values after applying Derived formulas, percentage, rounding.
 */
export function evaluatePayrollComponents(
  orderedRules: RuleForExecution[],
  initialContext: Record<string, number>
): Record<string, number> {
  const context: Record<string, number> = { ...initialContext };

  for (const r of orderedRules) {
    let value: number;
    if (r.inputType === 'INPUT') {
      value = context[r.shortName] ?? 0;
    } else if (r.inputType === 'CONDITIONAL') {
      value = evaluateConditionalFormula(r.formula, context);
    } else {
      value = evaluateFormula(r.formula, context);
    }
    if (r.percentage != null) value = (value * r.percentage) / 100;
    if (r.rounding) value = applyRounding(value, r.roundingType, r.roundOffValue);
    context[r.shortName] = value;
  }
  return context;
}
