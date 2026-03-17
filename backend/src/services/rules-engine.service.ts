import { prisma } from '../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { parseFormulaDependencies, parseConditionalDependencies } from './payroll-rules-execution.service';

export const INPUT_TYPES = ['Input', 'Derived', 'System Derived', 'Conditional'] as const;
export const COMPONENT_BEHAVIORS = ['Default', 'Variable Input', 'Reimbursement', 'Deduction', 'Employer Contribution', 'System'] as const;

const INPUT_TYPE_DB = { 'Input': 'INPUT', 'Derived': 'DERIVED', 'System Derived': 'SYSTEM_DERIVED', 'Conditional': 'CONDITIONAL' } as const;
const BEHAVIOR_DB = {
  'Default': 'DEFAULT',
  'Variable Input': 'VARIABLE_INPUT',
  'Reimbursement': 'REIMBURSEMENT',
  'Deduction': 'DEDUCTION',
  'Employer Contribution': 'EMPLOYER_CONTRIBUTION',
  'System': 'SYSTEM',
} as const;

export interface RulesEngineRowDto {
  ruleId: string | null;
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

export interface SaveRuleItem {
  compoundId: string;
  inputType: string;
  componentBehavior: string;
  formula: string | null;
  percentage: number | null;
  rounding: boolean;
  roundingType: string | null;
  roundOffValue: number | null;
  order: number;
}

function toDto(
  compound: { id: string; shortName: string; longName: string; componentType: string },
  rule: {
    id: string;
    inputType: string;
    componentBehavior: string;
    formula: string | null;
    percentage: Decimal | null;
    rounding: boolean;
    roundingType: string | null;
    roundOffValue: Decimal | null;
    order: number;
  } | null
): RulesEngineRowDto {
  const inputTypeMap: Record<string, string> = {
    INPUT: 'Input',
    DERIVED: 'Derived',
    SYSTEM_DERIVED: 'System Derived',
    CONDITIONAL: 'Conditional',
  };
  const behaviorMap: Record<string, string> = {
    DEFAULT: 'Default',
    VARIABLE_INPUT: 'Variable Input',
    REIMBURSEMENT: 'Reimbursement',
    DEDUCTION: 'Deduction',
    EMPLOYER_CONTRIBUTION: 'Employer Contribution',
    SYSTEM: 'System',
  };
  return {
    ruleId: rule?.id ?? null,
    compoundId: compound.id,
    shortName: compound.shortName,
    longName: compound.longName,
    category: compound.componentType,
    inputType: rule ? inputTypeMap[rule.inputType] ?? rule.inputType : 'Input',
    componentBehavior: rule ? behaviorMap[rule.componentBehavior] ?? rule.componentBehavior : 'Default',
    formula: rule?.formula ?? null,
    percentage: rule?.percentage != null ? Number(rule.percentage) : 100,
    rounding: rule?.rounding ?? false,
    roundingType: rule?.roundingType ?? null,
    roundOffValue: rule?.roundOffValue != null ? Number(rule.roundOffValue) : null,
    order: rule?.order ?? 0,
  };
}

export class RulesEngineService {
  async getRulesForPaygroup(organizationId: string, paygroupId: string): Promise<RulesEngineRowDto[]> {
    const paygroup = await prisma.paygroup.findFirst({
      where: { id: paygroupId, organizationId },
    });
    if (!paygroup) {
      throw new Error('Paygroup not found');
    }

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
    });
    const ruleByCompoundId = new Map(rules.map((r) => [r.compoundId, r]));

    return compounds.map((c) => toDto(c, ruleByCompoundId.get(c.id) ?? null));
  }

  async saveRules(organizationId: string, paygroupId: string, rules: SaveRuleItem[]): Promise<{ saved: number }> {
    const paygroup = await prisma.paygroup.findFirst({
      where: { id: paygroupId, organizationId },
    });
    if (!paygroup) {
      throw new Error('Paygroup not found');
    }

    const compounds = await prisma.compound.findMany({
      where: { organizationId },
      select: { id: true, shortName: true },
    });
    const validCompoundIds = new Set(compounds.map((c) => c.id));
    let statusByShortName = new Map<string, string | null>();
    try {
      const statusRows = await prisma.$queryRaw<{ short_name: string; status: string | null }[]>`
        SELECT short_name, status FROM compounds WHERE organization_id = ${organizationId}
      `;
      statusByShortName = new Map(statusRows.map((row) => [row.short_name.toLowerCase(), row.status]));
    } catch {
      // status column may not exist yet (migration not run); skip inactive check
    }

    for (const r of rules) {
      if (!validCompoundIds.has(r.compoundId)) continue;
      const inputTypeDb = INPUT_TYPE_DB[r.inputType as keyof typeof INPUT_TYPE_DB] ?? 'INPUT';
      if (inputTypeDb === 'DERIVED' || inputTypeDb === 'SYSTEM_DERIVED') {
        const formula = r.formula?.trim() || null;
        if (formula) {
          const deps = parseFormulaDependencies(formula);
          const shortNameLower = (s: string) => s.trim().toLowerCase();
          for (const ref of deps) {
            const comp = compounds.find((c) => shortNameLower(c.shortName) === shortNameLower(ref));
            if (!comp) {
              const err = new Error(`Derived formula references component "${ref}" which does not exist.`) as Error & { status?: number };
              err.status = 400;
              throw err;
            }
            const compStatus = statusByShortName.get(shortNameLower(ref));
            if (compStatus != null && String(compStatus).toUpperCase() !== 'ACTIVE') {
              const err = new Error(`Derived formula references component "${ref}" which is Inactive. Only Active components may be used in formulas.`) as Error & { status?: number };
              err.status = 400;
              throw err;
            }
          }
        }
      }

      if (inputTypeDb === 'CONDITIONAL') {
        const formula = r.formula?.trim() || null;
        if (!formula) {
          const err = new Error('Conditional rule must have at least one condition.') as Error & { status?: number };
          err.status = 400;
          throw err;
        }
        let parsed: { type: string; condition: string; then: string }[];
        try {
          parsed = JSON.parse(formula);
        } catch {
          const err = new Error('Invalid conditional formula format.') as Error & { status?: number };
          err.status = 400;
          throw err;
        }
        if (!Array.isArray(parsed) || parsed.length === 0) {
          const err = new Error('Conditional rule must have at least one condition.') as Error & { status?: number };
          err.status = 400;
          throw err;
        }
        const elseRows = parsed.filter((row) => row.type === 'ELSE');
        if (elseRows.length > 1) {
          const err = new Error('Only one ELSE row is allowed in a conditional rule.') as Error & { status?: number };
          err.status = 400;
          throw err;
        }
        if (elseRows.length === 1 && parsed[parsed.length - 1].type !== 'ELSE') {
          const err = new Error('ELSE must be the last row in a conditional rule.') as Error & { status?: number };
          err.status = 400;
          throw err;
        }
        for (const row of parsed) {
          if (row.type === 'IF' && !row.condition?.trim()) {
            const err = new Error('IF rows must have a condition expression.') as Error & { status?: number };
            err.status = 400;
            throw err;
          }
          if (!row.then?.trim()) {
            const err = new Error('Every conditional row must have a Then expression.') as Error & { status?: number };
            err.status = 400;
            throw err;
          }
        }
        // Validate component references in conditional expressions
        const knownShortNames = new Set(compounds.map((c) => c.shortName));
        const deps = parseConditionalDependencies(formula, knownShortNames);
        const shortNameLower = (s: string) => s.trim().toLowerCase();
        for (const ref of deps) {
          const comp = compounds.find((c) => shortNameLower(c.shortName) === shortNameLower(ref));
          if (!comp) continue; // bare identifier that isn't a component — safe to skip
          const compStatus = statusByShortName.get(shortNameLower(ref));
          if (compStatus != null && String(compStatus).toUpperCase() !== 'ACTIVE') {
            const err = new Error(`Conditional formula references component "${ref}" which is Inactive. Only Active components may be used.`) as Error & { status?: number };
            err.status = 400;
            throw err;
          }
        }
      }
    }

    let saved = 0;
    for (const r of rules) {
      if (!validCompoundIds.has(r.compoundId)) continue;
      const inputTypeDb = INPUT_TYPE_DB[r.inputType as keyof typeof INPUT_TYPE_DB] ?? 'INPUT';
      const behaviorDb = BEHAVIOR_DB[r.componentBehavior as keyof typeof BEHAVIOR_DB] ?? 'DEFAULT';
      const formula = inputTypeDb === 'INPUT' ? null : (r.formula?.trim() || null);
      // For CONDITIONAL type, formula stores JSON array of conditions — skip dependency validation
      const percentage = r.percentage != null ? new Decimal(r.percentage) : null;
      const roundOffValue = r.roundOffValue != null ? new Decimal(r.roundOffValue) : null;

      await prisma.paygroupComponentRule.upsert({
        where: {
          paygroupId_compoundId: { paygroupId, compoundId: r.compoundId },
        },
        create: {
          organizationId,
          paygroupId,
          compoundId: r.compoundId,
          inputType: inputTypeDb,
          componentBehavior: behaviorDb,
          formula,
          percentage,
          rounding: r.rounding,
          roundingType: r.roundingType?.trim() || null,
          roundOffValue,
          order: r.order ?? 0,
        },
        update: {
          inputType: inputTypeDb,
          componentBehavior: behaviorDb,
          formula,
          percentage,
          rounding: r.rounding,
          roundingType: r.roundingType?.trim() || null,
          roundOffValue,
          order: r.order ?? 0,
        },
      });
      saved++;
    }
    return { saved };
  }
}

export const rulesEngineService = new RulesEngineService();
