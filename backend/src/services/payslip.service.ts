import { AppError } from '../middlewares/errorHandler';
import {
  QueryPayslipsInput,
  UpdatePayslipInput,
} from '../utils/payroll.validation';
import { prisma } from '../utils/prisma';
import { pdfService } from './pdf.service';
import { sendPayslipEmail } from '../utils/mailer';

export class PayslipService {
  /**
   * Get all payslips with filtering and pagination
   */
  async getAll(query: QueryPayslipsInput) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.payrollCycleId) {
      where.payrollCycleId = query.payrollCycleId;
    }

    if (query.organizationId) {
      where.employee = {
        organizationId: query.organizationId,
      };
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

    const [payslips, total] = await Promise.all([
      prisma.payslip.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
          payrollCycle: {
            select: {
              id: true,
              name: true,
              periodStart: true,
              periodEnd: true,
              paymentDate: true,
            },
          },
          employeeSalary: {
            select: {
              id: true,
              basicSalary: true,
              grossSalary: true,
            },
          },
        },
      }),
      prisma.payslip.count({ where }),
    ]);

    return {
      data: payslips,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Calculate YTD totals for an employee up to a given date
   */
  async calculateYTD(employeeId: string, periodEnd: Date) {
    const yearStart = new Date(periodEnd.getFullYear(), 0, 1); // January 1st of the year

    const payslips = await prisma.payslip.findMany({
      where: {
        employeeId,
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

    for (const payslip of payslips) {
      ytdGross += Number(payslip.grossSalary);
      ytdDeductions += Number(payslip.totalDeductions || 0);
      ytdNet += Number(payslip.netSalary);

      // Extract tax from taxDetails if available
      if (payslip.taxDetails) {
        const taxDetails = payslip.taxDetails as any;
        if (taxDetails.totalTax) {
          ytdTax += Number(taxDetails.totalTax);
        } else if (taxDetails.incomeTax) {
          ytdTax += Number(taxDetails.incomeTax);
        }
      }
    }

    return {
      ytdGrossSalary: ytdGross,
      ytdDeductions,
      ytdNetSalary: ytdNet,
      ytdTaxPaid: ytdTax,
    };
  }

  /**
   * Get payslip by ID with comprehensive details including bank info and YTD
   */
  async getById(id: string) {
    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            email: true,
            phone: true,
            department: {
              select: { id: true, name: true },
            },
            position: {
              select: { id: true, title: true },
            },
          },
        },
        payrollCycle: {
          select: {
            id: true,
            name: true,
            periodStart: true,
            periodEnd: true,
            paymentDate: true,
            status: true,
          },
        },
        employeeSalary: {
          select: {
            id: true,
            basicSalary: true,
            grossSalary: true,
            netSalary: true,
            currency: true,
            paymentFrequency: true,
            components: true,
            bankAccount: {
              select: {
                id: true,
                bankName: true,
                accountNumber: true,
                routingNumber: true,
                accountType: true,
                isPrimary: true,
              },
            },
          },
        },
      },
    });

    if (!payslip) {
      throw new AppError('Payslip not found', 404);
    }

    // Calculate YTD if not already stored
    const payslipAny = payslip as any;
    let ytdTotals = {
      ytdGrossSalary: payslipAny.ytdGrossSalary ? Number(payslipAny.ytdGrossSalary) : null,
      ytdDeductions: payslipAny.ytdDeductions ? Number(payslipAny.ytdDeductions) : null,
      ytdNetSalary: payslipAny.ytdNetSalary ? Number(payslipAny.ytdNetSalary) : null,
      ytdTaxPaid: payslipAny.ytdTaxPaid ? Number(payslipAny.ytdTaxPaid) : null,
    };

    // If YTD not stored, calculate it
    if (!ytdTotals.ytdGrossSalary) {
      const calculatedYTD = await this.calculateYTD(payslip.employeeId, payslip.periodEnd);
      ytdTotals = calculatedYTD;
    }

    return {
      ...payslip,
      ytdTotals,
    };
  }

  /**
   * Get payslips for an employee
   */
  async getByEmployeeId(employeeId: string, query: { page?: string; limit?: string }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const [payslips, total] = await Promise.all([
      prisma.payslip.findMany({
        where: { employeeId },
        skip,
        take: limit,
        orderBy: { periodStart: 'desc' },
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
          payrollCycle: {
            select: {
              id: true,
              name: true,
              periodStart: true,
              periodEnd: true,
              paymentDate: true,
            },
          },
        },
      }),
      prisma.payslip.count({ where: { employeeId } }),
    ]);

    return {
      data: payslips,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update payslip
   */
  async update(id: string, data: UpdatePayslipInput) {
    const existing = await prisma.payslip.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Payslip not found', 404);
    }

    const updated = await prisma.payslip.update({
      where: { id },
      data: {
        status: data.status,
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference,
        paymentStatus: data.paymentStatus,
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
        payrollCycle: {
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
   * Generate PDF for payslip using PDFKit
   */
  async generatePDF(id: string): Promise<{ pdfUrl: string; pdfBuffer: Buffer }> {
    // Generate the actual PDF buffer
    const pdfBuffer = await pdfService.generatePayslipPDF(id);

    // Persist the PDF and get the file URL
    const pdfUrl = await pdfService.savePayslipPDF(id, pdfBuffer);

    // Update payslip record with PDF URL and status
    await prisma.payslip.update({
      where: { id },
      data: {
        pdfUrl,
        status: 'GENERATED',
      },
    });

    return { pdfUrl, pdfBuffer };
  }

  /**
   * Send payslip to employee via email with PDF attachment.
   * Generates the PDF if not already generated.
   * Returns the updated payslip and whether the email was delivered.
   */
  async sendPayslip(id: string): Promise<{ payslip: any; emailSent: boolean }> {
    const payslip = await this.getById(id);

    if (!['GENERATED', 'SENT'].includes(payslip.status)) {
      throw new AppError('Payslip must be in GENERATED or SENT status before sending', 400);
    }

    // Generate PDF buffer (re-generate if not yet done)
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await pdfService.generatePayslipPDF(id);
    } catch {
      throw new AppError('Failed to generate payslip PDF for email attachment', 500);
    }

    // Resolve recipient email: officialEmail > email from employee record
    const employeeAny = payslip.employee as any;
    const recipientEmail: string | undefined =
      employeeAny?.officialEmail?.trim() || employeeAny?.email?.trim();

    let emailSent = false;
    if (recipientEmail) {
      const periodEnd = new Date(payslip.periodEnd);
      const monthName = periodEnd.toLocaleString('en-IN', { month: 'long' });
      const year = periodEnd.getFullYear();
      const employeeName = `${employeeAny?.firstName ?? ''} ${employeeAny?.lastName ?? ''}`.trim();

      emailSent = await sendPayslipEmail({
        toEmail: recipientEmail,
        employeeName,
        month: monthName,
        year,
        pdfBuffer,
      });
    }

    const updated = await prisma.payslip.update({
      where: { id },
      data: { status: 'SENT' },
    });

    return { payslip: updated, emailSent };
  }
}

export const payslipService = new PayslipService();
