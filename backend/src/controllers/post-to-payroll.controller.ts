import { Request, Response, NextFunction } from 'express';
import { PostToPayrollService } from '../services/post-to-payroll.service';

const postToPayrollService = new PostToPayrollService();

export class PostToPayrollController {
  async getAll(req: Request, res: Response) {
    try {
      const organizationId = (req.query.organizationId || req.body?.organizationId) as string | undefined;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const showAllParam = req.query.showAll;
      const showAll = showAllParam === undefined ? true : String(showAllParam).toLowerCase() === 'true';
      const list = await postToPayrollService.getAll(organizationId, showAll);
      return res.status(200).json({
        message: 'Post to payroll mappings retrieved successfully',
        data: { list },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve mappings';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }

  /** Get column options from MonthlyAttendanceSummary fields */
  async getColumnOptions(_req: Request, res: Response, next: NextFunction) {
    try {
      const options = postToPayrollService.getColumnOptions();
      return res.status(200).json({ message: 'OK', data: { options } });
    } catch (error) {
      return next(error);
    }
  }

  /** Get salary element names from Salary Structure / Employee Salary components */
  async getSalaryElementNames(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req.query.organizationId || req.body?.organizationId) as string | undefined;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const names = await postToPayrollService.getSalaryElementNames(organizationId);
      return res.status(200).json({ message: 'OK', data: { names } });
    } catch (error) {
      return next(error);
    }
  }

  /** HR Activities: Preview - list employees with MonthlyAttendanceSummary for month */
  async getPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req.query.organizationId as string) || (req.body?.organizationId as string);
      if (!organizationId) return res.status(400).json({ message: 'Organization ID is required' });
      const year = parseInt(req.query.year as string, 10);
      const month = parseInt(req.query.month as string, 10);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Valid year and month (1-12) are required' });
      }
      const associate = (req.query.associate as string)?.trim() || undefined;
      const showAll = req.query.showAll === undefined ? true : String(req.query.showAll).toLowerCase() === 'true';
      const result = await postToPayrollService.getPreview(organizationId, year, month, associate, showAll);
      return res.status(200).json({ message: 'OK', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /** HR Activities: Post - create DRAFT payroll cycle for month (month must be locked) */
  async postMonth(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req.body.organizationId as string) || (req.query.organizationId as string);
      if (!organizationId) return res.status(400).json({ message: 'Organization ID is required' });
      const year = parseInt(req.body.year as string || req.query.year as string, 10);
      const month = parseInt(req.body.month as string || req.query.month as string, 10);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Valid year and month (1-12) are required' });
      }
      const postedBy = (req as any).user?.userId as string | undefined;
      const cycle = await postToPayrollService.postMonth(organizationId, year, month, postedBy);
      return res.status(200).json({ message: 'Posted to payroll successfully', data: { cycle } });
    } catch (error) {
      return next(error);
    }
  }

  /** HR Activities: Unpost - delete DRAFT payroll cycle for month */
  async unpostMonth(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req.query.organizationId as string) || (req.body?.organizationId as string);
      if (!organizationId) return res.status(400).json({ message: 'Organization ID is required' });
      const year = parseInt((req.query.year as string) || (req.body?.year as string), 10);
      const month = parseInt((req.query.month as string) || (req.body?.month as string), 10);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Valid year and month (1-12) are required' });
      }
      const result = await postToPayrollService.unpostMonth(organizationId, year, month);
      return res.status(200).json({ message: 'Unposted successfully', data: result });
    } catch (error) {
      return next(error);
    }
  }

  /** HR Activities: Post status - check if month has payroll cycle */
  async getPostStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.query.organizationId as string;
      if (!organizationId) return res.status(400).json({ message: 'Organization ID is required' });
      const year = parseInt(req.query.year as string, 10);
      const month = parseInt(req.query.month as string, 10);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Valid year and month (1-12) are required' });
      }
      const status = await postToPayrollService.getPostStatus(organizationId, year, month);
      return res.status(200).json({ message: 'OK', data: status });
    } catch (error) {
      return next(error);
    }
  }

  async saveAll(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId as string | undefined;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
      const list = await postToPayrollService.saveAll(organizationId, rows);
      return res.status(200).json({
        message: 'Post to payroll mappings saved successfully',
        data: { list },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save mappings';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }
}
