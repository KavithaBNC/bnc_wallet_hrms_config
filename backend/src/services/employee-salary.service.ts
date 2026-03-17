import { AppError } from '../middlewares/errorHandler';
import {
  CreateEmployeeSalaryInput,
  UpdateEmployeeSalaryInput,
  QueryEmployeeSalariesInput,
  CreateBankAccountInput,
  UpdateBankAccountInput,
  CreateEmployeeSalaryEnhancedInput,
} from '../utils/payroll.validation';
import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { auditLogService } from './audit-log.service';

/** Check whether the active payroll cycle for an employee's org is locked/finalized. */
async function checkPayrollLock(employeeId: string): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { organizationId: true },
  });
  if (!employee) return;
  const lockedCycle = await prisma.payrollCycle.findFirst({
    where: {
      organizationId: employee.organizationId,
      isLocked: true,
    },
    orderBy: { periodEnd: 'desc' },
  });
  if (lockedCycle) {
    throw new AppError(
      `Salary cannot be modified while payroll cycle "${lockedCycle.name}" is locked/finalized. Rollback the payroll first.`,
      400
    );
  }
}

export class EmployeeSalaryService {
  /**
   * Create employee salary
   */
  async createSalary(data: CreateEmployeeSalaryInput) {
    // Check payroll lock before any modification
    await checkPayrollLock(data.employeeId);

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    // Verify salary structure if provided
    if (data.salaryStructureId) {
      const structure = await prisma.salaryStructure.findUnique({
        where: { id: data.salaryStructureId },
      });

      if (!structure) {
        throw new AppError('Salary structure not found', 404);
      }

      if (structure.organizationId !== employee.organizationId) {
        throw new AppError('Salary structure does not belong to the same organization', 400);
      }
    }

    // Verify bank account if provided
    if (data.bankAccountId) {
      const bankAccount = await prisma.employeeBankAccount.findUnique({
        where: { id: data.bankAccountId },
      });

      if (!bankAccount) {
        throw new AppError('Bank account not found', 404);
      }

      if (bankAccount.employeeId !== data.employeeId) {
        throw new AppError('Bank account does not belong to this employee', 400);
      }
    }

    // Deactivate existing active salary
    await prisma.employeeSalary.updateMany({
      where: {
        employeeId: data.employeeId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    const salary = await prisma.employeeSalary.create({
      data: {
        employeeId: data.employeeId,
        salaryStructureId: data.salaryStructureId,
        effectiveDate: new Date(data.effectiveDate),
        basicSalary: data.basicSalary,
        grossSalary: data.grossSalary,
        netSalary: data.netSalary,
        components: data.components || {},
        currency: data.currency,
        paymentFrequency: data.paymentFrequency,
        bankAccountId: data.bankAccountId,
        isActive: data.isActive ?? true,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        salaryStructure: {
          select: {
            id: true,
            name: true,
          },
        },
        bankAccount: {
          select: {
            id: true,
            bankName: true,
            accountType: true,
          },
        },
      },
    });

    // Audit log
    await auditLogService.log({
      organizationId: employee.organizationId,
      entityType: 'EMPLOYEE_SALARY',
      entityId: salary.id,
      action: 'CREATE',
      newValue: { basicSalary: data.basicSalary, grossSalary: data.grossSalary, netSalary: data.netSalary, effectiveDate: data.effectiveDate },
    });

    return salary;
  }

  /**
   * Create employee salary with enhanced features (CTC, revision history, template support)
   */
  async createSalaryEnhanced(data: CreateEmployeeSalaryEnhancedInput, createdBy?: string) {
    // Check payroll lock before any modification
    await checkPayrollLock(data.employeeId);

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    let salaryStructureId: string | undefined = data.salaryStructureId;
    let components = data.components || {};
    let ctc = data.ctc;
    let ctcBreakdown = data.ctcBreakdown;

    // If salary template is provided, use it to populate data
    if (data.salaryTemplateId) {
      const template = await prisma.salaryTemplate.findUnique({
        where: { id: data.salaryTemplateId },
      });

      if (!template) {
        throw new AppError('Salary template not found', 404);
      }

      if (template.organizationId !== employee.organizationId) {
        throw new AppError('Salary template does not belong to the same organization', 400);
      }

      // Use template data
      salaryStructureId = template.salaryStructureId;
      components = template.components as any;
      ctc = ctc || Number(template.ctc);
      
      // Calculate CTC breakdown if not provided
      if (!ctcBreakdown) {
        const gross = Number(template.grossSalary);
        const employerContributions = ctc ? Number(ctc) - gross : 0;
        ctcBreakdown = {
          grossSalary: gross,
          employerPF: employerContributions * 0.12, // Example: 12% employer PF
          employerESI: employerContributions * 0.035, // Example: 3.5% employer ESI
          gratuity: employerContributions * 0.048, // Example: 4.8% gratuity
          otherBenefits: employerContributions - (employerContributions * 0.12) - (employerContributions * 0.035) - (employerContributions * 0.048),
          totalCTC: ctc || gross,
        };
      }
    } else if (data.salaryStructureId) {
      // Verify salary structure if provided
      const structure = await prisma.salaryStructure.findUnique({
        where: { id: data.salaryStructureId },
      });

      if (!structure) {
        throw new AppError('Salary structure not found', 404);
      }

      if (structure.organizationId !== employee.organizationId) {
        throw new AppError('Salary structure does not belong to the same organization', 400);
      }
    }

    // Verify bank account if provided
    if (data.bankAccountId) {
      const bankAccount = await prisma.employeeBankAccount.findUnique({
        where: { id: data.bankAccountId },
      });

      if (!bankAccount) {
        throw new AppError('Bank account not found', 404);
      }

      if (bankAccount.employeeId !== data.employeeId) {
        throw new AppError('Bank account does not belong to this employee', 400);
      }
    }

    // End date existing active salary for revision history
    const existingActive = await prisma.employeeSalary.findFirst({
      where: {
        employeeId: data.employeeId,
        isActive: true,
      },
    });

    if (existingActive) {
      await prisma.employeeSalary.update({
        where: { id: existingActive.id },
        data: {
          isActive: false,
          endDate: new Date(data.effectiveDate), // Set end date to new salary's effective date
        },
      });
    }

    const salary = await prisma.employeeSalary.create({
      data: {
        employeeId: data.employeeId,
        salaryStructureId,
        effectiveDate: new Date(data.effectiveDate),
        basicSalary: new Prisma.Decimal(data.basicSalary),
        grossSalary: new Prisma.Decimal(data.grossSalary),
        netSalary: new Prisma.Decimal(data.netSalary),
        ctc: ctc ? new Prisma.Decimal(ctc) : null,
        components: components as any,
        ctcBreakdown: ctcBreakdown as any,
        revisionReason: data.revisionReason,
        currency: data.currency,
        paymentFrequency: data.paymentFrequency,
        bankAccountId: data.bankAccountId,
        isActive: data.isActive ?? true,
        createdBy: createdBy,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        salaryStructure: {
          select: {
            id: true,
            name: true,
          },
        },
        bankAccount: {
          select: {
            id: true,
            bankName: true,
            accountType: true,
          },
        },
      },
    });

    // Audit log for enhanced salary creation
    await auditLogService.log({
      organizationId: employee.organizationId,
      entityType: 'EMPLOYEE_SALARY',
      entityId: salary.id,
      action: 'CREATE',
      newValue: {
        basicSalary: data.basicSalary,
        grossSalary: data.grossSalary,
        netSalary: data.netSalary,
        ctc: data.ctc,
        effectiveDate: data.effectiveDate,
        revisionReason: data.revisionReason,
        templateId: data.salaryTemplateId,
      },
      changedBy: createdBy,
    });

    return salary;
  }

  /**
   * Get salary revision history for an employee
   */
  async getSalaryHistory(employeeId: string) {
    const salaries = await prisma.employeeSalary.findMany({
      where: { employeeId },
      orderBy: { effectiveDate: 'desc' },
      include: {
        salaryStructure: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return salaries;
  }

  /**
   * Get all employee salaries with filtering
   */
  async getAllSalaries(query: QueryEmployeeSalariesInput) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.organizationId) {
      where.employee = {
        organizationId: query.organizationId,
      };
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true' || query.isActive === '1';
    }

    const [salaries, total] = await Promise.all([
      prisma.employeeSalary.findMany({
        where,
        skip,
        take: limit,
        orderBy: { effectiveDate: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
          salaryStructure: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.employeeSalary.count({ where }),
    ]);

    return {
      data: salaries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get employee salary by ID
   */
  async getSalaryById(id: string) {
    const salary = await prisma.employeeSalary.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            email: true,
          },
        },
        salaryStructure: true,
        bankAccount: true,
      },
    });

    if (!salary) {
      throw new AppError('Employee salary not found', 404);
    }

    return salary;
  }

  /**
   * Get current active salary for employee
   */
  async getCurrentSalary(employeeId: string) {
    const salary = await prisma.employeeSalary.findFirst({
      where: {
        employeeId,
        isActive: true,
      },
      include: {
        salaryStructure: true,
        bankAccount: true,
      },
      orderBy: { effectiveDate: 'desc' },
    });

    if (!salary) {
      throw new AppError('No active salary found for employee', 404);
    }

    return salary;
  }

  /**
   * Apply increment from Transfer & Promotion: create new salary record with updated gross
   * (fixed gross = current + increment). Previous salary is deactivated so history is preserved.
   * Employee form salary details tab will show new salary as current; past salaries remain in list.
   */
  async applyIncrementFromTransferPromotion(
    employeeId: string,
    effectiveDate: string,
    totalIncrement: number
  ) {
    if (totalIncrement <= 0) return null;
    let current;
    try {
      current = await this.getCurrentSalary(employeeId);
    } catch {
      return null; // No active salary – skip applying increment
    }
    const currentGross = Number(current.grossSalary);
    const currentBasic = Number(current.basicSalary);
    const currentNet = Number(current.netSalary);
    const newGross = currentGross + totalIncrement;
    const newBasic = currentBasic + totalIncrement; // simplified: add full increment to basic
    const newNet = currentNet + totalIncrement; // simplified: add full increment to net
    await prisma.employeeSalary.updateMany({
      where: { employeeId, isActive: true },
      data: { isActive: false },
    });
    const salary = await prisma.employeeSalary.create({
      data: {
        employeeId,
        salaryStructureId: current.salaryStructureId,
        effectiveDate: new Date(effectiveDate),
        basicSalary: new Prisma.Decimal(newBasic),
        grossSalary: new Prisma.Decimal(newGross),
        netSalary: new Prisma.Decimal(newNet),
        components: (current.components as object) || {},
        currency: current.currency,
        paymentFrequency: current.paymentFrequency,
        bankAccountId: current.bankAccountId,
        isActive: true,
      },
    });
    return salary;
  }

  /**
   * Update employee salary
   */
  async updateSalary(id: string, data: UpdateEmployeeSalaryInput) {
    const existing = await prisma.employeeSalary.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Employee salary not found', 404);
    }

    const updateData: any = {};

    if (data.salaryStructureId) updateData.salaryStructureId = data.salaryStructureId;
    if (data.effectiveDate) updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.basicSalary !== undefined) updateData.basicSalary = data.basicSalary;
    if (data.grossSalary !== undefined) updateData.grossSalary = data.grossSalary;
    if (data.netSalary !== undefined) updateData.netSalary = data.netSalary;
    if (data.components) updateData.components = data.components;
    if (data.currency) updateData.currency = data.currency;
    if (data.paymentFrequency) updateData.paymentFrequency = data.paymentFrequency;
    if (data.bankAccountId) updateData.bankAccountId = data.bankAccountId;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.employeeSalary.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        salaryStructure: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Create bank account for employee
   */
  async createBankAccount(data: CreateBankAccountInput) {
    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    // If this is set as primary, unset other primary accounts
    if (data.isPrimary) {
      await prisma.employeeBankAccount.updateMany({
        where: {
          employeeId: data.employeeId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const bankAccount = await prisma.employeeBankAccount.create({
      data: {
        employeeId: data.employeeId,
        bankName: data.bankName,
        accountNumber: data.accountNumber, // In production, encrypt this
        routingNumber: data.routingNumber,
        accountType: data.accountType,
        isPrimary: data.isPrimary ?? false,
        isActive: data.isActive ?? true,
      },
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
    });

    return bankAccount;
  }

  /**
   * Get bank accounts for employee
   */
  async getBankAccounts(employeeId: string) {
    const bankAccounts = await prisma.employeeBankAccount.findMany({
      where: {
        employeeId,
        isActive: true,
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return bankAccounts;
  }

  /**
   * Update bank account
   */
  async updateBankAccount(id: string, data: UpdateBankAccountInput) {
    const existing = await prisma.employeeBankAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Bank account not found', 404);
    }

    // If setting as primary, unset other primary accounts
    if (data.isPrimary) {
      await prisma.employeeBankAccount.updateMany({
        where: {
          employeeId: existing.employeeId,
          isPrimary: true,
          id: { not: id },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const updateData: any = {};
    if (data.bankName) updateData.bankName = data.bankName;
    if (data.accountNumber) updateData.accountNumber = data.accountNumber; // In production, encrypt
    if (data.routingNumber !== undefined) updateData.routingNumber = data.routingNumber;
    if (data.accountType) updateData.accountType = data.accountType;
    if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.employeeBankAccount.update({
      where: { id },
      data: updateData,
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
    });

    return updated;
  }

  /**
   * Delete bank account
   */
  async deleteBankAccount(id: string) {
    const existing = await prisma.employeeBankAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Bank account not found', 404);
    }

    // Check if it's being used in any active salary
    const salaryUsingAccount = await prisma.employeeSalary.findFirst({
      where: {
        bankAccountId: id,
        isActive: true,
      },
    });

    if (salaryUsingAccount) {
      throw new AppError('Cannot delete bank account that is assigned to an active salary', 400);
    }

    await prisma.employeeBankAccount.delete({
      where: { id },
    });

    return { message: 'Bank account deleted successfully' };
  }
}

export const employeeSalaryService = new EmployeeSalaryService();
