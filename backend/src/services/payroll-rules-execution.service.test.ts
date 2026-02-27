/**
 * Unit tests for payroll rules execution service.
 * Mocks database (Prisma); covers active filtering, formula evaluation,
 * percentage, rounding, dependency ordering, circular deps, invalid formula, missing refs.
 */

import {
  parseFormulaDependencies,
  buildEvaluationOrder,
  evaluateFormula,
  applyRounding,
  getOrderedRulesForPaygroup,
  evaluatePayrollComponents,
  type RuleForExecution,
} from './payroll-rules-execution.service';

// Mock database layer
jest.mock('../utils/prisma', () => ({
  prisma: {
    compound: {
      findMany: jest.fn(),
    },
    paygroupComponentRule: {
      findMany: jest.fn(),
    },
  },
}));

const prisma = require('../utils/prisma').prisma as {
  compound: { findMany: jest.Mock };
  paygroupComponentRule: { findMany: jest.Mock };
};

const orgId = 'org-1';
const paygroupId = 'pg-1';

function rule(
  overrides: Partial<RuleForExecution> & { shortName: string; compoundId: string }
): RuleForExecution {
  return {
    compoundId: overrides.compoundId,
    shortName: overrides.shortName,
    longName: overrides.longName ?? overrides.shortName,
    category: overrides.category ?? 'EARNING',
    inputType: overrides.inputType ?? 'INPUT',
    componentBehavior: overrides.componentBehavior ?? 'DEFAULT',
    formula: overrides.formula ?? null,
    percentage: overrides.percentage ?? 100,
    rounding: overrides.rounding ?? false,
    roundingType: overrides.roundingType ?? null,
    roundOffValue: overrides.roundOffValue ?? null,
    order: overrides.order ?? 0,
  };
}

describe('payroll-rules-execution.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseFormulaDependencies', () => {
    it('returns empty array for null or empty formula', () => {
      expect(parseFormulaDependencies(null)).toEqual([]);
      expect(parseFormulaDependencies('')).toEqual([]);
      expect(parseFormulaDependencies('   ')).toEqual([]);
    });

    it('extracts single bracket reference', () => {
      expect(parseFormulaDependencies('[basic_pay]')).toEqual(['basic_pay']);
    });

    it('extracts multiple references and trims', () => {
      expect(parseFormulaDependencies('[basic_pay]+[pf]')).toEqual(['basic_pay', 'pf']);
      expect(parseFormulaDependencies('[ HRA ] * 0.4')).toEqual(['HRA']);
    });

    it('deduplicates references', () => {
      expect(parseFormulaDependencies('[x]+[x]')).toEqual(['x']);
    });
  });

  describe('evaluateFormula', () => {
    it('returns 0 for null or empty formula', () => {
      expect(evaluateFormula(null, {})).toBe(0);
      expect(evaluateFormula('', {})).toBe(0);
      expect(evaluateFormula('   ', {})).toBe(0);
    });

    it('replaces bracket tokens with context values and evaluates', () => {
      expect(evaluateFormula('[basic_pay]+[pf]', { basic_pay: 10000, pf: 1200 })).toBe(11200);
      expect(evaluateFormula('[a]*2 + [b]', { a: 5, b: 10 })).toBe(20);
      expect(evaluateFormula('([x]-[y])/2', { x: 100, y: 40 })).toBe(30);
    });

    it('returns 0 when expression contains disallowed characters', () => {
      expect(evaluateFormula('[a]; alert(1)', { a: 1 })).toBe(0);
      expect(evaluateFormula('require("fs")', {})).toBe(0);
    });

    it('returns 0 when evaluation throws', () => {
      expect(evaluateFormula('([invalid', {})).toBe(0);
    });

    it('treats missing context keys as undefined (replacement may leave [key])', () => {
      const expr = '[basic_pay]+[pf]';
      const result = evaluateFormula(expr, { basic_pay: 100 });
      expect(result).toBe(0);
    });
  });

  describe('applyRounding', () => {
    it('returns value unchanged when roundingType is null or unknown', () => {
      expect(applyRounding(123.7, null, 1)).toBe(123.7);
      expect(applyRounding(123.7, '', 1)).toBe(123.7);
      expect(applyRounding(123.7, 'NONE', 1)).toBe(123.7);
    });

    it('rounds to NEAREST step', () => {
      expect(applyRounding(123.4, 'NEAREST', 1)).toBe(123);
      expect(applyRounding(123.6, 'NEAREST', 1)).toBe(124);
      expect(applyRounding(125, 'NEAREST', 10)).toBe(130);
      expect(applyRounding(124, 'NEAREST', 10)).toBe(120);
    });

    it('rounds UP to step', () => {
      expect(applyRounding(123.1, 'UP', 1)).toBe(124);
      expect(applyRounding(123, 'UP', 1)).toBe(123);
      expect(applyRounding(121, 'UP', 10)).toBe(130);
    });

    it('rounds DOWN to step', () => {
      expect(applyRounding(123.9, 'DOWN', 1)).toBe(123);
      expect(applyRounding(129, 'DOWN', 10)).toBe(120);
    });

    it('uses step 1 when roundOffValue is null or <= 0', () => {
      expect(applyRounding(123.6, 'NEAREST', null)).toBe(124);
      expect(applyRounding(123.6, 'NEAREST', 0)).toBe(124);
    });
  });

  describe('buildEvaluationOrder', () => {
    it('returns INPUT rules first (by order), then derived in dependency order', () => {
      const basic = rule({ compoundId: 'c1', shortName: 'basic_pay', inputType: 'INPUT', order: 1 });
      const hra = rule({ compoundId: 'c2', shortName: 'hra', inputType: 'INPUT', order: 0 });
      const gross = rule({
        compoundId: 'c3',
        shortName: 'gross',
        inputType: 'DERIVED',
        formula: '[basic_pay]+[hra]',
        order: 2,
      });
      const list = [gross, basic, hra];
      const byShort = new Map(list.map((r) => [r.shortName, r]));
      const ordered = buildEvaluationOrder(list, byShort);
      const shortNames = ordered.map((r) => r.shortName);
      expect(shortNames).toContain('hra');
      expect(shortNames).toContain('basic_pay');
      expect(shortNames).toContain('gross');
      expect(shortNames.indexOf('hra')).toBeLessThan(shortNames.indexOf('gross'));
      expect(shortNames.indexOf('basic_pay')).toBeLessThan(shortNames.indexOf('gross'));
    });

    it('throws on circular dependency in formulas', () => {
      const a = rule({
        compoundId: 'c1',
        shortName: 'a',
        inputType: 'DERIVED',
        formula: '[c]',
        order: 0,
      });
      const b = rule({
        compoundId: 'c2',
        shortName: 'b',
        inputType: 'DERIVED',
        formula: '[a]',
        order: 1,
      });
      const c = rule({
        compoundId: 'c3',
        shortName: 'c',
        inputType: 'DERIVED',
        formula: '[b]',
        order: 2,
      });
      const list = [a, b, c];
      const byShort = new Map(list.map((r) => [r.shortName, r]));
      expect(() => buildEvaluationOrder(list, byShort)).toThrow(/Circular dependency/);
      expect(() => buildEvaluationOrder(list, byShort)).toThrow(/a|b|c/);
    });
  });

  describe('getOrderedRulesForPaygroup (with mocked DB)', () => {
    it('filters to ACTIVE compounds only', async () => {
      const activeCompound = {
        id: 'comp-1',
        shortName: 'basic_pay',
        longName: 'Basic Pay',
        componentType: 'EARNING',
        organizationId: orgId,
        status: 'ACTIVE',
      };
      const inactiveCompound = {
        id: 'comp-2',
        shortName: 'old_allowance',
        longName: 'Old Allowance',
        componentType: 'EARNING',
        organizationId: orgId,
        status: 'INACTIVE',
      };
      prisma.compound.findMany.mockResolvedValue([activeCompound, inactiveCompound]);
      prisma.paygroupComponentRule.findMany.mockResolvedValue([]);

      const result = await getOrderedRulesForPaygroup(orgId, paygroupId);

      expect(prisma.compound.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, componentType: { in: ['EARNING', 'DEDUCTION'] } },
        orderBy: [{ componentType: 'asc' }, { shortName: 'asc' }],
      });
      expect(result.map((r) => r.shortName)).toEqual(['basic_pay']);
      expect(result.find((r) => r.shortName === 'old_allowance')).toBeUndefined();
    });

    it('throws when derived formula references missing or inactive component', async () => {
      const comp1 = {
        id: 'comp-1',
        shortName: 'basic_pay',
        longName: 'Basic Pay',
        componentType: 'EARNING',
        organizationId: orgId,
        status: 'ACTIVE',
      };
      const comp2 = {
        id: 'comp-2',
        shortName: 'gross',
        longName: 'Gross',
        componentType: 'EARNING',
        organizationId: orgId,
        status: 'ACTIVE',
      };
      prisma.compound.findMany.mockResolvedValue([comp1, comp2]);
      prisma.paygroupComponentRule.findMany.mockResolvedValue([
        {
          compoundId: 'comp-1',
          paygroupId,
          organizationId: orgId,
          inputType: 'INPUT',
          componentBehavior: 'DEFAULT',
          formula: null,
          percentage: 100,
          rounding: false,
          roundingType: null,
          roundOffValue: null,
          order: 0,
          compound: comp1,
        },
        {
          compoundId: 'comp-2',
          paygroupId,
          organizationId: orgId,
          inputType: 'DERIVED',
          componentBehavior: 'DEFAULT',
          formula: '[basic_pay]+[nonexistent]',
          percentage: 100,
          rounding: false,
          roundingType: null,
          roundOffValue: null,
          order: 1,
          compound: comp2,
        },
      ]);

      await expect(getOrderedRulesForPaygroup(orgId, paygroupId)).rejects.toThrow(
        /references component "nonexistent" which is Inactive or not found/
      );
    });

    it('returns rules in evaluation order with merged rule data', async () => {
      const comp1 = {
        id: 'c1',
        shortName: 'basic_pay',
        longName: 'Basic Pay',
        componentType: 'EARNING',
        organizationId: orgId,
        status: 'ACTIVE',
      };
      const comp2 = {
        id: 'c2',
        shortName: 'pf',
        longName: 'Provident Fund',
        componentType: 'DEDUCTION',
        organizationId: orgId,
        status: 'ACTIVE',
      };
      prisma.compound.findMany.mockResolvedValue([comp1, comp2]);
      prisma.paygroupComponentRule.findMany.mockResolvedValue([
        {
          compoundId: 'c1',
          paygroupId,
          organizationId: orgId,
          inputType: 'INPUT',
          componentBehavior: 'DEFAULT',
          formula: null,
          percentage: 100,
          rounding: false,
          roundingType: null,
          roundOffValue: null,
          order: 0,
          compound: comp1,
        },
        {
          compoundId: 'c2',
          paygroupId,
          organizationId: orgId,
          inputType: 'DERIVED',
          componentBehavior: 'DEDUCTION',
          formula: '[basic_pay]*0.12',
          percentage: 100,
          rounding: true,
          roundingType: 'NEAREST',
          roundOffValue: 1,
          order: 1,
          compound: comp2,
        },
      ]);

      const result = await getOrderedRulesForPaygroup(orgId, paygroupId);

      expect(result).toHaveLength(2);
      const basicRule = result.find((r) => r.shortName === 'basic_pay');
      const pfRule = result.find((r) => r.shortName === 'pf');
      expect(basicRule?.inputType).toBe('INPUT');
      expect(pfRule?.inputType).toBe('DERIVED');
      expect(pfRule?.formula).toBe('[basic_pay]*0.12');
      expect(pfRule?.rounding).toBe(true);
      expect(pfRule?.roundingType).toBe('NEAREST');
      expect(pfRule?.roundOffValue).toBe(1);
      expect(result.indexOf(basicRule!)).toBeLessThan(result.indexOf(pfRule!));
    });
  });

  describe('evaluatePayrollComponents', () => {
    it('uses initial context for INPUT components and evaluates DERIVED formulas', () => {
      const ordered: RuleForExecution[] = [
        rule({ compoundId: 'c1', shortName: 'basic_pay', inputType: 'INPUT', order: 0 }),
        rule({
          compoundId: 'c2',
          shortName: 'gross',
          inputType: 'DERIVED',
          formula: '[basic_pay]*1.5',
          order: 1,
        }),
      ];
      const context = { basic_pay: 10000 };
      const out = evaluatePayrollComponents(ordered, context);
      expect(out.basic_pay).toBe(10000);
      expect(out.gross).toBe(15000);
    });

    it('applies percentage to component value', () => {
      const ordered: RuleForExecution[] = [
        rule({ compoundId: 'c1', shortName: 'basic_pay', inputType: 'INPUT', order: 0 }),
        rule({
          compoundId: 'c2',
          shortName: 'pf',
          inputType: 'DERIVED',
          formula: '[basic_pay]',
          percentage: 12,
          order: 1,
        }),
      ];
      const out = evaluatePayrollComponents(ordered, { basic_pay: 10000 });
      expect(out.pf).toBe(1200);
    });

    it('applies rounding when rounding is true', () => {
      const ordered: RuleForExecution[] = [
        rule({ compoundId: 'c1', shortName: 'basic_pay', inputType: 'INPUT', order: 0 }),
        rule({
          compoundId: 'c2',
          shortName: 'rounded',
          inputType: 'DERIVED',
          formula: '[basic_pay]',
          percentage: 100,
          rounding: true,
          roundingType: 'NEAREST',
          roundOffValue: 10,
          order: 1,
        }),
      ];
      const out = evaluatePayrollComponents(ordered, { basic_pay: 1234 });
      expect(out.rounded).toBe(1230);
    });

    it('evaluates in order so derived components see prior values', () => {
      const ordered: RuleForExecution[] = [
        rule({ compoundId: 'c1', shortName: 'a', inputType: 'INPUT', order: 0 }),
        rule({
          compoundId: 'c2',
          shortName: 'b',
          inputType: 'DERIVED',
          formula: '[a]*2',
          order: 1,
        }),
        rule({
          compoundId: 'c3',
          shortName: 'c',
          inputType: 'DERIVED',
          formula: '[a]+[b]',
          order: 2,
        }),
      ];
      const out = evaluatePayrollComponents(ordered, { a: 10 });
      expect(out.a).toBe(10);
      expect(out.b).toBe(20);
      expect(out.c).toBe(30);
    });

    it('treats missing INPUT in context as 0', () => {
      const ordered: RuleForExecution[] = [
        rule({ compoundId: 'c1', shortName: 'x', inputType: 'INPUT', order: 0 }),
      ];
      const out = evaluatePayrollComponents(ordered, {});
      expect(out.x).toBe(0);
    });

    it('Gross Driven Payroll: FIXED_GROSS input → basic_pay, hra, other_allowance derived; total equals FIXED_GROSS', () => {
      const ordered: RuleForExecution[] = [
        rule({ compoundId: 'c0', shortName: 'FIXED_GROSS', inputType: 'INPUT', order: 0 }),
        rule({
          compoundId: 'c1',
          shortName: 'basic_pay',
          inputType: 'DERIVED',
          formula: '[FIXED_GROSS] * 50 / 100',
          order: 1,
        }),
        rule({
          compoundId: 'c2',
          shortName: 'hra',
          inputType: 'DERIVED',
          formula: '[basic_pay] * 40 / 100',
          order: 2,
        }),
        rule({
          compoundId: 'c3',
          shortName: 'other_allowance',
          inputType: 'DERIVED',
          formula: '[FIXED_GROSS] - ([basic_pay] + [hra])',
          order: 3,
        }),
      ];
      const initialContext = { FIXED_GROSS: 18000 };
      const out = evaluatePayrollComponents(ordered, initialContext);

      expect(out.FIXED_GROSS).toBe(18000);
      expect(out.basic_pay).toBe(9000);
      expect(out.hra).toBe(3600);
      expect(out.other_allowance).toBe(5400);

      const total = out.basic_pay + out.hra + out.other_allowance;
      expect(total).toBe(out.FIXED_GROSS);
      expect(total).toBe(18000);
    });
  });
});
