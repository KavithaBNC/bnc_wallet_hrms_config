import { Request, Response, NextFunction } from 'express';
import { attendanceRegularizationService } from '../services/attendance-regularization.service';
import { prisma } from '../utils/prisma';

export class AttendanceRegularizationController {
  /**
   * Create regularization request
   * POST /api/v1/attendance/regularization
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Unauthorized',
        });
      }

      // Get employee ID from user
      const employee = await prisma.employee.findUnique({
        where: { userId },
      });

      if (!employee) {
        return res.status(404).json({
          status: 'fail',
          message: 'Employee not found',
        });
      }

      const regularization = await attendanceRegularizationService.create(employee.id, req.body);

      return res.status(201).json({
        status: 'success',
        message: 'Regularization request created successfully',
        data: { regularization },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all regularization requests
   * GET /api/v1/attendance/regularization
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const result = await attendanceRegularizationService.getAll(req.query as any, userId, userRole);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get regularization by ID
   * GET /api/v1/attendance/regularization/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const regularization = await attendanceRegularizationService.getById(id);

      return res.status(200).json({
        status: 'success',
        data: { regularization },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Approve regularization
   * PUT /api/v1/attendance/regularization/:id/approve
   */
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;

      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Unauthorized',
        });
      }

      const regularization = await attendanceRegularizationService.approve(id, userId, req.body, userRole);

      return res.status(200).json({
        status: 'success',
        message: 'Regularization request approved successfully',
        data: { regularization },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Reject regularization
   * PUT /api/v1/attendance/regularization/:id/reject
   */
  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;

      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Unauthorized',
        });
      }

      const regularization = await attendanceRegularizationService.reject(id, userId, req.body, userRole);

      return res.status(200).json({
        status: 'success',
        message: 'Regularization request rejected',
        data: { regularization },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Cancel regularization
   * PUT /api/v1/attendance/regularization/:id/cancel
   */
  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Unauthorized',
        });
      }

      // Get employee ID from user
      const employee = await prisma.employee.findUnique({
        where: { userId },
      });

      if (!employee) {
        return res.status(404).json({
          status: 'fail',
          message: 'Employee not found',
        });
      }

      const regularization = await attendanceRegularizationService.cancel(id, employee.id);

      return res.status(200).json({
        status: 'success',
        message: 'Regularization request cancelled',
        data: { regularization },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const attendanceRegularizationController = new AttendanceRegularizationController();
