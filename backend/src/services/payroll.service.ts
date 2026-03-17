import { PayrollStatus, AttendanceStatus, LeaveStatus } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import {
  CreatePayrollCycleInput,
  UpdatePayrollCycleInput,
  QueryPayrollCyclesInput,
  ProcessPayrollCycleInput,
} from '../utils/payroll.validation';
import { prisma } from '../utils/prisma';
import {
  PayrollCalculationEngine,
  type AttendanceData,
  type LeaveData,
  type EmployeePeriodData,
} from '../utils/payroll-calculation-engine';
import { loanService } from './loan.service';
import { type SalaryComponent } from '../utils/salary-components';
import {
  getOrderedRulesForPaygroup,
  evaluatePayrollComponents,
  type RuleForExecution,
} from './payroll-rules-execution.service';
import { statutoryConfigService, StatutoryConfigService } from './statutory-config.service';
import { auditLogService } from './audit-log.service';

export class PayrollService {
  /**
   * Create new payroll cycle
   */
  async create(data: CreatePayrollCycleInput) {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Check for overlapping payroll cycles
    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);

    const overlapping = await prisma.payrollCycle.findFirst({
      where: {
        organizationId: data.organizationId,
        status: { not: 'CANCELLED' },
        OR: [
          {
            AND: [
              { periodStart: { lte: periodEnd } },
              { periodEnd: { gte: periodStart } },
            ],
          },
        ],
      },
    });

    if (overlapping) {
      throw new AppError('A payroll cycle already exists for this period', 400);
    }

    // Calculate payroll month and year from period start
    const payrollMonth = periodStart.getMonth() + 1; // 1-12
    const payrollYear = periodStart.getFullYear();

    // Check for duplicate month/year combination
    const existingCycle = await prisma.payrollCycle.findFirst({
      where: {
        organizationId: data.organizationId,
        payrollMonth: payrollMonth as any,
        payrollYear: payrollYear as any,
        status: { not: 'CANCELLED' },
      } as any,
    });

    if (existingCycle) {
      throw new AppError(`A payroll cycle already exists for ${payrollMonth}/${payrollYear}`, 400);
    }

    const payrollCycle = await prisma.payrollCycle.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        periodStart,
        periodEnd,
        paymentDate: new Date(data.paymentDate),
        payrollMonth: payrollMonth as any,
        payrollYear: payrollYear as any,
        status: 'DRAFT',
        isLocked: false as any,
        notes: data.notes,
      } as any,
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return payrollCycle;
  }

  /**
   * Get all payroll cycles with filtering and pagination
   */
  async getAll(query: QueryPayrollCyclesInput) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.periodStart) {
      where.periodStart = { gte: new Date(query.periodStart) };
    }

    if (query.periodEnd) {
      where.periodEnd = { lte: new Date(query.periodEnd) };
    }

    if (query.payrollMonth) {
      (where as any).payrollMonth = parseInt(query.payrollMonth);
    }

    if (query.payrollYear) {
      (where as any).payrollYear = parseInt(query.payrollYear);
    }

    const [payrollCycles, total] = await Promise.all([
      prisma.payrollCycle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: { id: true, name: true },
          },
          payslips: {
            select: { id: true, employeeId: true, netSalary: true },
            take: 5,
          },
        },
      }),
      prisma.payrollCycle.count({ where }),
    ]);

    return {
      data: payrollCycles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get payroll cycle by ID
   */
  async getById(id: string) {
    const payrollCycle = await prisma.payrollCycle.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        payslips: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
              },
            },
          },
        },
      },
    });

    if (!payrollCycle) {
      throw new AppError('Payroll cycle not found', 404);
    }

    return payrollCycle;
  }

  /**
   * Update payroll cycle
   */
  async update(id: string, data: UpdatePayrollCycleInput) {
    const existing = await prisma.payrollCycle.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Payroll cycle not found', 404);
    }

    // Prevent updates if locked (finalized or paid)
    if ((existing as any).isLocked) {
      throw new AppError('Cannot update payroll cycle that is locked (finalized or paid)', 400);
    }

    // Prevent updates if already finalized or paid
    if (existing.status === 'FINALIZED' || existing.status === 'PAID') {
      throw new AppError('Cannot update payroll cycle that is finalized or paid', 400);
    }

    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.periodStart) updateData.periodStart = new Date(data.periodStart);
    if (data.periodEnd) updateData.periodEnd = new Date(data.periodEnd);
    if (data.paymentDate) updateData.paymentDate = new Date(data.paymentDate);
    if (data.status) updateData.status = data.status as PayrollStatus;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.payrollCycle.update({
      where: { id },
      data: updateData,
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return updated;
  }

  /**
   * Process payroll cycle - Generate payslips for employees
   */
  async processPayrollCycle(
    id: string,
    data: ProcessPayrollCycleInput,
    processedBy: string
  ) {
    const payrollCycle = await prisma.payrollCycle.findUnique({
      where: { id },
      include: {
        organization: true,
      },
    });

    if (!payrollCycle) {
      throw new AppError('Payroll cycle not found', 404);
    }

    if ((payrollCycle as any).isLocked) {
      throw new AppError('Cannot re-process a locked payroll cycle. It is finalized or paid.', 400);
    }

    if (payrollCycle.status === 'FINALIZED' || payrollCycle.status === 'PAID') {
      throw new AppError('Cannot re-process a finalized or paid payroll cycle', 400);
    }

    // Update status to PROCESSING
    await prisma.payrollCycle.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        processedBy,
        processedAt: new Date(),
      },
    });

    try {
      // Get active employees for the organization
      let employees;
      const employeeInclude = {
        user: {
          select: { id: true, email: true },
        },
        salaries: {
          where: {
            isActive: true,
            effectiveDate: { lte: payrollCycle.periodEnd },
          },
          orderBy: { effectiveDate: 'desc' as const },
          take: 1,
        },
        location: {
          select: { name: true },
        },
      };

      if (data.employeeIds && data.employeeIds.length > 0) {
        employees = await prisma.employee.findMany({
          where: {
            id: { in: data.employeeIds },
            organizationId: payrollCycle.organizationId,
            employeeStatus: 'ACTIVE',
            deletedAt: null,
          },
          include: employeeInclude,
        });
      } else {
        employees = await prisma.employee.findMany({
          where: {
            organizationId: payrollCycle.organizationId,
            employeeStatus: 'ACTIVE',
            deletedAt: null,
          },
          include: employeeInclude,
        });
      }

      if (employees.length === 0) {
        throw new AppError('No active employees found for payroll processing', 400);
      }

      const periodStart = new Date(payrollCycle.periodStart);
      const periodEnd = new Date(payrollCycle.periodEnd);

      // Get tax regime from input or organization settings (default to NEW)
      const taxRegime = data.taxRegime || (payrollCycle.organization as any).settings?.taxRegime || 'NEW';

      // Get post_to_payroll_mappings for dynamic component names (OT, LOP, etc.)
      const attendanceMappings = await prisma.postToPayrollMapping.findMany({
        where: { organizationId: payrollCycle.organizationId },
        select: { columnKey: true, elementMapping: true },
        orderBy: { orderIndex: 'asc' },
      });

      // Load all VariableInput records for this payroll cycle (once, outside employee loop)
      const variableInputRecords = await prisma.variableInput.findMany({
        where: { payrollCycleId: payrollCycle.id },
      });
      const variableInputMap = new Map<string, any>(
        variableInputRecords.map((vi: any) => [vi.employeeId, vi])
      );

      // Load DB-driven statutory config for this financial year
      const fy = StatutoryConfigService.getFinancialYear(
        payrollCycle.payrollYear,
        payrollCycle.payrollMonth
      );
      const statutoryConfig = await statutoryConfigService.getFullConfig(fy);

      // Cache paygroup rules to avoid repeated DB queries for same paygroup
      const paygroupRulesCache = new Map<string, RuleForExecution[]>();

      // Process each employee
      const payslips: any[] = [];
      const esiEligibilityChanges: { employeeCode: string; employeeName: string; change: 'EXIT' | 'COMEBACK'; grossSalary: number }[] = [];
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      // ESI threshold from statutory config (₹21,000 default)
      const esiThreshold = statutoryConfig?.esi?.grossThreshold ?? 21000;

      for (const employee of employees) {
        // Skip if no active salary
        if (employee.salaries.length === 0) {
          continue;
        }

        const employeeSalary = employee.salaries[0];

        // Get salary structure components
        let salaryStructureComponents: SalaryComponent[] = [];
        if (employeeSalary.salaryStructureId) {
          const salaryStructure = await prisma.salaryStructure.findUnique({
            where: { id: employeeSalary.salaryStructureId },
          });
          if (salaryStructure) {
            salaryStructureComponents = (salaryStructure.components as any[]) as SalaryComponent[];
          }
        }

        // Prefer finalized/locked monthly attendance summary when period is a full calendar month
        const { attendance: attendanceData, leaves: leaveData } =
          await this.getAttendanceAndLeaveForPeriod(
            employee.id,
            payrollCycle.organizationId,
            periodStart,
            periodEnd,
            payrollCycle.payrollYear,
            payrollCycle.payrollMonth
          );

        // Merge variable input values if saved for this employee
        const vi = variableInputMap.get(employee.id);
        if (vi) {
          // Override attendance-based fields with manually entered values
          attendanceData.overtimeHours = Number(vi.otHours);
          attendanceData.holidayDays   = Number(vi.nfh);
          attendanceData.weekendDays   = Number(vi.weekOff);

          // Inject variable earnings as additional fixed components
          const varEarnings: { name: string; amount: number }[] = [
            { name: 'Compensation Salary', amount: Number(vi.compensationSalary) },
            { name: 'Vehicle Allowance',   amount: Number(vi.vehicleAllowance) },
            { name: 'Other Earnings',      amount: Number(vi.otherEarnings) },
            { name: 'Incentive',           amount: Number(vi.incentive) },
          ];
          const varDeductions: { name: string; amount: number }[] = [
            { name: 'Normal Tax',      amount: Number(vi.normalTax) },
            { name: 'Salary Advance',  amount: Number(vi.salaryAdvance) },
            { name: 'Other Deductions',amount: Number(vi.otherDeductions) },
            { name: 'PTAX',            amount: Number(vi.ptax) },
          ];

          for (const e of varEarnings) {
            if (e.amount > 0) {
              salaryStructureComponents.push({
                name: e.name,
                type: 'EARNING',
                calculationType: 'FIXED',
                value: e.amount,
                isTaxable: false,
                isStatutory: false,
                isFlat: true,
              });
            }
          }
          for (const d of varDeductions) {
            if (d.amount > 0) {
              salaryStructureComponents.push({
                name: d.name,
                type: 'DEDUCTION',
                calculationType: 'FIXED',
                value: d.amount,
                isTaxable: false,
                isStatutory: false,
                isFlat: true,
              });
            }
          }
        }

        // ── Rules Engine: Supplemental Integration ──────────────────────
        // Override DERIVED and CONDITIONAL component values from paygroup rules.
        // INPUT rules pass through unchanged. On failure, mark payslip with failure status.
        let componentsForCalc: any = employeeSalary.components;
        let rulesExecutionStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
        let rulesExecutionError: string | null = null;

        if (employee.paygroupId) {
          try {
            // Load rules (cached per paygroup to avoid repeated DB queries)
            let orderedRules = paygroupRulesCache.get(employee.paygroupId);
            if (!orderedRules) {
              orderedRules = await getOrderedRulesForPaygroup(
                payrollCycle.organizationId,
                employee.paygroupId
              );
              paygroupRulesCache.set(employee.paygroupId, orderedRules);
            }

            // Build context: map each INPUT rule's shortName → value from components JSON
            const compJson = (employeeSalary.components as Record<string, any>) || {};
            const rulesContext: Record<string, number> = {};
            for (const rule of orderedRules) {
              if (rule.inputType === 'INPUT') {
                // Exact key match first
                if (compJson[rule.shortName] !== undefined) {
                  rulesContext[rule.shortName] = Number(compJson[rule.shortName]) || 0;
                } else {
                  // Case-insensitive fallback
                  const match = Object.entries(compJson).find(
                    ([k]) => k.toLowerCase() === rule.shortName.toLowerCase()
                  );
                  rulesContext[rule.shortName] = match ? Number(match[1]) || 0 : 0;
                }
              }
            }

            // Evaluate all components (DERIVED/CONDITIONAL computed from formulas)
            const evaluated = evaluatePayrollComponents(orderedRules, rulesContext);

            // Override only DERIVED/CONDITIONAL values in components and salary structure
            componentsForCalc = { ...compJson };
            for (const rule of orderedRules) {
              if (
                rule.inputType !== 'DERIVED' &&
                rule.inputType !== 'SYSTEM_DERIVED' &&
                rule.inputType !== 'CONDITIONAL'
              ) {
                continue;
              }
              const computedValue = evaluated[rule.shortName] ?? 0;
              componentsForCalc[rule.shortName] = computedValue;

              // Ensure salaryStructureComponents includes this component
              const matchIdx = salaryStructureComponents.findIndex(
                (c) =>
                  (c.code || c.name).toLowerCase() === rule.shortName.toLowerCase() ||
                  c.name.toLowerCase() === rule.longName.toLowerCase()
              );
              if (matchIdx >= 0) {
                salaryStructureComponents[matchIdx].value = computedValue;
                salaryStructureComponents[matchIdx].calculationType = 'FIXED';
              } else {
                salaryStructureComponents.push({
                  name: rule.longName || rule.shortName,
                  code: rule.shortName,
                  type: rule.category as 'EARNING' | 'DEDUCTION',
                  calculationType: 'FIXED',
                  value: computedValue,
                  isTaxable: rule.category === 'EARNING',
                  isStatutory: false,
                });
              }
            }
            rulesExecutionStatus = 'SUCCESS';
          } catch (rulesError: any) {
            const errorMsg = rulesError?.message || String(rulesError);
            console.error(
              `[PayrollService] Rules Engine FAILED for employee ${employee.employeeCode} ` +
              `(paygroup ${employee.paygroupId}). Error: ${errorMsg}`
            );
            rulesExecutionStatus = 'FAILED';
            rulesExecutionError = errorMsg;
            componentsForCalc = employeeSalary.components;
          }
        }
        // ── End Rules Engine Integration ─────────────────────────────────

        // Prepare period data
        const periodData: EmployeePeriodData = {
          employeeId: employee.id,
          joiningDate: employee.dateOfJoining ? new Date(employee.dateOfJoining) : undefined,
          leavingDate: employee.deletedAt ? new Date(employee.deletedAt) : undefined,
          periodStart,
          periodEnd,
          attendance: attendanceData,
          leaves: leaveData,
        };

        // Resolve employee state for PT calculation
        const employeeState = (employee as any).location?.name || undefined;

        // Extract PAN number for TDS validation (Section 206AA)
        const taxInfo = (employee as any).taxInformation as Record<string, any> | null;
        const panNumber = taxInfo?.panNumber as string | undefined;

        // Calculate payroll using the calculation engine
        const calculation = PayrollCalculationEngine.calculatePayroll(
          {
            basicSalary: employeeSalary.basicSalary,
            grossSalary: employeeSalary.grossSalary,
            netSalary: employeeSalary.netSalary,
            components: componentsForCalc,
            currency: employeeSalary.currency,
            paymentFrequency: employeeSalary.paymentFrequency,
          },
          salaryStructureComponents,
          periodData,
          taxRegime as 'OLD' | 'NEW',
          payrollCycle.organizationId,
          attendanceMappings,
          employeeState,
          undefined, // taxDeclarations — to be populated from employee tax info
          undefined, // ytdTaxPaid — to be populated from YTD data
          payrollCycle.payrollMonth,
          statutoryConfig,
          panNumber
        );

        // Auto-deduct loan EMI from net salary if employee has active loans
        let loanEmiDeduction = 0;
        try {
          loanEmiDeduction = await loanService.getActiveEmiForPayroll(
            employee.id,
            payrollCycle.organizationId
          );
          if (loanEmiDeduction > 0) {
            // Cap EMI at available net salary so net never goes negative
            const availableNet = Math.max(0, (calculation as any).netSalary);
            const actualEmi = Math.min(loanEmiDeduction, availableNet);
            calculation.deductions.push({
              component: 'Loan EMI Recovery',
              amount: actualEmi,
              type: 'NON_STATUTORY',
            });
            calculation.totalDeductions += actualEmi;
            (calculation as any).netSalary = availableNet - actualEmi;
          }
        } catch {
          // Loan module may not be migrated yet — skip silently
        }

        // ── ESI Eligibility Change Detection ─────────────────────────────────
        // Compare current gross vs. previous month to detect ceiling crossings.
        try {
          const prevPeriodEnd = new Date(periodStart);
          prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
          const prevPayslip = await prisma.payslip.findFirst({
            where: { employeeId: employee.id, periodEnd: prevPeriodEnd },
            select: { grossSalary: true },
            orderBy: { createdAt: 'desc' },
          });
          if (prevPayslip) {
            const prevGross = Number(prevPayslip.grossSalary);
            const currGross = calculation.grossSalary;
            const wasEsiEligible = prevGross < esiThreshold;
            const isEsiEligible = currGross < esiThreshold;
            if (wasEsiEligible && !isEsiEligible) {
              esiEligibilityChanges.push({
                employeeCode: (employee as any).employeeCode || '',
                employeeName: `${(employee as any).firstName || ''} ${(employee as any).lastName || ''}`.trim(),
                change: 'EXIT',
                grossSalary: currGross,
              });
            } else if (!wasEsiEligible && isEsiEligible) {
              esiEligibilityChanges.push({
                employeeCode: (employee as any).employeeCode || '',
                employeeName: `${(employee as any).firstName || ''} ${(employee as any).lastName || ''}`.trim(),
                change: 'COMEBACK',
                grossSalary: currGross,
              });
            }
          }
        } catch {
          // Non-blocking — ESI tracking failure must not break payroll
        }

        // Calculate YTD totals for this employee
        const yearStart = new Date(periodEnd.getFullYear(), 0, 1);
        const previousPayslips = await prisma.payslip.findMany({
          where: {
            employeeId: employee.id,
            periodEnd: {
              lte: periodEnd,
              gte: yearStart,
            },
            status: {
              in: ['GENERATED', 'SENT', 'PAID'],
            },
          },
          select: {
            grossSalary: true,
            totalDeductions: true,
            netSalary: true,
            taxDetails: true,
          },
        });

        let ytdGross = 0;
        let ytdDeductions = 0;
        let ytdNet = 0;
        let ytdTax = 0;

        for (const prevPayslip of previousPayslips) {
          ytdGross += Number(prevPayslip.grossSalary);
          ytdDeductions += Number(prevPayslip.totalDeductions || 0);
          ytdNet += Number(prevPayslip.netSalary);

          if (prevPayslip.taxDetails) {
            const taxDetails = prevPayslip.taxDetails as any;
            if (taxDetails.totalTax) {
              ytdTax += Number(taxDetails.totalTax);
            } else if (taxDetails.incomeTax) {
              ytdTax += Number(taxDetails.incomeTax);
            }
          }
        }

        // Add current period to YTD
        ytdGross += calculation.grossSalary;
        ytdDeductions += calculation.totalDeductions;
        ytdNet += calculation.netSalary;

        if (calculation.taxDetails) {
          const taxDetails = calculation.taxDetails as any;
          if (taxDetails.totalTax) {
            ytdTax += Number(taxDetails.totalTax);
          } else if (taxDetails.incomeTax) {
            ytdTax += Number(taxDetails.incomeTax);
          }
        }

        // Collect payslip data for atomic batch write (transaction safety)
        payslips.push({
          payrollCycleId: id,
          employeeId: employee.id,
          employeeSalaryId: employeeSalary.id,
          periodStart,
          periodEnd,
          paymentDate: new Date(payrollCycle.paymentDate),
          basicSalary: calculation.basicSalary,
          earnings: calculation.earnings as any,
          deductions: calculation.deductions as any,
          grossSalary: calculation.grossSalary,
          totalDeductions: calculation.totalDeductions,
          netSalary: calculation.netSalary,
          attendanceDays: calculation.totalWorkingDays,
          paidDays: calculation.paidDays,
          unpaidDays: attendanceData.absentDays + leaveData.unpaidLeaveDays,
          overtimeHours: attendanceData.overtimeHours,
          taxDetails: calculation.taxDetails as any,
          statutoryDeductions: calculation.statutoryDeductions as any,
          ytdGrossSalary: ytdGross as any,
          ytdDeductions: ytdDeductions as any,
          ytdNetSalary: ytdNet as any,
          ytdTaxPaid: ytdTax as any,
          status: 'GENERATED',
          paymentMethod: 'BANK_TRANSFER',
          paymentStatus: 'PENDING',
          rulesExecutionStatus,
          rulesExecutionError,
        } as any);

        totalGross += calculation.grossSalary;
        totalDeductions += calculation.totalDeductions;
        totalNet += calculation.netSalary;
      }

      // Count rules failures for the cycle-level response
      const rulesFailedCount = (payslips as any[]).filter(
        (p: any) => p.rulesExecutionStatus === 'FAILED'
      ).length;

      // ── Atomic write: delete stale payslips + create new ones + update cycle ──
      // All in a single transaction so partial failures roll back completely.
      await prisma.$transaction(async (tx) => {
        // Remove any previously-generated payslips for this cycle (idempotent re-run)
        await tx.payslip.deleteMany({ where: { payrollCycleId: id } });

        // Create all payslips atomically
        for (const payslipData of payslips as any[]) {
          await tx.payslip.create({ data: payslipData });
        }

        // Update payroll cycle with totals and mark as PROCESSED
        await tx.payrollCycle.update({
          where: { id },
          data: {
            status: 'PROCESSED',
            totalEmployees: (payslips as any[]).length,
            totalGross,
            totalDeductions,
            totalNet,
          },
        });
      }, { timeout: 120000 }); // 2-min timeout for large orgs

      return {
        message: rulesFailedCount > 0
          ? `Payroll processed for ${payslips.length} employees. WARNING: ${rulesFailedCount} payslip(s) have Rules Engine failures — review before finalizing.`
          : `Payroll processed successfully for ${payslips.length} employees`,
        payslipsCount: payslips.length,
        rulesFailedCount,
        totalGross,
        totalDeductions,
        totalNet,
        // ESI compliance alerts — HR must file Form 10 (exit) or Form 12A (comeback)
        esiEligibilityChanges,
        esiComplianceAlert: esiEligibilityChanges.length > 0
          ? `${esiEligibilityChanges.length} employee(s) crossed the ESI wage ceiling. Please file the required ESIC forms (Form 10 for exits, Form 12A for comebacks).`
          : null,
      };
    } catch (error) {
      // Revert status on error
      await prisma.payrollCycle.update({
        where: { id },
        data: { status: 'DRAFT' },
      });
      throw error;
    }
  }

  /**
   * Get attendance and leave data for payroll. Uses finalized/locked MonthlyAttendanceSummary
   * when the period is a full calendar month and a summary exists; otherwise uses raw records.
   */
  private async getAttendanceAndLeaveForPeriod(
    employeeId: string,
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
    payrollYear: number,
    payrollMonth: number
  ): Promise<{ attendance: AttendanceData; leaves: LeaveData }> {
    const lastDayOfMonth = new Date(payrollYear, payrollMonth, 0);
    const isFullMonth =
      periodStart.getFullYear() === payrollYear &&
      periodStart.getMonth() === payrollMonth - 1 &&
      periodStart.getDate() === 1 &&
      periodEnd.getFullYear() === lastDayOfMonth.getFullYear() &&
      periodEnd.getMonth() === lastDayOfMonth.getMonth() &&
      periodEnd.getDate() === lastDayOfMonth.getDate();

    if (isFullMonth) {
      const summary = await prisma.monthlyAttendanceSummary.findUnique({
        where: {
          organizationId_employeeId_year_month: {
            organizationId,
            employeeId,
            year: payrollYear,
            month: payrollMonth,
          },
        },
        include: {
          leaveBreakdown: {
            include: { leaveType: { select: { id: true, name: true, isPaid: true } } },
          },
        },
      });
      if (
        summary &&
        (summary.status === 'FINALIZED' || summary.status === 'LOCKED')
      ) {
        // Always use a live leave query so that leaves approved after the summary
        // was built are still reflected in payroll (leaveBreakdown may be stale).
        const liveLeaves = await this.getLeaveData(employeeId, periodStart, periodEnd);
        return {
          attendance: {
            presentDays: summary.presentDays,
            absentDays: summary.absentDays,
            halfDays: summary.halfDays,
            holidayDays: summary.holidayDays,
            weekendDays: summary.weekendDays,
            overtimeHours: Number(summary.overtimeHours),
            totalWorkingDays: summary.totalWorkingDays,
          },
          leaves: liveLeaves,
        };
      }
    }

    const [attendance, leaves] = await Promise.all([
      this.getAttendanceData(employeeId, periodStart, periodEnd),
      this.getLeaveData(employeeId, periodStart, periodEnd),
    ]);
    return { attendance, leaves };
  }

  /**
   * Get attendance data for payroll period
   */
  private async getAttendanceData(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<AttendanceData> {
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const presentDays = attendanceRecords.filter(
      (r) => r.status === AttendanceStatus.PRESENT
    ).length;
    const absentDays = attendanceRecords.filter(
      (r) => r.status === AttendanceStatus.ABSENT
    ).length;
    const halfDays = attendanceRecords.filter(
      (r) => r.status === AttendanceStatus.HALF_DAY
    ).length;
    const holidayDays = attendanceRecords.filter(
      (r) => r.status === AttendanceStatus.HOLIDAY
    ).length;
    const weekendDays = attendanceRecords.filter(
      (r) => r.status === AttendanceStatus.WEEKEND
    ).length;
    const overtimeHours = attendanceRecords.reduce(
      (sum, r) => sum + (r.overtimeHours ? Number(r.overtimeHours) : 0),
      0
    );

    const totalWorkingDays = PayrollCalculationEngine.calculateWorkingDays(periodStart, periodEnd);

    return {
      presentDays,
      absentDays,
      halfDays,
      holidayDays,
      weekendDays,
      overtimeHours,
      totalWorkingDays,
    };
  }

  /**
   * Get leave data for payroll period
   */
  private async getLeaveData(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<LeaveData> {
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveStatus.APPROVED,
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            isPaid: true,
          },
        },
      },
    });

    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    const leaveDetails: Array<{ leaveType: string; days: number; isPaid: boolean }> = [];

    for (const leaveRequest of leaveRequests) {
      // Calculate overlapping days
      const overlapStart = leaveRequest.startDate > periodStart ? leaveRequest.startDate : periodStart;
      const overlapEnd = leaveRequest.endDate < periodEnd ? leaveRequest.endDate : periodEnd;
      
      // Calculate working days in overlap (excluding weekends)
      const overlapDays = PayrollCalculationEngine.calculateWorkingDays(
        new Date(overlapStart),
        new Date(overlapEnd)
      );

      const isPaid = leaveRequest.leaveType.isPaid;
      
      if (isPaid) {
        paidLeaveDays += overlapDays;
      } else {
        unpaidLeaveDays += overlapDays;
      }

      leaveDetails.push({
        leaveType: leaveRequest.leaveType.name,
        days: overlapDays,
        isPaid,
      });
    }

    return {
      paidLeaveDays,
      unpaidLeaveDays,
      leaveDetails,
    };
  }

  /**
   * Finalize payroll cycle (lock it to prevent modifications)
   */
  async finalizePayrollCycle(id: string, finalizedBy: string) {
    const payrollCycle = await prisma.payrollCycle.findUnique({
      where: { id },
      include: {
        payslips: {
          take: 1,
        },
      },
    });

    if (!payrollCycle) {
      throw new AppError('Payroll cycle not found', 404);
    }

    // Can only finalize if in PROCESSED status
    if (payrollCycle.status !== 'PROCESSED') {
      throw new AppError('Payroll cycle must be in PROCESSED status to finalize', 400);
    }

    // Check if payslips exist
    if (payrollCycle.payslips.length === 0) {
      throw new AppError('Cannot finalize payroll cycle with no payslips', 400);
    }

    // Finalize and lock the cycle
    const updated = await prisma.payrollCycle.update({
      where: { id },
      data: {
        status: 'FINALIZED' as any,
        isLocked: true as any,
        finalizedBy: finalizedBy as any,
        finalizedAt: new Date() as any,
      } as any,
    });

    await auditLogService.log({
      organizationId: payrollCycle.organizationId,
      entityType: 'PAYROLL_CYCLE',
      entityId: id,
      action: 'LOCK',
      previousValue: { status: payrollCycle.status },
      newValue: { status: 'FINALIZED', isLocked: true },
      changedBy: finalizedBy,
      remarks: 'Payroll cycle finalized and locked',
    });

    return updated;
  }

  /**
   * Rollback payroll cycle (unlock and revert to DRAFT status)
   */
  async rollbackPayrollCycle(id: string, _rollbackBy: string) {
    const payrollCycle = await prisma.payrollCycle.findUnique({
      where: { id },
    });

    if (!payrollCycle) {
      throw new AppError('Payroll cycle not found', 404);
    }

    // Can only rollback if in FINALIZED status
    if (payrollCycle.status !== 'FINALIZED') {
      throw new AppError('Payroll cycle must be in FINALIZED status to rollback', 400);
    }

    // Note: If status is FINALIZED, it cannot be PAID, so this check is redundant
    // But we keep it for clarity and future-proofing

    // Rollback to DRAFT status and unlock (allows Variable Input editing and re-processing)
    const updated = await prisma.payrollCycle.update({
      where: { id },
      data: {
        status: 'DRAFT' as any,
        isLocked: false as any,
        finalizedBy: null as any,
        finalizedAt: null as any,
      } as any,
    });

    await auditLogService.log({
      organizationId: payrollCycle.organizationId,
      entityType: 'PAYROLL_CYCLE',
      entityId: id,
      action: 'UNLOCK',
      previousValue: { status: 'FINALIZED', isLocked: true },
      newValue: { status: 'DRAFT', isLocked: false },
      changedBy: _rollbackBy,
      remarks: 'Payroll cycle rolled back to DRAFT',
    });

    return updated;
  }

  /**
   * Mark payroll cycle as paid
   */
  async markAsPaid(id: string, paidBy: string) {
    const payrollCycle = await prisma.payrollCycle.findUnique({
      where: { id },
    });

    if (!payrollCycle) {
      throw new AppError('Payroll cycle not found', 404);
    }

    // Can only mark as paid if finalized
    if (payrollCycle.status !== 'FINALIZED') {
      throw new AppError('Payroll cycle must be finalized before marking as paid', 400);
    }

    // Update all payslips to PAID status
    await prisma.payslip.updateMany({
      where: { payrollCycleId: id },
      data: {
        status: 'PAID',
        paymentStatus: 'COMPLETED',
      },
    });

    const updated = await prisma.payrollCycle.update({
      where: { id },
      data: {
        status: 'PAID',
        paidBy: paidBy as any,
        paidAt: new Date() as any,
      } as any,
    });

    await auditLogService.log({
      organizationId: payrollCycle.organizationId,
      entityType: 'PAYROLL_CYCLE',
      entityId: id,
      action: 'PAID',
      previousValue: { status: 'FINALIZED' },
      newValue: { status: 'PAID' },
      changedBy: paidBy,
      remarks: 'Payroll cycle marked as paid',
    });

    return updated;
  }

  /**
   * Delete payroll cycle (for testing: allows deletion of locked cycles too)
   */
  async delete(id: string) {
    const existing = await prisma.payrollCycle.findUnique({
      where: { id },
      include: {
        payslips: {
          select: { id: true },
        },
      },
    });

    if (!existing) {
      throw new AppError('Payroll cycle not found', 404);
    }

    // For testing: Allow deletion of all cycles except FINALIZED
    // FINALIZED cycles must be rolled back first
    if (existing.status === 'FINALIZED') {
      throw new AppError('Cannot delete payroll cycle that is FINALIZED. Use rollback first, then delete.', 400);
    }

    // For testing: Allow deletion even if locked (PAID cycles are locked)
    // No need to check isLocked - we allow deletion for testing purposes

    // Delete associated payslips first (if any)
    if (existing.payslips.length > 0) {
      await prisma.payslip.deleteMany({
        where: { payrollCycleId: id },
      });
    }

    // Delete the payroll cycle
    await prisma.payrollCycle.delete({
      where: { id },
    });

    return { message: 'Payroll cycle deleted successfully' };
  }

  /**
   * Pre-run checks before processing a payroll cycle.
   * Returns structured pass/warn/fail checks based on real DB state.
   */
  async preRunCheck(id: string) {
    const cycle = await prisma.payrollCycle.findUnique({ where: { id } });
    if (!cycle) throw new AppError('Payroll cycle not found', 404);

    const orgId = cycle.organizationId;
    const periodStart = new Date(cycle.periodStart);

    // Fetch active employees with their latest salary
    const employees = await prisma.employee.findMany({
      where: { organizationId: orgId, employeeStatus: 'ACTIVE', deletedAt: null },
      include: {
        salaries: {
          where: { isActive: true, effectiveDate: { lte: cycle.periodEnd } },
          orderBy: { effectiveDate: 'desc' },
          take: 1,
        },
      },
    });

    const checks = [];

    // 1. Employees missing salary structure
    const missingStructure = employees.filter((e) => !e.salaries[0]?.salaryStructureId).length;
    checks.push({
      label: 'Salary Structures',
      status: missingStructure === 0 ? 'pass' : missingStructure <= 3 ? 'warn' : 'fail',
      detail:
        missingStructure === 0
          ? `All ${employees.length} employee(s) have salary structures`
          : `${missingStructure} employee(s) missing salary structure`,
    });

    // 2. Attendance / Post-to-Payroll posted
    const attendanceCount = await prisma.monthlyAttendanceSummary.count({
      where: {
        organizationId: orgId,
        month: periodStart.getMonth() + 1,
        year: periodStart.getFullYear(),
      },
    });
    checks.push({
      label: 'Attendance Posted',
      status: attendanceCount > 0 ? 'pass' : 'warn',
      detail:
        attendanceCount > 0
          ? `Attendance data available (${attendanceCount} record(s))`
          : 'No attendance summary found — payroll will use 0 LOP',
    });

    // 3. Employees missing bank accounts
    const bankRecords = await prisma.employeeBankAccount.findMany({
      where: { employee: { organizationId: orgId, employeeStatus: 'ACTIVE', deletedAt: null } },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });
    const employeesWithBank = new Set(bankRecords.map((b) => b.employeeId));
    const missingBank = employees.filter((e) => !employeesWithBank.has(e.id)).length;
    checks.push({
      label: 'Bank Accounts',
      status: missingBank === 0 ? 'pass' : 'warn',
      detail:
        missingBank === 0
          ? 'All employees have bank accounts configured'
          : `${missingBank} employee(s) missing bank account`,
    });

    // 4. Duplicate active cycles for the same period
    const duplicates = await prisma.payrollCycle.count({
      where: {
        organizationId: orgId,
        id: { not: id },
        status: { in: ['DRAFT', 'PROCESSING'] },
        periodStart: { lte: cycle.periodEnd },
        periodEnd: { gte: cycle.periodStart },
      },
    });
    checks.push({
      label: 'Duplicate Active Cycles',
      status: duplicates === 0 ? 'pass' : 'warn',
      detail:
        duplicates === 0
          ? 'No conflicting active cycles for this period'
          : `${duplicates} other active cycle(s) overlap this period`,
    });

    return { checks, employeeCount: employees.length };
  }
}

export const payrollService = new PayrollService();
