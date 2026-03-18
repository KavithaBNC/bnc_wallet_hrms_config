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

/** Topological sort of rules by formula dependencies; respects rule.order for tie-break. Throws if cycle. */
export function buildEvaluationOrder(
  rules: RuleForExecution[],
  shortNameToRule: Map<string, RuleForExecution>
): RuleForExecution[] {
  const derived = rules.filter((r) => r.inputType === 'DERIVED' || r.inputType === 'SYSTEM_DERIVED');
  const inDegree = new Map<string, number>();
  const edges = new Map<string, string[]>();

  for (const r of derived) {
    inDegree.set(r.shortName, 0);
    edges.set(r.shortName, []);
  }
  for (const r of derived) {
    const deps = parseFormulaDependencies(r.formula);
    for (const d of deps) {
      const depRule = shortNameToRule.get(d);
      if (depRule && (depRule.inputType === 'DERIVED' || depRule.inputType === 'SYSTEM_DERIVED')) {
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
    } else {
      value = evaluateFormula(r.formula, context);
    }
    if (r.percentage != null) value = (value * r.percentage) / 100;
    if (r.rounding) value = applyRounding(value, r.roundingType, r.roundOffValue);
    context[r.shortName] = value;
  }
  return context;
}
