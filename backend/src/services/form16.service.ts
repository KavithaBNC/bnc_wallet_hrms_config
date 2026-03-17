import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';

/**
 * Form 16 Service
 *
 * Aggregates annual tax data (Part A + Part B) for each employee
 * covering a full financial year (April–March).
 *
 * Part A: TDS deducted and deposited by employer (government data)
 * Part B: Gross salary, exemptions, deductions, net taxable income
 *
 * NOTE: This generates the raw data structure required to produce Form 16.
 * PDF rendering is handled separately by pdf.service.ts.
 */

export interface Form16PartA {
  /** Monthly TDS deposits */
  quarterlyDeposits: Array<{
    quarter: string;  // e.g. "Q1 (Apr-Jun)"
    months: Array<{ month: number; year: number; tdsDeposited: number }>;
    quarterTotal: number;
  }>;
  totalTdsDeposited: number;
}

export interface Form16PartB {
  grossSalary: number;
  /** HRA exemption claimed (Sec 10(13A)) */
  hraExemption: number;
  /** Other exemptions under Sec 10 (LTA, gratuity, etc.) */
  otherExemptions: number;
  netSalaryAfterExemptions: number;
  /** Standard deduction ₹50,000 (Old) or ₹75,000 (New) */
  standardDeduction: number;
  professionalTaxPaid: number;
  grossTotalIncome: number;
  /** 80C deductions (PF, LIC, etc.) */
  deduction80C: number;
  /** 80D deductions (medical insurance) */
  deduction80D: number;
  /** 80CCD deductions (NPS) */
  deduction80CCD: number;
  totalDeductionsUnderChapterVIA: number;
  taxableIncome: number;
  taxOnIncome: number;
  surcharge: number;
  healthAndEducationCess: number;
  totalTaxLiability: number;
  tdsDeducted: number;
  taxPayable: number;  // positive = payable, negative = refund due
}

export interface Form16Data {
  financialYear: string;
  assessmentYear: string;
  employee: {
    id: string;
    employeeCode: string;
    name: string;
    panNumber: string;
    taxRegime: string;
    designation?: string;
    department?: string;
  };
  organization: {
    id: string;
    name: string;
    // TAN is stored in org settings, not enforced here
  };
  partA: Form16PartA;
  partB: Form16PartB;
  generatedAt: Date;
}

export class Form16Service {
  /**
   * Generate Form 16 data for all employees in a financial year.
   *
   * @param organizationId Organization context
   * @param financialYear  e.g. "2025-26"
   * @param employeeId     Optional — filter for a single employee
   */
  async generate(
    organizationId: string,
    financialYear: string,
    employeeId?: string
  ): Promise<Form16Data[]> {
    const [startYearStr] = financialYear.split('-');
    const startYear = parseInt(startYearStr);
    if (isNaN(startYear)) {
      throw new AppError('Invalid financial year format. Expected YYYY-YY (e.g. 2025-26)', 400);
    }
    const endYear = startYear + 1;

    // FY: April 1 of startYear → March 31 of endYear
    const fyStart = new Date(`${startYear}-04-01`);
    const fyEnd = new Date(`${endYear}-03-31`);

    const cycles = await prisma.payrollCycle.findMany({
      where: {
        organizationId,
        periodStart: { gte: fyStart },
        periodEnd: { lte: fyEnd },
        status: { in: ['PROCESSED', 'FINALIZED', 'PAID'] },
      },
      orderBy: [{ payrollYear: 'asc' }, { payrollMonth: 'asc' }],
      select: { id: true, payrollMonth: true, payrollYear: true },
    });

    if (cycles.length === 0) {
      return [];
    }

    const cycleIds = cycles.map(c => c.id);

    const payslips = await prisma.payslip.findMany({
      where: {
        payrollCycleId: { in: cycleIds },
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            taxInformation: true,
            department: { select: { name: true } },
            position: { select: { title: true } },
          },
        },
      },
    });

    // Group payslips by employee
    const empMap = new Map<string, any[]>();
    for (const ps of payslips as any[]) {
      const key = ps.employee.id;
      if (!empMap.has(key)) empMap.set(key, []);
      empMap.get(key)!.push(ps);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!organization) throw new AppError('Organization not found', 404);

    const results: Form16Data[] = [];

    for (const [, employeePayslips] of empMap) {
      const emp = employeePayslips[0].employee;
      const taxInfo = (emp.taxInformation as any) || {};

      // Build monthly data
      let totalGross = 0;
      let totalStandardDeduction = 0;
      let totalPT = 0;
      let totalHraExemption = 0;
      let totalOtherExemptions = 0;
      let total80C = 0;
      let total80D = 0;
      let total80CCD = 0;
      let totalTaxableIncome = 0;
      let totalTax = 0;
      let totalSurcharge = 0;
      let totalCess = 0;
      let totalTdsDeducted = 0;

      // Quarter → month → TDS
      const quarterMap: Record<string, Array<{ month: number; year: number; tdsDeposited: number }>> = {
        'Q1 (Apr-Jun)': [],
        'Q2 (Jul-Sep)': [],
        'Q3 (Oct-Dec)': [],
        'Q4 (Jan-Mar)': [],
      };

      for (const ps of employeePayslips) {
        const cycle = cycles.find(c => c.id === ps.payrollCycleId);
        if (!cycle) continue;

        const tax = (ps.taxDetails as any) || {};
        const statutory = (ps.statutoryDeductions as any) || {};

        const gross = Number(ps.grossSalary);
        const incomeTax = Number(tax.incomeTax ?? 0);
        const surcharge = Number(tax.surcharge ?? 0);
        const cess = Number(tax.cess ?? 0);
        const tds = incomeTax + surcharge + cess;
        const pt = Number(statutory.professionalTax ?? 0);

        // Extract declared deductions from tax.deductions (80C, 80D, 80CCD)
        const d80C = Number(tax.deductions?.section80C ?? 0);
        const d80D = Number(tax.deductions?.section80D ?? 0);
        const d80CCD = Number(tax.deductions?.section80CCD ?? 0);

        // Standard deduction per regime
        const regime = taxInfo.taxRegime || 'NEW';
        const stdDed = regime === 'OLD' ? 50000 / 12 : 75000 / 12;

        totalGross += gross;
        totalStandardDeduction += stdDed;
        totalPT += pt;
        total80C += d80C;
        total80D += d80D;
        total80CCD += d80CCD;
        totalTax += incomeTax;
        totalSurcharge += surcharge;
        totalCess += cess;
        totalTdsDeducted += tds;

        // Annualized taxable income from taxDetails
        totalTaxableIncome += Number(tax.taxableIncome ?? 0) / 12;

        // Assign to quarter
        const m = cycle.payrollMonth;
        const y = cycle.payrollYear;
        let qKey: string;
        if (m >= 4 && m <= 6) qKey = 'Q1 (Apr-Jun)';
        else if (m >= 7 && m <= 9) qKey = 'Q2 (Jul-Sep)';
        else if (m >= 10 && m <= 12) qKey = 'Q3 (Oct-Dec)';
        else qKey = 'Q4 (Jan-Mar)';

        quarterMap[qKey].push({ month: m, year: y, tdsDeposited: tds });
      }

      // Build Part A: quarterly deposits
      const quarterlyDeposits = Object.entries(quarterMap)
        .filter(([, months]) => months.length > 0)
        .map(([quarter, months]) => ({
          quarter,
          months,
          quarterTotal: months.reduce((s, m) => s + m.tdsDeposited, 0),
        }));

      // Annualize standard deduction (already summed monthly above)
      const annualStdDed = Math.round(totalStandardDeduction);
      const annualPT = Math.round(totalPT);
      const annualTaxableIncome = Math.round(totalTaxableIncome);
      const annualGross = Math.round(totalGross);

      const partA: Form16PartA = {
        quarterlyDeposits,
        totalTdsDeposited: Math.round(totalTdsDeducted * 100) / 100,
      };

      const partB: Form16PartB = {
        grossSalary: annualGross,
        hraExemption: Math.round(totalHraExemption),
        otherExemptions: Math.round(totalOtherExemptions),
        netSalaryAfterExemptions: annualGross - Math.round(totalHraExemption) - Math.round(totalOtherExemptions),
        standardDeduction: annualStdDed,
        professionalTaxPaid: annualPT,
        grossTotalIncome: Math.max(0, annualGross - Math.round(totalHraExemption) - Math.round(totalOtherExemptions) - annualStdDed - annualPT),
        deduction80C: Math.round(total80C),
        deduction80D: Math.round(total80D),
        deduction80CCD: Math.round(total80CCD),
        totalDeductionsUnderChapterVIA: Math.round(total80C + total80D + total80CCD),
        taxableIncome: annualTaxableIncome,
        taxOnIncome: Math.round(totalTax),
        surcharge: Math.round(totalSurcharge),
        healthAndEducationCess: Math.round(totalCess),
        totalTaxLiability: Math.round(totalTax + totalSurcharge + totalCess),
        tdsDeducted: Math.round(totalTdsDeducted),
        taxPayable: Math.round(totalTax + totalSurcharge + totalCess - totalTdsDeducted),
      };

      results.push({
        financialYear,
        assessmentYear: `${endYear}-${String(endYear + 1).slice(2)}`,
        employee: {
          id: emp.id,
          employeeCode: emp.employeeCode,
          name: `${emp.firstName} ${emp.lastName}`,
          panNumber: taxInfo.panNumber || 'NOT PROVIDED',
          taxRegime: taxInfo.taxRegime || 'NEW',
          designation: (emp as any).position?.title,
          department: emp.department?.name,
        },
        organization: {
          id: organization.id,
          name: organization.name,
        },
        partA,
        partB,
        generatedAt: new Date(),
      });
    }

    return results;
  }
}

export const form16Service = new Form16Service();
