import { Request, Response, NextFunction } from 'express';
import { shiftService } from '../services/shift.service';

export class ShiftController {
  /**
   * Create new shift
   * POST /api/v1/shifts
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const shift = await shiftService.create(req.body);

      return res.status(201).json({
        status: 'success',
        message: 'Shift created successfully',
        data: { shift },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all shifts
   * GET /api/v1/shifts
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await shiftService.getAll(req.query as any);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get shift by ID
   * GET /api/v1/shifts/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const shift = await shiftService.getById(id);

      return res.status(200).json({
        status: 'success',
        data: { shift },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update shift
   * PUT /api/v1/shifts/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const shift = await shiftService.update(id, req.body);

      return res.status(200).json({
        status: 'success',
        message: 'Shift updated successfully',
        data: { shift },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete shift
   * DELETE /api/v1/shifts/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await shiftService.delete(id);

      return res.status(200).json({
        status: 'success',
        message: 'Shift deleted successfully',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const shiftController = new ShiftController();
