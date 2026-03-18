import PDFDocument from 'pdfkit';
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import fs from 'fs';
import path from 'path';


export class PDFService {
  /**
   * Generate payslip PDF
   */
  async generatePayslipPDF(payslipId: string): Promise<Buffer> {
    // Get comprehensive payslip data
    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
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
            organizationId: true,
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
            organizationId: true,
          },
        },
        employeeSalary: {
          select: {
            id: true,
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

    // Get organization data
    const organization = await prisma.organization.findUnique({
      where: { id: payslip.employee.organizationId },
      select: {
        id: true,
        name: true,
        legalName: true,
        logoUrl: true,
        address: true,
        website: true,
        taxId: true,
        registrationNumber: true,
      },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Calculate YTD if not in payslip
    const payslipAny = payslip as any;
    let ytdTotals = {
      ytdGrossSalary: payslipAny.ytdGrossSalary ? Number(payslipAny.ytdGrossSalary) : null,
      ytdDeductions: payslipAny.ytdDeductions ? Number(payslipAny.ytdDeductions) : null,
      ytdNetSalary: payslipAny.ytdNetSalary ? Number(payslipAny.ytdNetSalary) : null,
      ytdTaxPaid: payslipAny.ytdTaxPaid ? Number(payslipAny.ytdTaxPaid) : null,
    };

    if (!ytdTotals.ytdGrossSalary) {
      const yearStart = new Date(payslip.periodEnd.getFullYear(), 0, 1);
      const previousPayslips = await prisma.payslip.findMany({
        where: {
          employeeId: payslip.employeeId,
          periodEnd: {
            lte: payslip.periodEnd,
            gte: yearStart,
          },
          status: { in: ['GENERATED', 'SENT', 'PAID'] },
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

      ytdTotals = {
        ytdGrossSalary: ytdGross,
        ytdDeductions,
        ytdNetSalary: ytdNet,
        ytdTaxPaid: ytdTax,
      };
    }

    // Format earnings breakdown
    const earnings = Array.isArray(payslip.earnings)
      ? (payslip.earnings as any[]).map((e: any) => ({
          component: e.component || e.name || 'Unknown',
          amount: Number(e.amount || 0),
          isTaxable: e.isTaxable !== false,
          description: e.description || '',
        }))
      : [];

    // Format deductions breakdown
    const deductions = Array.isArray(payslip.deductions)
      ? (payslip.deductions as any[]).map((d: any) => ({
          component: d.component || d.name || 'Unknown',
          amount: Number(d.amount || 0),
          type: d.type || 'DEDUCTION',
          isStatutory: d.isStatutory || false,
          description: d.description || '',
        }))
      : [];

    // Bank details
    const bankDetails = (payslip.employeeSalary as any)?.bankAccount || null;

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {});

    // Helper function to format currency
    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined) return '0.00';
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
      }).format(amount);
    };

    // Helper function to format date
    const formatDate = (date: Date): string => {
      return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(date));
    };

    // Header with Company Logo and Details
    const headerY = 50;
    
    // Company Logo (if available)
    if (organization.logoUrl) {
      // Note: In production, you'd need to fetch and embed the image
      // For now, we'll just leave space for it
      doc.rect(50, headerY, 80, 40).stroke();
      doc.fontSize(10).fillColor('#666666').text('LOGO', 70, headerY + 15);
    }

    // Company Details
    const companyX = organization.logoUrl ? 150 : 50;
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(organization.name, companyX, headerY, { width: 400 });

    if (organization.legalName) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text(organization.legalName, companyX, headerY + 25, { width: 400 });
    }

    // Company Address
    if (organization.address) {
      const address = organization.address as any;
      const addressLines: string[] = [];
      if (address.street) addressLines.push(address.street);
      if (address.city) addressLines.push(address.city);
      if (address.state) addressLines.push(address.state);
      if (address.country) addressLines.push(address.country);
      if (address.postalCode) addressLines.push(address.postalCode);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#666666')
        .text(addressLines.join(', '), companyX, headerY + 40, { width: 400 });
    }

    // Payslip Title
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('PAYSLIP', 50, headerY + 80, { align: 'center', width: 500 });

    // Period Information
    const periodY = headerY + 130;
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#000000')
      .text(`Pay Period: ${formatDate(payslip.periodStart)} to ${formatDate(payslip.periodEnd)}`, 50, periodY)
      .text(`Payment Date: ${formatDate(payslip.paymentDate)}`, 50, periodY + 15)
      .text(`Payslip ID: ${payslip.id.substring(0, 8).toUpperCase()}`, 50, periodY + 30);

    // Employee Information Section
    const employeeY = periodY + 60;
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Employee Information', 50, employeeY);

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#000000')
      .text(`Name: ${payslip.employee.firstName} ${payslip.employee.lastName}`, 50, employeeY + 20)
      .text(`Employee Code: ${payslip.employee.employeeCode}`, 50, employeeY + 35)
      .text(`Email: ${payslip.employee.email}`, 50, employeeY + 50);

    if (payslip.employee.phone) {
      doc.text(`Phone: ${payslip.employee.phone}`, 50, employeeY + 65);
    }

    if (payslip.employee.department) {
      doc.text(`Department: ${payslip.employee.department.name}`, 50, employeeY + 80);
    }

    if (payslip.employee.position) {
      doc.text(`Position: ${payslip.employee.position.title}`, 50, employeeY + 95);
    }

    // Bank Details (if available)
    if (bankDetails) {
      doc.text(`Bank: ${bankDetails.bankName}`, 50, employeeY + 110);
      doc.text(`Account: ${bankDetails.accountNumber}`, 50, employeeY + 125);
    }

    // Earnings Section
    const earningsY = employeeY + (bankDetails ? 150 : 120);
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Earnings', 50, earningsY);

    let currentY = earningsY + 20;
    let totalEarnings = 0;

    if (earnings.length > 0) {
      // Table Header
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#666666')
        .text('Component', 50, currentY)
        .text('Amount', 450, currentY, { align: 'right' });

      currentY += 15;
      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();

      // Earnings Rows
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      for (const earning of earnings) {
        currentY += 15;
        doc.text(earning.component, 50, currentY);
        const amount = formatCurrency(earning.amount);
        doc.text(amount, 450, currentY, { align: 'right' });
        totalEarnings += earning.amount;
      }
    } else {
      // Fallback to basic salary if no breakdown
      currentY += 15;
      doc.text('Basic Salary', 50, currentY);
      const basicSalary = payslip.basicSalary ? Number(payslip.basicSalary) : 0;
      doc.text(formatCurrency(basicSalary), 450, currentY, { align: 'right' });
      totalEarnings = basicSalary;
    }

    currentY += 10;
    doc.moveTo(50, currentY).lineTo(550, currentY).stroke();

    // Total Earnings
    currentY += 10;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Total Earnings', 50, currentY)
      .text(formatCurrency(Number(payslip.grossSalary)), 450, currentY, { align: 'right' });

    // Deductions Section
    const deductionsY = currentY + 30;
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Deductions', 50, deductionsY);

    currentY = deductionsY + 20;

    if (deductions.length > 0) {
      // Table Header
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#666666')
        .text('Component', 50, currentY)
        .text('Amount', 450, currentY, { align: 'right' });

      currentY += 15;
      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();

      // Deductions Rows
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      for (const deduction of deductions) {
        currentY += 15;
        doc.text(deduction.component, 50, currentY);
        doc.text(formatCurrency(deduction.amount), 450, currentY, { align: 'right' });
      }
    }

    currentY += 10;
    doc.moveTo(50, currentY).lineTo(550, currentY).stroke();

    // Total Deductions
    currentY += 10;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Total Deductions', 50, currentY)
      .text(formatCurrency(payslip.totalDeductions ? Number(payslip.totalDeductions) : 0), 450, currentY, { align: 'right' });

    // Net Salary
    const netSalaryY = currentY + 30;
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Net Salary', 50, netSalaryY)
      .text(formatCurrency(Number(payslip.netSalary)), 450, netSalaryY, { align: 'right' });

    // YTD Totals Section
    if (ytdTotals.ytdGrossSalary !== null) {
      const ytdY = netSalaryY + 40;
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Year-to-Date (YTD) Totals', 50, ytdY);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#000000')
        .text(`YTD Gross Salary: ${formatCurrency(ytdTotals.ytdGrossSalary)}`, 50, ytdY + 20)
        .text(`YTD Deductions: ${formatCurrency(ytdTotals.ytdDeductions || 0)}`, 50, ytdY + 35)
        .text(`YTD Net Salary: ${formatCurrency(ytdTotals.ytdNetSalary || 0)}`, 50, ytdY + 50)
        .text(`YTD Tax Paid: ${formatCurrency(ytdTotals.ytdTaxPaid || 0)}`, 50, ytdY + 65);
    }

    // Attendance Summary
    const attendanceY = (ytdTotals.ytdGrossSalary !== null ? netSalaryY + 120 : netSalaryY + 40);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666666')
      .text(
        `Attendance: ${payslip.paidDays || 0} days | Unpaid: ${payslip.unpaidDays || 0} days | Overtime: ${payslip.overtimeHours || 0} hours`,
        50,
        attendanceY,
        { width: 500 }
      );

    // Footer
    const footerY = 750;
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text(
        'This is a system generated payslip. For any queries, please contact HR department.',
        50,
        footerY,
        { align: 'center', width: 500 }
      );

    if (organization.website) {
      doc.text(organization.website, 50, footerY + 15, { align: 'center', width: 500 });
    }

    // Finalize PDF
    doc.end();

    // Wait for PDF to be generated
    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
    });
  }

  /**
   * Save PDF to file system (optional - for caching)
   */
  async savePayslipPDF(payslipId: string, pdfBuffer: Buffer): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'payslips');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `payslip-${payslipId}.pdf`;
    const filepath = path.join(uploadsDir, filename);

    fs.writeFileSync(filepath, pdfBuffer);

    return `/uploads/payslips/${filename}`;
  }
}

export const pdfService = new PDFService();
