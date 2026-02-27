import { Request, Response, NextFunction } from 'express';
import { leaveTypeService } from '../services/leave-type.service';

export class LeaveTypeController {
  /**
   * Create new leave type
   * POST /api/v1/leaves/types
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const leaveType = await leaveTypeService.create(req.body);

      return res.status(201).json({
        status: 'success',
        message: 'Leave type created successfully',
        data: { leaveType },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all leave types
   * GET /api/v1/leaves/types
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await leaveTypeService.getAll(req.query as any);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get leave type by ID
   * GET /api/v1/leaves/types/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const leaveType = await leaveTypeService.getById(id);

      return res.status(200).json({
        status: 'success',
        data: { leaveType },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update leave type
   * PUT /api/v1/leaves/types/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const leaveType = await leaveTypeService.update(id, req.body);

      return res.status(200).json({
        status: 'success',
        message: 'Leave type updated successfully',
        data: { leaveType },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete leave type
   * DELETE /api/v1/leaves/types/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await leaveTypeService.delete(id);

      return res.status(200).json({
        status: 'success',
        message: 'Leave type deleted successfully',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const leaveTypeController = new LeaveTypeController();
