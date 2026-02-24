import { Request, Response, NextFunction } from 'express';
import { leaveRequestService } from '../services/leave-request.service';
import { prisma } from '../utils/prisma';

export class LeaveRequestController {
  /**
   * Apply for leave
   * POST /api/v1/leaves/requests
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      // Get employee ID from user
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required',
        });
      }

      // Get employee record
      const employee = await prisma.employee.findUnique({
        where: { userId },
      });

      if (!employee) {
        return res.status(404).json({
          status: 'fail',
          message: 'Employee profile not found',
        });
      }

      const leaveRequest = await leaveRequestService.create(
        employee.id,
        req.body,
        req.user?.role
      );

      return res.status(201).json({
        status: 'success',
        message: 'Leave request submitted successfully',
        data: { leaveRequest },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get leave apply hint (opening/available/fixed range)
   * GET /api/v1/leaves/requests/apply-hint
   */
  async getApplyHint(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required',
        });
      }

      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!employee) {
        return res.status(404).json({
          status: 'fail',
          message: 'Employee profile not found',
        });
      }

      const leaveTypeId = String(req.query.leaveTypeId || '');
      const startDate = String(req.query.startDate || '');
      if (!leaveTypeId || !startDate) {
        return res.status(400).json({
          status: 'fail',
          message: 'leaveTypeId and startDate are required',
        });
      }

      const data = await leaveRequestService.getApplyHint(employee.id, { leaveTypeId, startDate });
      return res.status(200).json({
        status: 'success',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all leave requests
   * GET /api/v1/leaves/requests
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const result = await leaveRequestService.getAll(req.query as any, userId, userRole);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get leave request by ID
   * GET /api/v1/leaves/requests/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const leaveRequest = await leaveRequestService.getById(id);

      return res.status(200).json({
        status: 'success',
        data: { leaveRequest },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Approve leave request
   * PUT /api/v1/leaves/requests/:id/approve
   */
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required',
        });
      }

      const userRole = req.user?.role;
      const leaveRequest = await leaveRequestService.approve(
        id,
        userId,
        req.body.reviewComments,
        userRole
      );

      return res.status(200).json({
        status: 'success',
        message: 'Leave request approved successfully',
        data: { leaveRequest },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Reject leave request
   * PUT /api/v1/leaves/requests/:id/reject
   */
  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required',
        });
      }

      const userRole = req.user?.role;
      const leaveRequest = await leaveRequestService.reject(
        id,
        userId,
        req.body.reviewComments,
        userRole
      );

      return res.status(200).json({
        status: 'success',
        message: 'Leave request rejected',
        data: { leaveRequest },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Cancel leave request
   * PUT /api/v1/leaves/requests/:id/cancel
   */
  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required',
        });
      }

      // Get employee ID
      const employee = await prisma.employee.findUnique({
        where: { userId },
      });

      if (!employee) {
        return res.status(404).json({
          status: 'fail',
          message: 'Employee profile not found',
        });
      }

      const leaveRequest = await leaveRequestService.cancel(
        id,
        employee.id,
        req.body.cancellationReason
      );

      return res.status(200).json({
        status: 'success',
        message: 'Leave request cancelled successfully',
        data: { leaveRequest },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update leave request
   * PUT /api/v1/leaves/requests/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required',
        });
      }

      // Get employee ID
      const employee = await prisma.employee.findUnique({
        where: { userId },
      });

      if (!employee) {
        return res.status(404).json({
          status: 'fail',
          message: 'Employee profile not found',
        });
      }

      const leaveRequest = await leaveRequestService.update(id, employee.id, req.body);

      return res.status(200).json({
        status: 'success',
        message: 'Leave request updated successfully',
        data: { leaveRequest },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const leaveRequestController = new LeaveRequestController();
