import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { PayrollCalculationEngine, validatePAN } from '../utils/payroll-calculation-engine';
import { auditLogService } from './audit-log.service';
import { decryptField } from '../utils/crypto-utils';

/**
 * Full & Final Settlement Service
 *
 * Calculates exit-time settlement for separated employees including:
 * - Final month pro-rata salary
 * - Leave encashment (using EncashmentCarryForward rules + leave balances)
 * - Gratuity (Payment of Gratuity Act, 1972)
 * - Notice period recovery
 * - Pro-rata bonus
 * - TDS adjustment on F&F income (Section 192)
 * - Excess leave recovery
 * - Loan/Advance recovery
 */

// Gratuity cap as per Payment of Gratuity Act (₹20,00,000)
const GRATUITY_CAP = 2000000;

// Gratuity exemption limit under Section 10(10) — ₹20,00,000
const GRATUITY_EXEMPTION_LIMIT = 2000000;

// Leave encashment exemption limit under Section 10(10AA) for non-govt — ₹25,00,000
const LEAVE_ENCASHMENT_EXEMPTION_LIMIT = 2500000;

export class FnfSettlementService {
  /**
   * Calculate F&F settlement for a separation
   */
  async calculateSettlement(
    separationId: string,
    organizationId: string,
    calculatedBy?: string
  ) {
    // 1. Fetch separation record
    const separation = await prisma.employeeSeparation.findUnique({
      where: { id: separationId },
    });
    if (!separation) {
      throw new AppError('Separation record not found', 404);
    }
    if (separation.organizationId !== organizationId) {
      throw new AppError('Separation does not belong to this organization', 400);
    }

    // 2. Fetch employee with salary and leave balances
    const employee = await prisma.employee.findUnique({
      where: { id: separation.employeeId },
      include: {
        salaries: {
          where: { isActive: true },
          orderBy: { effectiveDate: 'desc' },
          take: 1,
          include: {
            salaryStructure: true,
          },
        },
        leaveBalances: {
          include: {
            leaveType: {
              select: { id: true, name: true, code: true, isPaid: true },
            },
          },
        },
        paygroup: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    const employeeSalary = employee.salaries[0];
    if (!employeeSalary) {
      throw new AppError('No active salary found for employee', 400);
    }

    const lastWorkingDate = new Date(separation.relievingDate);
    const joiningDate = new Date(employee.dateOfJoining);
    const basicSalary = Number(employeeSalary.basicSalary);
    const grossSalary = Number(employeeSalary.grossSalary);

    // 3. Calculate final month pro-rata salary
    const finalMonth = this.calculateFinalMonthSalary(
      lastWorkingDate,
      basicSalary,
      grossSalary
    );

    // 4. Calculate leave encashment
    const leaveEncashment = await this.calculateLeaveEncashment(
      employee,
      organizationId,
      basicSalary
    );

    // 5. Calculate gratuity
    const gratuity = this.calculateGratuity(
      joiningDate,
      lastWorkingDate,
      basicSalary,
      separation.separationType
    );

    // 6. Calculate notice period recovery
    const noticeRecovery = this.calculateNoticePeriodRecovery(
      separation.resignationApplyDate,
      lastWorkingDate,
      separation.noticePeriod,
      grossSalary,
      separation.noticePeriodReason
    );

    // 7. Calculate pro-rata bonus
    const bonusPayable = this.calculateProRataBonus(
      lastWorkingDate,
      grossSalary
    );

    // 8. Calculate excess leave recovery (negative leave balance = excess taken)
    const excessLeaveRecovery = this.calculateExcessLeaveRecovery(
      employee.leaveBalances,
      basicSalary
    );

    // 9. Calculate pending loan/advance recovery (broken down by type)
    const loanRecovery = await this.calculatePendingLoanRecovery(
      employee.id,
      organizationId
    );
    const insuranceRecovery = loanRecovery.insuranceRecovery;
    const travelRecovery = loanRecovery.travelRecovery;
    const loanAdvanceRecovery = loanRecovery.otherLoanRecovery;
    const totalLoanRecovery = loanRecovery.total;

    // 10. Calculate TDS adjustment on F&F income (Section 192)
    const taxInfo = (employee as any).taxInformation as Record<string, any> | null;
    const taxRegime = (taxInfo?.taxRegime as 'OLD' | 'NEW') || 'NEW';
    // Decrypt PAN in case it's stored encrypted in DB (NFR: field-level encryption)
    const panNumber = decryptField(taxInfo?.panNumber as string | undefined) as string | undefined;

    const tdsAdjustment = this.calculateFnfTDS(
      {
        finalMonthSalary: finalMonth.netSalary,
        leaveEncashment: leaveEncashment.amount,
        gratuityAmount: gratuity.amount,
        bonusPayable,
        yearsOfService: gratuity.yearsOfService,
      },
      taxRegime,
      panNumber
    );

    // 11. Build earnings and deductions breakdown
    const earningsBreakdown = [
      { component: 'Final Month Salary (Pro-rata)', amount: finalMonth.netSalary },
      { component: 'Leave Encashment', amount: leaveEncashment.amount, days: leaveEncashment.days },
    ];

    if (gratuity.amount > 0) {
      earningsBreakdown.push({
        component: 'Gratuity',
        amount: gratuity.amount,
        days: gratuity.yearsOfService,
      });
    }

    if (bonusPayable > 0) {
      earningsBreakdown.push({ component: 'Pro-rata Bonus', amount: bonusPayable } as any);
    }

    const deductionsBreakdown: Array<{ component: string; amount: number }> = [];

    if (noticeRecovery.recovery > 0) {
      deductionsBreakdown.push({
        component: 'Notice Period Recovery',
        amount: noticeRecovery.recovery,
      });
    }

    if (tdsAdjustment > 0) {
      deductionsBreakdown.push({
        component: 'TDS Adjustment',
        amount: tdsAdjustment,
      });
    }

    if (excessLeaveRecovery > 0) {
      deductionsBreakdown.push({
        component: 'Excess Leave Recovery',
        amount: excessLeaveRecovery,
      });
    }

    if (insuranceRecovery > 0) {
      deductionsBreakdown.push({
        component: 'Insurance Advance Recovery',
        amount: insuranceRecovery,
      });
    }

    if (travelRecovery > 0) {
      deductionsBreakdown.push({
        component: 'Travel Advance Recovery',
        amount: travelRecovery,
      });
    }

    if (loanAdvanceRecovery > 0) {
      deductionsBreakdown.push({
        component: 'Pending Loan/Advance Recovery',
        amount: loanAdvanceRecovery,
      });
    }

    // 12. Calculate totals
    const totalPayable =
      finalMonth.netSalary +
      leaveEncashment.amount +
      gratuity.amount +
      bonusPayable;
    const totalRecovery =
      noticeRecovery.recovery +
      tdsAdjustment +
      excessLeaveRecovery +
      totalLoanRecovery;
    const netSettlement = totalPayable - totalRecovery;

    // 13. Upsert FnfSettlement record
    const settlementData = {
      organizationId,
      employeeId: employee.id,
      separationId,
      lastWorkingDate,
      finalMonthGross: new Prisma.Decimal(finalMonth.grossSalary.toFixed(2)),
      finalMonthDeductions: new Prisma.Decimal(finalMonth.deductions.toFixed(2)),
      finalMonthNet: new Prisma.Decimal(finalMonth.netSalary.toFixed(2)),
      encashableLeaveDays: new Prisma.Decimal(leaveEncashment.days.toFixed(2)),
      leaveEncashmentAmount: new Prisma.Decimal(leaveEncashment.amount.toFixed(2)),
      gratuityEligible: gratuity.eligible,
      yearsOfService: new Prisma.Decimal(gratuity.yearsOfService.toFixed(2)),
      gratuityAmount: new Prisma.Decimal(gratuity.amount.toFixed(2)),
      noticePeriodDays: noticeRecovery.totalDays,
      noticePeriodServed: noticeRecovery.servedDays,
      noticePeriodRecovery: new Prisma.Decimal(noticeRecovery.recovery.toFixed(2)),
      bonusPayable: new Prisma.Decimal(bonusPayable.toFixed(2)),
      tdsAdjustment: new Prisma.Decimal(tdsAdjustment.toFixed(2)),
      excessLeaveRecovery: new Prisma.Decimal(excessLeaveRecovery.toFixed(2)),
      insuranceRecovery: new Prisma.Decimal(insuranceRecovery.toFixed(2)),
      travelRecovery: new Prisma.Decimal(travelRecovery.toFixed(2)),
      loanAdvanceRecovery: new Prisma.Decimal(loanAdvanceRecovery.toFixed(2)),
      totalPayable: new Prisma.Decimal(totalPayable.toFixed(2)),
      totalRecovery: new Prisma.Decimal(totalRecovery.toFixed(2)),
      netSettlement: new Prisma.Decimal(netSettlement.toFixed(2)),
      earningsBreakdown: earningsBreakdown as any,
      deductionsBreakdown: deductionsBreakdown as any,
      status: 'CALCULATED',
      calculatedBy: calculatedBy || null,
      calculatedAt: new Date(),
    };

    const settlement = await prisma.fnfSettlement.upsert({
      where: { separationId },
      create: settlementData,
      update: settlementData,
    });

    return {
      settlement,
      details: {
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          code: employee.employeeCode,
          department: employee.department?.name,
          paygroup: employee.paygroup?.name,
          joiningDate: employee.dateOfJoining,
          lastWorkingDate,
        },
        finalMonthSalary: finalMonth,
        leaveEncashment,
        gratuity,
        noticeRecovery,
        bonusPayable,
        tdsAdjustment,
        excessLeaveRecovery,
        insuranceRecovery,
        travelRecovery,
        loanAdvanceRecovery,
        totals: { totalPayable, totalRecovery, netSettlement },
      },
    };
  }

  /**
   * Calculate final month pro-rata salary
   */
  private calculateFinalMonthSalary(
    lastWorkingDate: Date,
    basicSalary: number,
    grossSalary: number
  ): { grossSalary: number; deductions: number; netSalary: number; paidDays: number; totalDays: number } {
    const year = lastWorkingDate.getUTCFullYear();
    const month = lastWorkingDate.getUTCMonth();

    // Total calendar days in the month
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    // Days worked in final month (1st to last working date, inclusive)
    const dayOfMonth = lastWorkingDate.getUTCDate();
    const paidDays = dayOfMonth;

    const proRataFactor = paidDays / totalDaysInMonth;
    const proRataGross = grossSalary * proRataFactor;

    // Estimate deductions at pro-rata (PF 12% of basic + PT ₹200 approx)
    const proRataBasic = basicSalary * proRataFactor;
    const pfDeduction = Math.round((Math.min(proRataBasic, 15000) * 12) / 100);
    const estimatedDeductions = pfDeduction + 200; // PF + PT approximation

    return {
      grossSalary: Math.round(proRataGross),
      deductions: estimatedDeductions,
      netSalary: Math.round(proRataGross - estimatedDeductions),
      paidDays,
      totalDays: totalDaysInMonth,
    };
  }

  /**
   * Calculate leave encashment based on available balances and encashment rules
   */
  private async calculateLeaveEncashment(
    employee: {
      id: string;
      paygroupId?: string | null;
      departmentId?: string | null;
      leaveBalances: Array<{
        available: any;
        leaveType: { id: string; name: string; code: string | null; isPaid: boolean };
      }>;
    },
    organizationId: string,
    basicSalary: number
  ): Promise<{ days: number; amount: number; breakdown: Array<{ leaveType: string; days: number; amount: number }> }> {
    // Fetch encashment rules applicable to this employee
    const encashmentRules = await prisma.encashmentCarryForward.findMany({
      where: {
        organizationId,
        isEncashmentApplicable: true,
      },
    });

    const breakdown: Array<{ leaveType: string; days: number; amount: number }> = [];
    let totalDays = 0;
    let totalAmount = 0;

    // Daily rate for encashment: basic salary / 30 (standard Indian calculation)
    const dailyRate = basicSalary / 30;

    for (const balance of employee.leaveBalances) {
      if (!balance.leaveType.isPaid) continue;
      const available = Number(balance.available);
      if (available <= 0) continue;

      // Find matching encashment rule
      const leaveTypeName = balance.leaveType.name.toLowerCase().replace(/\s+/g, '');
      const matchingRule = encashmentRules.find((rule) => {
        const ruleEventKey = rule.eventType.toLowerCase().replace(/\s+/g, '');
        if (ruleEventKey !== leaveTypeName && ruleEventKey !== (balance.leaveType.code || '').toLowerCase()) {
          return false;
        }

        // Check if rule applies to this employee's paygroup/department
        if (rule.associateId && rule.associateId !== employee.id) return false;
        if (rule.paygroupIds && employee.paygroupId) {
          const pgIds = rule.paygroupIds as string[];
          if (Array.isArray(pgIds) && pgIds.length > 0 && !pgIds.includes(employee.paygroupId)) return false;
        }
        if (rule.departmentIds && employee.departmentId) {
          const deptIds = rule.departmentIds as string[];
          if (Array.isArray(deptIds) && deptIds.length > 0 && !deptIds.includes(employee.departmentId)) return false;
        }
        return true;
      });

      // Calculate encashable days
      let encashableDays = available;
      if (matchingRule) {
        encashableDays = Math.min(available, matchingRule.maxEncashmentDays);
      }

      if (encashableDays > 0) {
        const amount = Math.round(dailyRate * encashableDays);
        breakdown.push({
          leaveType: balance.leaveType.name,
          days: encashableDays,
          amount,
        });
        totalDays += encashableDays;
        totalAmount += amount;
      }
    }

    return { days: totalDays, amount: totalAmount, breakdown };
  }

  /**
   * Calculate gratuity per Payment of Gratuity Act, 1972
   *
   * Formula: (Last drawn basic salary × 15 × completed years of service) / 26
   * Eligible: 5+ years of continuous service (or death/disability — always eligible)
   * Cap: ₹20,00,000
   */
  private calculateGratuity(
    joiningDate: Date,
    lastWorkingDate: Date,
    lastDrawnBasic: number,
    separationType: string
  ): { eligible: boolean; yearsOfService: number; amount: number } {
    const msInYear = 365.25 * 24 * 60 * 60 * 1000;
    const yearsOfService = (lastWorkingDate.getTime() - joiningDate.getTime()) / msInYear;

    // Round to completed years (months > 6 round up)
    const completedYears = Math.floor(yearsOfService);
    const remainingMonths = (yearsOfService - completedYears) * 12;
    const effectiveYears = remainingMonths > 6 ? completedYears + 1 : completedYears;

    // Eligibility: Per Payment of Gratuity Act 1972 — 4 years 6 months (54 months) minimum
    const isDeathOrDisability = separationType === 'OTHER'; // Can be extended
    const diffMs = lastWorkingDate.getTime() - joiningDate.getTime();
    const totalMonths = diffMs / (1000 * 60 * 60 * 24 * (365.25 / 12));
    const eligible = totalMonths >= 54 || isDeathOrDisability;

    if (!eligible) {
      return { eligible: false, yearsOfService: parseFloat(yearsOfService.toFixed(2)), amount: 0 };
    }

    // Gratuity = (Basic × 15 × completed years) / 26
    const gratuityAmount = (lastDrawnBasic * 15 * effectiveYears) / 26;

    // Cap at ₹20,00,000
    const cappedAmount = Math.min(Math.round(gratuityAmount), GRATUITY_CAP);

    return {
      eligible: true,
      yearsOfService: parseFloat(yearsOfService.toFixed(2)),
      amount: cappedAmount,
    };
  }

  /**
   * Calculate notice period recovery for unserved days
   */
  private calculateNoticePeriodRecovery(
    resignationDate: Date,
    lastWorkingDate: Date,
    noticePeriodDays: number,
    grossSalary: number,
    noticePeriodReason?: string | null
  ): { totalDays: number; servedDays: number; shortfall: number; recovery: number } {
    // If notice was waived or bought out, no recovery
    if (noticePeriodReason === 'WAIVED' || noticePeriodReason === 'BUYOUT') {
      return { totalDays: noticePeriodDays, servedDays: noticePeriodDays, shortfall: 0, recovery: 0 };
    }

    // Calculate days served (calendar days between resignation and last working date)
    const msPerDay = 24 * 60 * 60 * 1000;
    const servedDays = Math.max(0, Math.round(
      (lastWorkingDate.getTime() - resignationDate.getTime()) / msPerDay
    ));

    const shortfall = Math.max(0, noticePeriodDays - servedDays);

    if (shortfall <= 0) {
      return { totalDays: noticePeriodDays, servedDays, shortfall: 0, recovery: 0 };
    }

    // Recovery = (gross salary / 30) × shortfall days
    const dailyRate = grossSalary / 30;
    const recovery = Math.round(dailyRate * shortfall);

    return { totalDays: noticePeriodDays, servedDays, shortfall, recovery };
  }

  /**
   * Calculate pro-rata bonus for the current financial year
   */
  private calculateProRataBonus(
    lastWorkingDate: Date,
    grossSalary: number
  ): number {
    // Determine FY start (April 1)
    const year = lastWorkingDate.getUTCFullYear();
    const month = lastWorkingDate.getUTCMonth(); // 0-indexed
    const fyStartYear = month >= 3 ? year : year - 1; // FY starts in April (month index 3)
    const fyStart = new Date(fyStartYear, 3, 1); // April 1

    // Months worked in current FY
    const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
    const monthsWorked = Math.max(1, Math.round(
      (lastWorkingDate.getTime() - fyStart.getTime()) / msPerMonth
    ));
    const effectiveMonths = Math.min(monthsWorked, 12);

    // Statutory bonus under Payment of Bonus Act: 8.33% of salary (minimum)
    // Annual bonus = grossSalary * 8.33% * 12 months
    // Pro-rata = (annual / 12) * monthsWorked
    const annualBonus = grossSalary * 0.0833;
    const proRataBonus = Math.round((annualBonus / 12) * effectiveMonths);

    return proRataBonus;
  }

  /**
   * Calculate TDS adjustment on F&F income (Section 192 of IT Act)
   *
   * Taxable F&F components:
   * - Final month salary: fully taxable
   * - Leave encashment: exempt up to ₹25L under Sec 10(10AA) for non-govt employees
   * - Gratuity: exempt up to ₹20L under Sec 10(10)
   * - Bonus: fully taxable
   * - Notice pay recovery: deductible from F&F income
   */
  private calculateFnfTDS(
    fnfIncome: {
      finalMonthSalary: number;
      leaveEncashment: number;
      gratuityAmount: number;
      bonusPayable: number;
      yearsOfService: number;
    },
    taxRegime: 'OLD' | 'NEW',
    panNumber?: string
  ): number {
    // Calculate taxable portion of each F&F component
    let taxableFnfIncome = 0;

    // Final month salary: fully taxable
    taxableFnfIncome += fnfIncome.finalMonthSalary;

    // Leave encashment: exempt up to ₹25,00,000 under Sec 10(10AA) for non-govt
    const taxableLeaveEncashment = Math.max(
      0,
      fnfIncome.leaveEncashment - LEAVE_ENCASHMENT_EXEMPTION_LIMIT
    );
    taxableFnfIncome += taxableLeaveEncashment;

    // Gratuity: exempt up to ₹20,00,000 under Sec 10(10)
    const taxableGratuity = Math.max(
      0,
      fnfIncome.gratuityAmount - GRATUITY_EXEMPTION_LIMIT
    );
    taxableFnfIncome += taxableGratuity;

    // Bonus: fully taxable
    taxableFnfIncome += fnfIncome.bonusPayable;

    if (taxableFnfIncome <= 0) return 0;

    // PAN validation: apply higher TDS (20%) if PAN missing/invalid
    const panStatus = validatePAN(panNumber);
    if (panStatus !== 'VALID') {
      return Math.round(taxableFnfIncome * 0.20);
    }

    // Calculate tax on F&F income using annual projection
    const taxResult = taxRegime === 'NEW'
      ? PayrollCalculationEngine.calculateNewTaxRegime(taxableFnfIncome)
      : PayrollCalculationEngine.calculateOldTaxRegime(taxableFnfIncome);

    return Math.round(taxResult.incomeTax);
  }

  /**
   * Calculate excess leave recovery (for leaves taken beyond entitlement)
   * If an employee's leave balance is negative, they've taken more leaves than allowed.
   * Recovery = |negative balance| × (Basic / 30)
   */
  private calculateExcessLeaveRecovery(
    leaveBalances: Array<{
      available: any;
      leaveType: { id: string; name: string; code: string | null; isPaid: boolean };
    }>,
    basicSalary: number
  ): number {
    const dailyRate = basicSalary / 30;
    let totalRecovery = 0;

    for (const balance of leaveBalances) {
      if (!balance.leaveType.isPaid) continue;
      const available = Number(balance.available);

      // Negative balance = excess leaves taken beyond entitlement
      if (available < 0) {
        const excessDays = Math.abs(available);
        totalRecovery += Math.round(dailyRate * excessDays);
      }
    }

    return totalRecovery;
  }

  /**
   * Calculate pending loan/advance recovery from EmployeeLoan table.
   * Returns total and breakdown by loan type for F&F deduction fields.
   */
  private async calculatePendingLoanRecovery(
    employeeId: string,
    organizationId: string
  ): Promise<{
    insuranceRecovery: number;
    travelRecovery: number;
    otherLoanRecovery: number;
    total: number;
  }> {
    try {
      const pendingLoans = await prisma.employeeLoan.findMany({
        where: {
          employeeId,
          organizationId,
          status: { in: ['ACTIVE', 'APPROVED'] },
          pendingAmount: { gt: 0 },
        },
        select: {
          pendingAmount: true,
          loanType: true,
        },
      });

      let insuranceRecovery = 0;
      let travelRecovery = 0;
      let otherLoanRecovery = 0;

      for (const loan of pendingLoans) {
        const amount = Number(loan.pendingAmount);
        if (loan.loanType === 'INSURANCE_ADVANCE') {
          insuranceRecovery += amount;
        } else if (loan.loanType === 'TRAVEL_ADVANCE') {
          travelRecovery += amount;
        } else {
          otherLoanRecovery += amount;
        }
      }

      return {
        insuranceRecovery: Math.round(insuranceRecovery),
        travelRecovery: Math.round(travelRecovery),
        otherLoanRecovery: Math.round(otherLoanRecovery),
        total: Math.round(insuranceRecovery + travelRecovery + otherLoanRecovery),
      };
    } catch {
      return { insuranceRecovery: 0, travelRecovery: 0, otherLoanRecovery: 0, total: 0 };
    }
  }

  /**
   * Get settlement by ID
   */
  async getById(id: string, organizationId: string) {
    const settlement = await prisma.fnfSettlement.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            dateOfJoining: true,
            department: { select: { name: true } },
            paygroup: { select: { name: true } },
          },
        },
        separation: true,
      },
    });

    if (!settlement) {
      throw new AppError('Settlement not found', 404);
    }
    if (settlement.organizationId !== organizationId) {
      throw new AppError('Settlement does not belong to this organization', 400);
    }

    return settlement;
  }

  /**
   * Get all settlements for an organization
   */
  async getAll(query: {
    organizationId: string;
    page?: string;
    limit?: string;
    status?: string;
    search?: string;
  }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: Prisma.FnfSettlementWhereInput = {
      organizationId: query.organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.employee = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { employeeCode: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      prisma.fnfSettlement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.fnfSettlement.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Approve a settlement
   */
  async approve(id: string, organizationId: string, approvedBy: string) {
    const settlement = await prisma.fnfSettlement.findUnique({ where: { id } });
    if (!settlement) throw new AppError('Settlement not found', 404);
    if (settlement.organizationId !== organizationId) {
      throw new AppError('Settlement does not belong to this organization', 400);
    }
    if (settlement.status !== 'DRAFT' && settlement.status !== 'CALCULATED') {
      throw new AppError(`Cannot approve settlement in ${settlement.status} status`, 400);
    }

    const approved = await prisma.fnfSettlement.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    await auditLogService.log({
      organizationId,
      entityType: 'FNF_SETTLEMENT',
      entityId: id,
      action: 'APPROVE',
      previousValue: { status: settlement.status },
      newValue: { status: 'APPROVED' },
      changedBy: approvedBy,
      remarks: 'F&F Settlement approved',
    });

    return approved;
  }

  /**
   * Mark settlement as paid
   */
  async markAsPaid(id: string, organizationId: string) {
    const settlement = await prisma.fnfSettlement.findUnique({ where: { id } });
    if (!settlement) throw new AppError('Settlement not found', 404);
    if (settlement.organizationId !== organizationId) {
      throw new AppError('Settlement does not belong to this organization', 400);
    }
    if (settlement.status !== 'APPROVED') {
      throw new AppError('Settlement must be approved before marking as paid', 400);
    }

    const paid = await prisma.fnfSettlement.update({
      where: { id },
      data: {
        status: 'PAID',
        settlementDate: new Date(),
      },
    });

    await auditLogService.log({
      organizationId,
      entityType: 'FNF_SETTLEMENT',
      entityId: id,
      action: 'PAID',
      previousValue: { status: 'APPROVED' },
      newValue: { status: 'PAID' },
      remarks: 'F&F Settlement marked as paid',
    });

    return paid;
  }

  /**
   * Update manual adjustments (otherEarnings, otherDeductions, remarks)
   */
  async update(
    id: string,
    organizationId: string,
    data: {
      otherEarnings?: number;
      otherDeductions?: number;
      remarks?: string;
    }
  ) {
    const settlement = await prisma.fnfSettlement.findUnique({ where: { id } });
    if (!settlement) throw new AppError('Settlement not found', 404);
    if (settlement.organizationId !== organizationId) {
      throw new AppError('Settlement does not belong to this organization', 400);
    }
    if (settlement.status === 'PAID') {
      throw new AppError('Cannot update a paid settlement', 400);
    }

    const updateData: any = {};
    if (data.otherEarnings !== undefined) {
      updateData.otherEarnings = new Prisma.Decimal(data.otherEarnings.toFixed(2));
    }
    if (data.otherDeductions !== undefined) {
      updateData.otherDeductions = new Prisma.Decimal(data.otherDeductions.toFixed(2));
    }
    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks;
    }

    // Recalculate totals if earnings/deductions changed
    if (data.otherEarnings !== undefined || data.otherDeductions !== undefined) {
      const otherEarnings = data.otherEarnings !== undefined
        ? data.otherEarnings
        : Number(settlement.otherEarnings);
      const otherDeductions = data.otherDeductions !== undefined
        ? data.otherDeductions
        : Number(settlement.otherDeductions);

      const totalPayable =
        Number(settlement.finalMonthNet) +
        Number(settlement.leaveEncashmentAmount) +
        Number(settlement.gratuityAmount) +
        Number(settlement.bonusPayable) +
        otherEarnings;

      const totalRecovery =
        Number(settlement.noticePeriodRecovery) +
        Number(settlement.tdsAdjustment) +
        Number(settlement.excessLeaveRecovery) +
        Number(settlement.loanAdvanceRecovery) +
        otherDeductions;

      updateData.totalPayable = new Prisma.Decimal(totalPayable.toFixed(2));
      updateData.totalRecovery = new Prisma.Decimal(totalRecovery.toFixed(2));
      updateData.netSettlement = new Prisma.Decimal((totalPayable - totalRecovery).toFixed(2));
    }

    return prisma.fnfSettlement.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Get settlement stats by status for dashboard
   */
  async getStats(organizationId: string) {
    const [draft, calculated, approved, paid, paidAggregate] = await Promise.all([
      prisma.fnfSettlement.count({ where: { organizationId, status: 'DRAFT' } }),
      prisma.fnfSettlement.count({ where: { organizationId, status: 'CALCULATED' } }),
      prisma.fnfSettlement.count({ where: { organizationId, status: 'APPROVED' } }),
      prisma.fnfSettlement.count({ where: { organizationId, status: 'PAID' } }),
      prisma.fnfSettlement.aggregate({
        where: { organizationId, status: 'PAID' },
        _sum: { netSettlement: true },
      }),
    ]);

    return {
      pending: draft + calculated,
      hrApproved: approved,
      completed: paid,
      totalPaidAmount: Number(paidAggregate._sum.netSettlement || 0),
    };
  }

  /**
   * Get separations that do not yet have a settlement (eligible for F&F initiation)
   */
  async getEligibleSeparations(organizationId: string) {
    const separations = await prisma.employeeSeparation.findMany({
      where: {
        organizationId,
        fnfSettlement: null,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            dateOfJoining: true,
            department: { select: { name: true } },
            position: { select: { title: true } },
          },
        },
      },
      orderBy: { relievingDate: 'desc' },
    });

    return separations;
  }

  /**
   * Delete a DRAFT settlement
   */
  async delete(id: string, organizationId: string) {
    const settlement = await prisma.fnfSettlement.findUnique({ where: { id } });
    if (!settlement) throw new AppError('Settlement not found', 404);
    if (settlement.organizationId !== organizationId) {
      throw new AppError('Settlement does not belong to this organization', 400);
    }
    if (settlement.status !== 'DRAFT' && settlement.status !== 'CALCULATED') {
      throw new AppError('Only DRAFT or CALCULATED settlements can be deleted', 400);
    }

    await prisma.fnfSettlement.delete({ where: { id } });
    return { deleted: true };
  }
}

export const fnfSettlementService = new FnfSettlementService();
