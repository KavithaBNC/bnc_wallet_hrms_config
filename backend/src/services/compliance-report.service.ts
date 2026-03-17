import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { decryptField } from '../utils/crypto-utils';

/**
 * Compliance Report Service
 *
 * Generates statutory and operational reports:
 * - Payroll Register (monthly summary of all employees)
 * - PF ECR (Electronic Challan-cum-Return for EPFO)
 * - Salary Register (department/paygroup grouped view)
 * - Bank Advice (salary transfer file)
 * - F&F Settlement Statement
 */

export class ComplianceReportService {
  /**
   * Generate Payroll Register for a payroll cycle
   *
   * Returns all employees with earnings/deductions breakdown
   */
  async getPayrollRegister(cycleId: string, organizationId: string) {
    const cycle = await prisma.payrollCycle.findUnique({
      where: { id: cycleId },
      select: {
        id: true,
        name: true,
        payrollMonth: true,
        payrollYear: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        organizationId: true,
        totalEmployees: true,
        totalGross: true,
        totalDeductions: true,
        totalNet: true,
      },
    });

    if (!cycle) throw new AppError('Payroll cycle not found', 404);
    if (cycle.organizationId !== organizationId) {
      throw new AppError('Payroll cycle does not belong to this organization', 400);
    }

    const payslips = await prisma.payslip.findMany({
      where: { payrollCycleId: cycleId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            paygroup: { select: { name: true } },
          },
        },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });

    const rows = payslips.map((payslip) => {
      const earnings = (payslip.earnings as any[]) || [];
      const deductions = (payslip.deductions as any[]) || [];
      const statutory = (payslip.statutoryDeductions as any) || {};
      const tax = (payslip.taxDetails as any) || {};

      return {
        employeeCode: payslip.employee.employeeCode,
        employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
        department: payslip.employee.department?.name || '',
        paygroup: payslip.employee.paygroup?.name || '',
        basicSalary: Number(payslip.basicSalary || 0),
        earnings: earnings.map((e: any) => ({ component: e.component, amount: e.amount })),
        grossSalary: Number(payslip.grossSalary),
        deductions: deductions.map((d: any) => ({ component: d.component, amount: d.amount })),
        pf: statutory.pf || 0,
        esi: statutory.esi || 0,
        professionalTax: statutory.professionalTax || 0,
        incomeTax: tax.incomeTax || 0,
        employerPf: (statutory.employerEpf || 0) + (statutory.employerEps || 0),
        employerEsi: statutory.employerEsi || 0,
        totalDeductions: Number(payslip.totalDeductions || 0),
        netSalary: Number(payslip.netSalary),
        paidDays: Number(payslip.paidDays || 0),
        attendanceDays: Number(payslip.attendanceDays || 0),
      };
    });

    // Compute totals
    const totals = rows.reduce(
      (acc, r) => ({
        grossSalary: acc.grossSalary + r.grossSalary,
        pf: acc.pf + r.pf,
        esi: acc.esi + r.esi,
        professionalTax: acc.professionalTax + r.professionalTax,
        incomeTax: acc.incomeTax + r.incomeTax,
        employerPf: acc.employerPf + r.employerPf,
        employerEsi: acc.employerEsi + r.employerEsi,
        totalDeductions: acc.totalDeductions + r.totalDeductions,
        netSalary: acc.netSalary + r.netSalary,
      }),
      {
        grossSalary: 0, pf: 0, esi: 0, professionalTax: 0,
        incomeTax: 0, employerPf: 0, employerEsi: 0,
        totalDeductions: 0, netSalary: 0,
      }
    );

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        month: cycle.payrollMonth,
        year: cycle.payrollYear,
        periodStart: cycle.periodStart,
        periodEnd: cycle.periodEnd,
        status: cycle.status,
      },
      employees: rows,
      totals,
      employeeCount: rows.length,
    };
  }

  /**
   * Generate PF ECR (Electronic Challan-cum-Return)
   *
   * EPFO mandated pipe-separated format:
   * UAN|Member Name|Gross Wages|EPF Wages|EPS Wages|EDLI Wages|EPF (EE)|EPS (ER)|EPF (ER)|NCP Days|Refund
   */
  async getPfEcr(
    organizationId: string,
    year: number,
    month: number
  ): Promise<{ headers: string[]; rows: string[][]; csvContent: string; employees: any[] }> {
    // Find the payroll cycle for this month/year
    const cycle = await prisma.payrollCycle.findFirst({
      where: {
        organizationId,
        payrollYear: year,
        payrollMonth: month,
        status: { in: ['PROCESSED', 'FINALIZED', 'PAID'] },
      },
    });

    if (!cycle) {
      const headers = [
        'UAN', 'Member Name', 'Gross Wages', 'EPF Wages', 'EPS Wages', 'EDLI Wages',
        'EPF Contribution (EE)', 'EPS Contribution (ER)', 'EPF Contribution (ER)',
        'NCP Days', 'Refund of Advances',
      ];
      return { headers, rows: [], csvContent: headers.join('|'), employees: [] };
    }

    const payslips = await prisma.payslip.findMany({
      where: { payrollCycleId: cycle.id },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            taxInformation: true,
          },
        },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });

    const headers = [
      'UAN', 'Member Name', 'Gross Wages', 'EPF Wages', 'EPS Wages', 'EDLI Wages',
      'EPF Contribution (EE)', 'EPS Contribution (ER)', 'EPF Contribution (ER)',
      'NCP Days', 'Refund of Advances',
    ];

    const rows = payslips.map((payslip: any) => {
      const statutory = (payslip.statutoryDeductions as any) || {};
      const taxInfo = (payslip.employee?.taxInformation as any) || {};
      const uan = taxInfo.uan || taxInfo.UAN || '';
      const basicSalary = Number(payslip.basicSalary || 0);
      const pfWage = Math.min(basicSalary, 15000);
      const grossWages = Number(payslip.grossSalary);

      // NCP (Non-contributing period) days = absent/unpaid days
      const totalDays = 30; // Standard month
      const paidDays = Number(payslip.paidDays || totalDays);
      const ncpDays = Math.max(0, totalDays - paidDays);

      return [
        uan,
        `${payslip.employee?.firstName || ''} ${payslip.employee?.lastName || ''}`,
        grossWages.toFixed(0),
        pfWage.toFixed(0),
        pfWage.toFixed(0), // EPS wages = PF wage
        pfWage.toFixed(0), // EDLI wages = PF wage
        (statutory.pf || 0).toFixed(0),
        (statutory.employerEps || 0).toFixed(0),
        (statutory.employerEpf || 0).toFixed(0),
        ncpDays.toFixed(0),
        '0', // Refund of advances
      ];
    });

    // Generate pipe-separated CSV
    const csvContent = [
      headers.join('|'),
      ...rows.map((r) => r.join('|')),
    ].join('\n');

    const employees = payslips.map((payslip: any) => {
      const statutory = (payslip.statutoryDeductions as any) || {};
      const taxInfo = (payslip.employee?.taxInformation as any) || {};
      const basicSalary = Number(payslip.basicSalary || 0);
      const pfWage = Math.min(basicSalary, 15000);
      return {
        employeeCode: payslip.employee?.employeeCode || '',
        employeeName: `${payslip.employee?.firstName || ''} ${payslip.employee?.lastName || ''}`.trim(),
        uan: taxInfo.uan || taxInfo.UAN || '',
        epfWages: pfWage,
        employeeEpf: Number(statutory.pf || 0),
        eps: Number(statutory.employerEps || 0),
        employerEpf: Number(statutory.employerEpf || 0),
      };
    });

    return { headers, rows, csvContent, employees };
  }

  /**
   * Generate Salary Register grouped by department/paygroup
   */
  async getSalaryRegister(cycleId: string, organizationId: string, groupBy: 'department' | 'paygroup' = 'department') {
    const register = await this.getPayrollRegister(cycleId, organizationId);

    // Group by selected field
    const groups: Record<string, typeof register.employees> = {};
    for (const emp of register.employees) {
      const key = groupBy === 'department' ? (emp.department || 'Unassigned') : (emp.paygroup || 'Unassigned');
      if (!groups[key]) groups[key] = [];
      groups[key].push(emp);
    }

    // Calculate subtotals per group
    const groupedData = Object.entries(groups).map(([name, employees]) => {
      const subtotal = employees.reduce(
        (acc, r) => ({
          grossSalary: acc.grossSalary + r.grossSalary,
          pf: acc.pf + r.pf,
          esi: acc.esi + r.esi,
          professionalTax: acc.professionalTax + r.professionalTax,
          incomeTax: acc.incomeTax + r.incomeTax,
          totalDeductions: acc.totalDeductions + r.totalDeductions,
          netSalary: acc.netSalary + r.netSalary,
        }),
        {
          grossSalary: 0, pf: 0, esi: 0, professionalTax: 0,
          incomeTax: 0, totalDeductions: 0, netSalary: 0,
        }
      );
      return { groupName: name, employees, subtotal, count: employees.length };
    });

    return {
      cycle: register.cycle,
      groupBy,
      groups: groupedData,
      totals: register.totals,
      employeeCount: register.employeeCount,
    };
  }

  /**
   * Generate Bank Advice file for salary transfer
   *
   * Format: Employee Name|Bank Account No|IFSC Code|Amount|Narration
   */
  async getBankAdvice(cycleId: string, organizationId: string) {
    const cycle = await prisma.payrollCycle.findUnique({
      where: { id: cycleId },
      select: {
        id: true, name: true, payrollMonth: true, payrollYear: true,
        organizationId: true, status: true,
      },
    });

    if (!cycle) throw new AppError('Payroll cycle not found', 404);
    if (cycle.organizationId !== organizationId) {
      throw new AppError('Payroll cycle does not belong to this organization', 400);
    }

    const payslips = await prisma.payslip.findMany({
      where: { payrollCycleId: cycleId },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            bankAccounts: {
              where: { isPrimary: true },
              take: 1,
              select: {
                accountNumber: true,
                routingNumber: true,
                bankName: true,
              },
            },
          },
        },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });

    const headers = ['Employee Code', 'Employee Name', 'Bank Name', 'Account Number', 'IFSC/Routing No', 'Net Amount (INR)', 'Narration', 'Status'];

    // CSV escape helper — wraps field in quotes if it contains comma, quote, or newline
    const csvEscape = (value: string | number): string => {
      const s = String(value ?? '');
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const missingBankWarnings: string[] = [];

    const rows = payslips.map((payslip: any) => {
      const bank = payslip.employee?.bankAccounts?.[0];
      const empCode = payslip.employee?.employeeCode || '';
      const empName = `${payslip.employee?.firstName || ''} ${payslip.employee?.lastName || ''}`.trim();
      const narration = `SALARY ${cycle.payrollMonth}/${cycle.payrollYear} ${empCode}`;
      const hasBankAccount = !!(bank?.accountNumber && bank?.bankName);

      if (!hasBankAccount) {
        missingBankWarnings.push(`${empCode} (${empName}) — no primary bank account`);
      }

      // Decrypt account number before including in the transfer file
      const decryptedAccountNumber = bank?.accountNumber
        ? (decryptField(bank.accountNumber) || bank.accountNumber)
        : '';

      return {
        employeeCode: empCode,
        employeeName: empName,
        bankName: bank?.bankName || '',
        accountNumber: decryptedAccountNumber,
        routingNumber: bank?.routingNumber || '',
        amount: Number(payslip.netSalary),
        narration,
        status: hasBankAccount ? 'READY' : 'MISSING_BANK_ACCOUNT',
      };
    });

    const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
    const readyCount = rows.filter((r) => r.status === 'READY').length;

    // Generate comma-separated CSV suitable for bank portal upload
    const csvLines: string[] = [
      headers.map(csvEscape).join(','),
      ...rows.map((r) =>
        [
          r.employeeCode, r.employeeName, r.bankName,
          r.accountNumber, r.routingNumber, r.amount.toFixed(2), r.narration, r.status,
        ].map(csvEscape).join(','),
      ),
      // Summary row
      ['TOTAL', `${readyCount} of ${rows.length} employees`, '', '', '', totalAmount.toFixed(2), `${cycle.payrollMonth}/${cycle.payrollYear}`, ''].map(csvEscape).join(','),
    ];

    const csvContent = csvLines.join('\r\n');
    const fileName = `BankAdvice_${cycle.name.replace(/\s+/g, '_')}_${cycle.payrollMonth}_${cycle.payrollYear}.csv`;

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        month: cycle.payrollMonth,
        year: cycle.payrollYear,
      },
      rows,
      csvContent,
      fileName,
      totalAmount,
      employeeCount: rows.length,
      readyCount,
      missingBankWarnings,
    };
  }

  /**
   * Generate F&F Settlement Statement data for PDF generation
   */
  async getFnfStatement(settlementId: string, organizationId: string) {
    const settlement = await prisma.fnfSettlement.findUnique({
      where: { id: settlementId },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            dateOfJoining: true,
            department: { select: { name: true } },
            paygroup: { select: { name: true } },
          },
        },
        separation: {
          select: {
            separationType: true,
            resignationApplyDate: true,
            relievingDate: true,
            noticePeriod: true,
            noticePeriodReason: true,
            reasonOfLeaving: true,
          },
        },
        organization: {
          select: {
            name: true,
            legalName: true,
            address: true,
          },
        },
      },
    });

    if (!settlement) throw new AppError('Settlement not found', 404);
    if (settlement.organizationId !== organizationId) {
      throw new AppError('Settlement does not belong to this organization', 400);
    }

    return {
      organization: {
        name: settlement.organization.legalName || settlement.organization.name,
        address: settlement.organization.address,
      },
      employee: {
        code: settlement.employee.employeeCode,
        name: `${settlement.employee.firstName} ${settlement.employee.lastName}`,
        department: settlement.employee.department?.name || '',
        paygroup: settlement.employee.paygroup?.name || '',
        dateOfJoining: settlement.employee.dateOfJoining,
        lastWorkingDate: settlement.lastWorkingDate,
        yearsOfService: Number(settlement.yearsOfService),
      },
      separation: {
        type: settlement.separation.separationType,
        resignationDate: settlement.separation.resignationApplyDate,
        relievingDate: settlement.separation.relievingDate,
        reason: settlement.separation.reasonOfLeaving,
      },
      earnings: {
        finalMonthSalary: {
          gross: Number(settlement.finalMonthGross),
          deductions: Number(settlement.finalMonthDeductions),
          net: Number(settlement.finalMonthNet),
        },
        leaveEncashment: {
          days: Number(settlement.encashableLeaveDays),
          amount: Number(settlement.leaveEncashmentAmount),
        },
        gratuity: {
          eligible: settlement.gratuityEligible,
          years: Number(settlement.yearsOfService),
          amount: Number(settlement.gratuityAmount),
        },
        bonus: Number(settlement.bonusPayable),
        otherEarnings: Number(settlement.otherEarnings),
        breakdown: settlement.earningsBreakdown as any[],
      },
      deductions: {
        noticePeriodRecovery: {
          totalDays: settlement.noticePeriodDays,
          served: settlement.noticePeriodServed,
          shortfall: Math.max(0, settlement.noticePeriodDays - settlement.noticePeriodServed),
          amount: Number(settlement.noticePeriodRecovery),
        },
        otherDeductions: Number(settlement.otherDeductions),
        breakdown: settlement.deductionsBreakdown as any[],
      },
      totals: {
        totalPayable: Number(settlement.totalPayable),
        totalRecovery: Number(settlement.totalRecovery),
        netSettlement: Number(settlement.netSettlement),
      },
      status: settlement.status,
      calculatedAt: settlement.calculatedAt,
      approvedAt: settlement.approvedAt,
      settlementDate: settlement.settlementDate,
      remarks: settlement.remarks,
    };
  }

  /**
   * Generate ESIC Contribution Statement for a payroll cycle.
   *
   * Returns employee-wise ESIC contributions (employee 0.75% + employer 3.25%).
   * Only includes employees whose gross salary is within the ESIC threshold (≤₹21,000).
   */
  async getEsicStatement(cycleId: string, organizationId: string) {
    const cycle = await prisma.payrollCycle.findUnique({
      where: { id: cycleId },
      select: {
        id: true, name: true, payrollMonth: true, payrollYear: true,
        periodStart: true, periodEnd: true, organizationId: true,
      },
    });
    if (!cycle) throw new AppError('Payroll cycle not found', 404);
    if (cycle.organizationId !== organizationId) {
      throw new AppError('Payroll cycle does not belong to this organization', 400);
    }

    const payslips = await prisma.payslip.findMany({
      where: { payrollCycleId: cycleId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            taxInformation: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });

    const rows = payslips
      .map((payslip) => {
        const statutory = (payslip.statutoryDeductions as any) || {};
        const employeeEsic = Number(statutory.esi ?? 0);
        const employerEsic = Number(statutory.employerEsi ?? 0);
        if (employeeEsic === 0 && employerEsic === 0) return null;

        const taxInfo = (payslip.employee.taxInformation as any) || {};
        return {
          employeeCode: payslip.employee.employeeCode,
          employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
          department: payslip.employee.department?.name || '',
          esicNumber: taxInfo.esiNumber || '',
          grossSalary: Number(payslip.grossSalary),
          employeeEsic,
          employerEsic,
          totalEsic: employeeEsic + employerEsic,
        };
      })
      .filter(Boolean);

    const totalEmployeeEsic = rows.reduce((s, r) => s + (r?.employeeEsic ?? 0), 0);
    const totalEmployerEsic = rows.reduce((s, r) => s + (r?.employerEsic ?? 0), 0);

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        month: cycle.payrollMonth,
        year: cycle.payrollYear,
        periodStart: cycle.periodStart,
        periodEnd: cycle.periodEnd,
      },
      rows,
      summary: {
        totalEmployees: rows.length,
        totalEmployeeEsic: Math.round(totalEmployeeEsic * 100) / 100,
        totalEmployerEsic: Math.round(totalEmployerEsic * 100) / 100,
        totalEsic: Math.round((totalEmployeeEsic + totalEmployerEsic) * 100) / 100,
      },
    };
  }

  /**
   * Generate Professional Tax (PT) Report for a payroll cycle.
   *
   * Groups by state (ptaxLocation) and shows per-employee PT deductions.
   */
  async getProfessionalTaxReport(cycleId: string, organizationId: string) {
    const cycle = await prisma.payrollCycle.findUnique({
      where: { id: cycleId },
      select: {
        id: true, name: true, payrollMonth: true, payrollYear: true,
        periodStart: true, periodEnd: true, organizationId: true,
      },
    });
    if (!cycle) throw new AppError('Payroll cycle not found', 404);
    if (cycle.organizationId !== organizationId) {
      throw new AppError('Payroll cycle does not belong to this organization', 400);
    }

    const payslips = await prisma.payslip.findMany({
      where: { payrollCycleId: cycleId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            taxInformation: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });

    const stateMap: Record<string, { employees: any[]; totalPT: number }> = {};

    for (const payslip of payslips) {
      const statutory = (payslip.statutoryDeductions as any) || {};
      const pt = Number(statutory.professionalTax ?? 0);
      if (pt === 0) continue;

      const taxInfo = (payslip.employee.taxInformation as any) || {};
      const state = taxInfo.ptaxLocation || 'UNKNOWN';

      if (!stateMap[state]) stateMap[state] = { employees: [], totalPT: 0 };
      stateMap[state].employees.push({
        employeeCode: payslip.employee.employeeCode,
        employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
        department: payslip.employee.department?.name || '',
        grossSalary: Number(payslip.grossSalary),
        professionalTax: pt,
      });
      stateMap[state].totalPT += pt;
    }

    const states = Object.entries(stateMap).map(([state, data]) => ({
      state,
      employeeCount: data.employees.length,
      totalPT: Math.round(data.totalPT * 100) / 100,
      employees: data.employees,
    }));

    const grandTotal = states.reduce((s, st) => s + st.totalPT, 0);

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        month: cycle.payrollMonth,
        year: cycle.payrollYear,
      },
      states,
      summary: {
        totalStates: states.length,
        totalEmployees: states.reduce((s, st) => s + st.employeeCount, 0),
        totalProfessionalTax: Math.round(grandTotal * 100) / 100,
      },
    };
  }

  /**
   * Generate TDS Working Sheet for a financial year.
   *
   * Aggregates monthly TDS deductions across all payroll cycles in the FY,
   * showing YTD tax liability, paid tax, and balance for each employee.
   */
  async getTdsWorkingSheet(organizationId: string, financialYear: string) {
    // Parse FY: "2025-26" → startYear=2025, endYear=2026
    const [startYearStr] = financialYear.split('-');
    const startYear = parseInt(startYearStr);
    if (isNaN(startYear)) throw new AppError('Invalid financial year format (expected YYYY-YY)', 400);
    const endYear = startYear + 1;

    // FY runs Apr 1 of startYear to Mar 31 of endYear
    const fyStart = new Date(`${startYear}-04-01`);
    const fyEnd = new Date(`${endYear}-03-31`);

    const cycles = await prisma.payrollCycle.findMany({
      where: {
        organizationId,
        periodStart: { gte: fyStart },
        periodEnd: { lte: fyEnd },
        status: { in: ['PROCESSED', 'FINALIZED', 'PAID'] },
      },
      orderBy: { payrollMonth: 'asc' },
      select: { id: true, name: true, payrollMonth: true, payrollYear: true },
    });

    if (cycles.length === 0) {
      return { financialYear, cycles: [], employees: [], summary: { totalEmployees: 0, totalTaxLiability: 0, totalTdsPaid: 0 } };
    }

    const cycleIds = cycles.map(c => c.id);
    const payslips = await prisma.payslip.findMany({
      where: { payrollCycleId: { in: cycleIds } },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            taxInformation: true,
          },
        },
      },
    });

    // Group by employee
    const empMap: Record<string, {
      employee: any;
      months: Record<string, { month: number; year: number; grossSalary: number; incomeTax: number; surcharge: number; cess: number; totalTds: number }>;
    }> = {};

    for (const payslip of payslips) {
      const empId = payslip.employee.id;
      if (!empMap[empId]) {
        empMap[empId] = { employee: payslip.employee, months: {} };
      }

      const cycle = cycles.find(c => c.id === payslip.payrollCycleId);
      if (!cycle) continue;

      const tax = (payslip.taxDetails as any) || {};
      const key = `${cycle.payrollYear}-${String(cycle.payrollMonth).padStart(2, '0')}`;
      empMap[empId].months[key] = {
        month: cycle.payrollMonth,
        year: cycle.payrollYear,
        grossSalary: Number(payslip.grossSalary),
        incomeTax: Number(tax.incomeTax ?? 0),
        surcharge: Number(tax.surcharge ?? 0),
        cess: Number(tax.cess ?? 0),
        totalTds: Number(tax.incomeTax ?? 0) + Number(tax.surcharge ?? 0) + Number(tax.cess ?? 0),
      };
    }

    const employees = Object.values(empMap).map(({ employee, months }) => {
      const monthList = Object.values(months).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      const taxInfo = (employee.taxInformation as any) || {};
      const ytdTds = monthList.reduce((s, m) => s + m.totalTds, 0);
      const ytdGross = monthList.reduce((s, m) => s + m.grossSalary, 0);

      return {
        employeeCode: employee.employeeCode,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        panNumber: taxInfo.panNumber || '',
        taxRegime: taxInfo.taxRegime || 'NEW',
        ytdGrossSalary: Math.round(ytdGross * 100) / 100,
        ytdTdsPaid: Math.round(ytdTds * 100) / 100,
        monthlyBreakdown: monthList,
      };
    });

    const totalTdsPaid = employees.reduce((s, e) => s + e.ytdTdsPaid, 0);

    return {
      financialYear,
      cyclesIncluded: cycles.map(c => ({ id: c.id, name: c.name, month: c.payrollMonth, year: c.payrollYear })),
      employees,
      summary: {
        totalEmployees: employees.length,
        totalGrossSalary: Math.round(employees.reduce((s, e) => s + e.ytdGrossSalary, 0) * 100) / 100,
        totalTdsPaid: Math.round(totalTdsPaid * 100) / 100,
      },
    };
  }
}

export const complianceReportService = new ComplianceReportService();
