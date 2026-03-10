import { Request, Response, NextFunction } from 'express';
import { complianceReportService } from '../services/compliance-report.service';
import { form16Service } from '../services/form16.service';

export class ComplianceReportController {
  async getPayrollRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const cycleId = req.query.cycleId as string;
      if (!cycleId) {
        return res.status(400).json({ status: 'fail', message: 'cycleId query parameter is required' });
      }
      const organizationId = req.rbac?.organizationId || '';
      const result = await complianceReportService.getPayrollRegister(cycleId, organizationId);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getPfEcr(req: Request, res: Response, next: NextFunction) {
    try {
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);
      if (!year || !month) {
        return res.status(400).json({ status: 'fail', message: 'year and month query parameters are required' });
      }
      const organizationId = req.rbac?.organizationId || '';
      const result = await complianceReportService.getPfEcr(organizationId, year, month);

      // If format=csv requested, return as downloadable file
      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=PF_ECR_${year}_${month}.csv`);
        return res.send(result.csvContent);
      }

      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getSalaryRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const cycleId = req.query.cycleId as string;
      if (!cycleId) {
        return res.status(400).json({ status: 'fail', message: 'cycleId query parameter is required' });
      }
      const groupBy = (req.query.groupBy as 'department' | 'paygroup') || 'department';
      const organizationId = req.rbac?.organizationId || '';
      const result = await complianceReportService.getSalaryRegister(cycleId, organizationId, groupBy);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getBankAdvice(req: Request, res: Response, next: NextFunction) {
    try {
      const cycleId = req.query.cycleId as string;
      if (!cycleId) {
        return res.status(400).json({ status: 'fail', message: 'cycleId query parameter is required' });
      }
      const organizationId = req.rbac?.organizationId || '';
      const result = await complianceReportService.getBankAdvice(cycleId, organizationId);

      // If format=csv requested, return as downloadable file
      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=Bank_Advice_${cycleId}.csv`);
        return res.send(result.csvContent);
      }

      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getFnfStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.rbac?.organizationId || '';
      const result = await complianceReportService.getFnfStatement(id, organizationId);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getEsicStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const cycleId = req.query.cycleId as string;
      if (!cycleId) {
        return res.status(400).json({ status: 'fail', message: 'cycleId query parameter is required' });
      }
      const organizationId = req.rbac?.organizationId || '';
      const result = await complianceReportService.getEsicStatement(cycleId, organizationId);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getProfessionalTaxReport(req: Request, res: Response, next: NextFunction) {
    try {
      const cycleId = req.query.cycleId as string;
      if (!cycleId) {
        return res.status(400).json({ status: 'fail', message: 'cycleId query parameter is required' });
      }
      const organizationId = req.rbac?.organizationId || '';
      const result = await complianceReportService.getProfessionalTaxReport(cycleId, organizationId);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getTdsWorkingSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const financialYear = req.query.financialYear as string;
      if (!financialYear) {
        return res.status(400).json({ status: 'fail', message: 'financialYear query parameter is required (e.g. 2025-26)' });
      }
      const organizationId = req.rbac?.organizationId || '';
      const result = await complianceReportService.getTdsWorkingSheet(organizationId, financialYear);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getForm16(req: Request, res: Response, next: NextFunction) {
    try {
      const financialYear = req.query.financialYear as string;
      if (!financialYear) {
        return res.status(400).json({ status: 'fail', message: 'financialYear query parameter is required (e.g. 2025-26)' });
      }
      const employeeId = req.query.employeeId as string | undefined;
      const organizationId = req.rbac?.organizationId || '';
      const result = await form16Service.generate(organizationId, financialYear, employeeId);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }
}

export const complianceReportController = new ComplianceReportController();
