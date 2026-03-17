import { Request, Response, NextFunction } from 'express';
import { payslipService } from '../services/payslip.service';
import {
  queryPayslipsSchema,
  updatePayslipSchema,
} from '../utils/payroll.validation';
import { pdfService } from '../services/pdf.service';

export class PayslipController {
  /**
   * Get all payslips
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = queryPayslipsSchema.parse(req.query);
      const result = await payslipService.getAll(query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payslip by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payslip = await payslipService.getById(id);
      res.json({
        success: true,
        data: payslip,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payslips for employee
   */
  async getByEmployeeId(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params;
      const query = queryPayslipsSchema.parse(req.query);
      const result = await payslipService.getByEmployeeId(employeeId, query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update payslip
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updatePayslipSchema.parse(req.body);
      const payslip = await payslipService.update(id, data);
      res.json({
        success: true,
        data: payslip,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate payslip PDF and return download URL
   */
  async generatePDF(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { pdfUrl } = await payslipService.generatePDF(id);
      res.json({ success: true, data: { pdfUrl } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download payslip PDF as binary stream
   */
  async downloadPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const pdfBuffer = await pdfService.generatePayslipPDF(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=payslip-${id}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * View payslip PDF inline in browser
   */
  async viewPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const pdfBuffer = await pdfService.generatePayslipPDF(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=payslip-${id}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send payslip to employee via email with PDF attachment
   */
  async sendPayslip(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { payslip, emailSent } = await payslipService.sendPayslip(id);
      res.json({
        success: true,
        data: payslip,
        emailSent,
        message: emailSent
          ? 'Payslip sent to employee email successfully.'
          : 'Payslip status updated. Email delivery skipped (SMTP not configured or employee has no email).',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get comprehensive payslip with all details (earnings breakdown, deductions breakdown, YTD, bank details)
   */
  async getComprehensive(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payslip = await payslipService.getById(id);

      // Format earnings breakdown
      const earningsBreakdown = Array.isArray(payslip.earnings)
        ? payslip.earnings.map((e: any) => ({
            component: e.component || e.name,
            amount: Number(e.amount || 0),
            isTaxable: e.isTaxable !== false,
            description: e.description || '',
          }))
        : [];

      // Format deductions breakdown
      const deductionsBreakdown = Array.isArray(payslip.deductions)
        ? payslip.deductions.map((d: any) => ({
            component: d.component || d.name,
            amount: Number(d.amount || 0),
            type: d.type || 'DEDUCTION',
            isStatutory: d.isStatutory || false,
            description: d.description || '',
          }))
        : [];

      // Get bank details
      const bankDetails = (payslip.employeeSalary as any)?.bankAccount || null;

      res.json({
        success: true,
        data: {
          ...payslip,
          earningsBreakdown,
          deductionsBreakdown,
          bankDetails: bankDetails
            ? {
                bankName: bankDetails.bankName,
                accountNumber: bankDetails.accountNumber,
                routingNumber: bankDetails.routingNumber,
                accountType: bankDetails.accountType,
                isPrimary: bankDetails.isPrimary,
              }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const payslipController = new PayslipController();
