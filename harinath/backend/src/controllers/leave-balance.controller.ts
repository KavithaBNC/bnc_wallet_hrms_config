import { Request, Response, NextFunction } from 'express';
import { leaveBalanceService } from '../services/leave-balance.service';

export class LeaveBalanceController {
  /**
   * Get leave balance for employee
   * GET /api/v1/leaves/balance/:employeeId
   */
  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params;
      const result = await leaveBalanceService.getBalance({
        employeeId,
        year: req.query.year as string,
        leaveTypeId: req.query.leaveTypeId as string,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get leave calendar
   * GET /api/v1/leaves/calendar
   */
  async getCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, startDate, endDate, departmentId } = req.query;

      if (!organizationId || !startDate || !endDate) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId, startDate, and endDate are required',
        });
      }

      const result = await leaveBalanceService.getCalendar(
        organizationId as string,
        new Date(startDate as string),
        new Date(endDate as string),
        departmentId as string | undefined
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
   * Event Balance Entry list
   * GET /api/v1/leaves/balance-entry
   */
  async getBalanceEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, leaveTypeId, year } = req.query;
      if (!organizationId || !leaveTypeId) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId and leaveTypeId are required',
        });
      }

      const parsedYear = Number(year) || new Date().getFullYear();
      const result = await leaveBalanceService.getBalanceEntries({
        organizationId: String(organizationId),
        leaveTypeId: String(leaveTypeId),
        year: parsedYear,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Event Balance Entry upsert
   * PUT /api/v1/leaves/balance-entry
   */
  async upsertBalanceEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, employeeId, leaveTypeId, year, openingDays, fromDate, toDate } = req.body || {};
      if (!organizationId || !employeeId || !leaveTypeId || year == null || openingDays == null) {
        return res.status(400).json({
          status: 'fail',
          message: 'organizationId, employeeId, leaveTypeId, year and openingDays are required',
        });
      }

      const result = await leaveBalanceService.upsertBalanceEntry({
        organizationId: String(organizationId),
        employeeId: String(employeeId),
        leaveTypeId: String(leaveTypeId),
        year: Number(year),
        openingDays: Number(openingDays),
        fromDate: fromDate ? String(fromDate) : undefined,
        toDate: toDate ? String(toDate) : undefined,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const leaveBalanceController = new LeaveBalanceController();
