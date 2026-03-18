import { Request, Response, NextFunction } from 'express';
import { monthlyAttendanceSummaryService } from '../services/monthly-attendance-summary.service';
import { MonthlyAttendanceSummaryStatus } from '@prisma/client';

export class MonthlyAttendanceSummaryController {
  /**
   * Build or refresh a single employee's monthly summary.
   * POST /api/v1/monthly-attendance-summary/build
   */
  async buildForEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId =
        (req.body.organizationId as string) || (req.query.organizationId as string);
      if (!organizationId) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId is required',
        });
      }
      const employeeId = req.body.employeeId as string;
      const year = parseInt(req.body.year ?? req.query.year, 10);
      const month = parseInt(req.body.month ?? req.query.month, 10);
      if (!employeeId || !year || !month || month < 1 || month > 12) {
        return res.status(400).json({
          status: 'fail',
          message: 'employeeId, year (1-12), and month (1-12) are required',
        });
      }
      const summary = await monthlyAttendanceSummaryService.buildSummaryForEmployee({
        organizationId,
        employeeId,
        year,
        month,
      });
      return res.status(200).json({
        status: 'success',
        data: summary,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Build or refresh all employees' summaries for a month.
   * POST /api/v1/monthly-attendance-summary/build-month
   */
  async buildMonth(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId =
        (req.body.organizationId as string) || (req.query.organizationId as string);
      if (!organizationId) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId is required',
        });
      }
      const year = parseInt(req.body.year ?? req.query.year, 10);
      const month = parseInt(req.body.month ?? req.query.month, 10);
      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({
          status: 'fail',
          message: 'year and month (1-12) are required',
        });
      }
      const result = await monthlyAttendanceSummaryService.buildMonthForOrganization(
        organizationId,
        year,
        month
      );
      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * List monthly summaries.
   * GET /api/v1/monthly-attendance-summary?organizationId=&year=&month=&employeeId=&status=&page=&limit=
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.query.organizationId as string;
      if (!organizationId) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId is required',
        });
      }
      const year = parseInt(req.query.year as string, 10);
      const month = parseInt(req.query.month as string, 10);
      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({
          status: 'fail',
          message: 'year and month (1-12) are required',
        });
      }
      const employeeId = (req.query.employeeId as string) || undefined;
      const status = (req.query.status as MonthlyAttendanceSummaryStatus) || undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await monthlyAttendanceSummaryService.list({
        organizationId,
        year,
        month,
        employeeId,
        status,
        page,
        limit,
      });
      return res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get a single summary by id.
   * GET /api/v1/monthly-attendance-summary/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const summary = await monthlyAttendanceSummaryService.getById(id);
      return res.status(200).json({
        status: 'success',
        data: summary,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Finalize a summary (DRAFT → FINALIZED).
   * PUT /api/v1/monthly-attendance-summary/:id/finalize
   */
  async finalize(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId as string;
      if (!userId) {
        return res.status(401).json({ status: 'fail', message: 'Authentication required' });
      }
      const summary = await monthlyAttendanceSummaryService.finalize(id, userId);
      return res.status(200).json({
        status: 'success',
        data: summary,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Lock a month for the organization.
   * POST /api/v1/monthly-attendance-summary/lock-month
   */
  async lockMonth(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId =
        (req.body.organizationId as string) || (req.query.organizationId as string);
      if (!organizationId) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId is required',
        });
      }
      const year = parseInt(req.body.year ?? req.query.year, 10);
      const month = parseInt(req.body.month ?? req.query.month, 10);
      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({
          status: 'fail',
          message: 'year and month (1-12) are required',
        });
      }
      const lockedBy = req.user?.userId as string | undefined;
      const remarks = (req.body.remarks as string) || undefined;
      const lock = await monthlyAttendanceSummaryService.lockMonth(
        organizationId,
        year,
        month,
        lockedBy,
        remarks
      );
      return res.status(200).json({
        status: 'success',
        data: lock,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Unlock a month for the organization.
   * POST /api/v1/monthly-attendance-summary/unlock-month
   */
  async unlockMonth(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId =
        (req.body.organizationId as string) || (req.query.organizationId as string);
      if (!organizationId) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId is required',
        });
      }
      const year = parseInt(req.body.year ?? req.query.year, 10);
      const month = parseInt(req.body.month ?? req.query.month, 10);
      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({
          status: 'fail',
          message: 'year and month (1-12) are required',
        });
      }
      const remarks = (req.body.remarks as string) || undefined;
      await monthlyAttendanceSummaryService.unlockMonth(organizationId, year, month, remarks);
      return res.status(200).json({
        status: 'success',
        message: 'Month unlocked successfully',
        data: null,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get lock status for a month.
   * GET /api/v1/monthly-attendance-summary/lock?organizationId=&year=&month=
   */
  async getMonthLock(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.query.organizationId as string;
      const year = parseInt(req.query.year as string, 10);
      const month = parseInt(req.query.month as string, 10);
      if (!organizationId || !year || !month || month < 1 || month > 12) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId, year, and month (1-12) are required',
        });
      }
      const lock = await monthlyAttendanceSummaryService.getMonthLock(
        organizationId,
        year,
        month
      );
      return res.status(200).json({
        status: 'success',
        data: lock,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const monthlyAttendanceSummaryController = new MonthlyAttendanceSummaryController();
