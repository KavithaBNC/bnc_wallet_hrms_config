import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';
import type { CreateLoanInput, QueryLoanInput, RecordRepaymentInput } from '../utils/loan.validation';

/**
 * Loan & Advance Service
 *
 * Manages employee loans and salary advances including:
 * - Loan creation, approval, and disbursement
 * - EMI-based repayment tracking
 * - Auto-recovery integration with payroll and F&F settlement
 */
export class LoanService {
  /**
   * Create a new loan/advance request
   */
  async create(data: CreateLoanInput) {
    // Validate employee belongs to organization
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, organizationId: data.organizationId },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
    });
    if (!employee) {
      throw new AppError('Employee not found in this organization', 404);
    }

    // Compute EMI defaults
    const totalEmis = data.totalEmis ?? 1;
    const emiAmount = data.emiAmount ?? data.loanAmount / totalEmis;

    const loan = await prisma.employeeLoan.create({
      data: {
        organizationId: data.organizationId,
        employeeId: data.employeeId,
        loanType: data.loanType as any,
        loanAmount: new Prisma.Decimal(data.loanAmount.toFixed(2)),
        disbursedAmount: new Prisma.Decimal('0'),
        pendingAmount: new Prisma.Decimal(data.loanAmount.toFixed(2)),
        emiAmount: new Prisma.Decimal(emiAmount.toFixed(2)),
        totalEmis,
        paidEmis: 0,
        interestRate: data.interestRate != null ? new Prisma.Decimal(data.interestRate.toFixed(2)) : null,
        startDate: new Date(data.startDate),
        reason: data.reason ?? null,
        status: 'PENDING',
      } as any,
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true },
        },
      },
    });

    return loan;
  }

  /**
   * Get all loans for an organization with pagination and filtering
   */
  async getAll(query: QueryLoanInput) {
    const page = parseInt(query.page ?? '1');
    const limit = parseInt(query.limit ?? '10');
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeLoanWhereInput = {
      organizationId: query.organizationId,
    };

    if (query.status) where.status = query.status as any;
    if (query.loanType) where.loanType = query.loanType as any;
    if (query.employeeId) where.employeeId = query.employeeId;

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
      prisma.employeeLoan.findMany({
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
              department: { select: { name: true } },
            },
          },
        },
      }),
      prisma.employeeLoan.count({ where }),
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
   * Get loan by ID with repayment history
   */
  async getById(id: string, organizationId: string) {
    const loan = await prisma.employeeLoan.findUnique({
      where: { id },
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
        repayments: {
          orderBy: { repaymentDate: 'desc' },
        },
      },
    });

    if (!loan) throw new AppError('Loan not found', 404);
    if (loan.organizationId !== organizationId) {
      throw new AppError('Loan does not belong to this organization', 400);
    }

    return loan;
  }

  /**
   * Approve a pending loan
   */
  async approve(id: string, organizationId: string, approvedBy: string) {
    const loan = await prisma.employeeLoan.findUnique({ where: { id } });
    if (!loan) throw new AppError('Loan not found', 404);
    if (loan.organizationId !== organizationId) {
      throw new AppError('Loan does not belong to this organization', 400);
    }
    if (loan.status !== 'PENDING') {
      throw new AppError(`Cannot approve a loan with status: ${loan.status}`, 400);
    }

    return prisma.employeeLoan.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      } as any,
    });
  }

  /**
   * Disburse an approved loan (mark as ACTIVE)
   */
  async disburse(id: string, organizationId: string) {
    const loan = await prisma.employeeLoan.findUnique({ where: { id } });
    if (!loan) throw new AppError('Loan not found', 404);
    if (loan.organizationId !== organizationId) {
      throw new AppError('Loan does not belong to this organization', 400);
    }
    if (loan.status !== 'APPROVED') {
      throw new AppError('Only approved loans can be disbursed', 400);
    }

    return prisma.employeeLoan.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        disbursedAmount: loan.loanAmount,
        disbursedDate: new Date(),
      },
    });
  }

  /**
   * Reject a pending loan
   */
  async reject(id: string, organizationId: string) {
    const loan = await prisma.employeeLoan.findUnique({ where: { id } });
    if (!loan) throw new AppError('Loan not found', 404);
    if (loan.organizationId !== organizationId) {
      throw new AppError('Loan does not belong to this organization', 400);
    }
    if (loan.status !== 'PENDING') {
      throw new AppError('Only pending loans can be rejected', 400);
    }

    return prisma.employeeLoan.update({
      where: { id },
      data: { status: 'REJECTED' } as any,
    });
  }

  /**
   * Record a repayment for an active loan
   * Automatically closes the loan when pendingAmount reaches 0
   */
  async recordRepayment(loanId: string, organizationId: string, data: RecordRepaymentInput) {
    const loan = await prisma.employeeLoan.findUnique({ where: { id: loanId } });
    if (!loan) throw new AppError('Loan not found', 404);
    if (loan.organizationId !== organizationId) {
      throw new AppError('Loan does not belong to this organization', 400);
    }
    if (loan.status !== 'ACTIVE') {
      throw new AppError('Repayments can only be recorded for active loans', 400);
    }

    const repaymentAmount = data.amount;
    const currentPending = Number(loan.pendingAmount);

    if (repaymentAmount > currentPending) {
      throw new AppError(
        `Repayment amount (₹${repaymentAmount}) exceeds pending amount (₹${currentPending})`,
        400
      );
    }

    const newPendingAmount = currentPending - repaymentAmount;
    const newPaidEmis = loan.paidEmis + 1;
    const newStatus = newPendingAmount <= 0 ? 'CLOSED' : 'ACTIVE';

    // Create repayment record and update loan in a transaction
    const [repayment] = await prisma.$transaction([
      prisma.loanRepayment.create({
        data: {
          loanId,
          payrollCycleId: data.payrollCycleId ?? null,
          amount: new Prisma.Decimal(repaymentAmount.toFixed(2)),
          principalAmount: new Prisma.Decimal((data.principalAmount ?? repaymentAmount).toFixed(2)),
          interestAmount: new Prisma.Decimal((data.interestAmount ?? 0).toFixed(2)),
          repaymentDate: new Date(data.repaymentDate),
          status: 'PAID',
        },
      }),
      prisma.employeeLoan.update({
        where: { id: loanId },
        data: {
          pendingAmount: new Prisma.Decimal(newPendingAmount.toFixed(2)),
          paidEmis: newPaidEmis,
          status: newStatus as any,
          endDate: newStatus === 'CLOSED' ? new Date() : loan.endDate,
        },
      }),
    ]);

    return {
      repayment,
      loanClosed: newStatus === 'CLOSED',
      remainingAmount: newPendingAmount,
    };
  }

  /**
   * Get all active/approved loans with pending amounts for an employee
   * Used by F&F settlement to calculate total recovery amount
   */
  async getPendingLoansForEmployee(employeeId: string, organizationId: string) {
    return prisma.employeeLoan.findMany({
      where: {
        employeeId,
        organizationId,
        status: { in: ['ACTIVE', 'APPROVED'] },
        pendingAmount: { gt: 0 },
      },
      select: {
        id: true,
        loanType: true,
        loanAmount: true,
        pendingAmount: true,
        emiAmount: true,
        startDate: true,
      },
    });
  }

  /**
   * Get total EMI amount due for the current month across all active loans
   * Used by payroll engine to auto-deduct loan EMIs from salary
   */
  async getActiveEmiForPayroll(employeeId: string, organizationId: string): Promise<number> {
    const activeLoans = await prisma.employeeLoan.findMany({
      where: {
        employeeId,
        organizationId,
        status: 'ACTIVE',
        pendingAmount: { gt: 0 },
      },
      select: {
        emiAmount: true,
        pendingAmount: true,
      },
    });

    return activeLoans.reduce((total, loan) => {
      // EMI cannot exceed remaining pending amount
      const emi = Math.min(Number(loan.emiAmount), Number(loan.pendingAmount));
      return total + emi;
    }, 0);
  }
}

export const loanService = new LoanService();
