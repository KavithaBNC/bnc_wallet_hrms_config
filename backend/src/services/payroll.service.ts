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
import { type SalaryComponent } from '../utils/salary-components';

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

    if (payrollCycle.status === 'PAID') {
      throw new AppError('Cannot process payroll cycle that is already paid', 400);
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
      if (data.employeeIds && data.employeeIds.length > 0) {
        employees = await prisma.employee.findMany({
          where: {
            id: { in: data.employeeIds },
            organizationId: payrollCycle.organizationId,
            employeeStatus: 'ACTIVE',
            deletedAt: null,
          },
          include: {
            user: {
              select: { id: true, email: true },
            },
            salaries: {
              where: {
                isActive: true,
                effectiveDate: { lte: payrollCycle.periodEnd },
              },
              orderBy: { effectiveDate: 'desc' },
              take: 1,
            },
          },
        });
      } else {
        employees = await prisma.employee.findMany({
          where: {
            organizationId: payrollCycle.organizationId,
            employeeStatus: 'ACTIVE',
            deletedAt: null,
          },
          include: {
            user: {
              select: { id: true, email: true },
            },
            salaries: {
              where: {
                isActive: true,
                effectiveDate: { lte: payrollCycle.periodEnd },
              },
              orderBy: { effectiveDate: 'desc' },
              take: 1,
            },
          },
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

      // Process each employee
      const payslips = [];
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

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

        // Calculate payroll using the calculation engine
        const calculation = PayrollCalculationEngine.calculatePayroll(
          {
            basicSalary: employeeSalary.basicSalary,
            grossSalary: employeeSalary.grossSalary,
            netSalary: employeeSalary.netSalary,
            components: employeeSalary.components,
            currency: employeeSalary.currency,
            paymentFrequency: employeeSalary.paymentFrequency,
          },
          salaryStructureComponents,
          periodData,
          taxRegime as 'OLD' | 'NEW',
          payrollCycle.organizationId,
          attendanceMappings
        );

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

        // Create payslip with YTD totals
        const payslip = await prisma.payslip.create({
          data: {
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
            attendanceDays: calculation.totalWorkingDays, // Total working days in period
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
          } as any,
        });

        payslips.push(payslip);
        totalGross += calculation.grossSalary;
        totalDeductions += calculation.totalDeductions;
        totalNet += calculation.netSalary;
      }

      // Update payroll cycle with totals and mark as PROCESSED
      await prisma.payrollCycle.update({
        where: { id },
        data: {
          status: 'PROCESSED',
          totalEmployees: payslips.length,
          totalGross,
          totalDeductions,
          totalNet,
        },
      });

      return {
        message: `Payroll processed successfully for ${payslips.length} employees`,
        payslipsCount: payslips.length,
        totalGross,
        totalDeductions,
        totalNet,
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
        let paidLeaveDays = 0;
        let unpaidLeaveDays = 0;
        const leaveDetails: Array<{ leaveType: string; days: number; isPaid: boolean }> = [];
        for (const row of summary.leaveBreakdown) {
          const days = Number(row.days);
          if (row.isPaid) paidLeaveDays += days;
          else unpaidLeaveDays += days;
          leaveDetails.push({
            leaveType: row.leaveType.name,
            days,
            isPaid: row.isPaid,
          });
        }
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
          leaves: {
            paidLeaveDays,
            unpaidLeaveDays,
            leaveDetails,
          },
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

    return updated;
  }

  /**
   * Rollback payroll cycle (unlock and revert to PROCESSED status)
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

    // Rollback to PROCESSED status and unlock
    const updated = await prisma.payrollCycle.update({
      where: { id },
      data: {
        status: 'PROCESSED' as any,
        isLocked: false as any,
        finalizedBy: null as any,
        finalizedAt: null as any,
      } as any,
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
}

export const payrollService = new PayrollService();
