import { Request, Response, NextFunction } from 'express';
import { holidayService } from '../services/holiday.service';

export class HolidayController {
  /**
   * Create new holiday
   * POST /api/v1/holidays
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const holiday = await holidayService.create(req.body);

      res.status(201).json({
        status: 'success',
        message: 'Holiday created successfully',
        data: { holiday },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all holidays
   * GET /api/v1/holidays
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await holidayService.getAll(req.query as any);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get holiday by ID
   * GET /api/v1/holidays/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const holiday = await holidayService.getById(id);

      res.status(200).json({
        status: 'success',
        data: { holiday },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update holiday
   * PUT /api/v1/holidays/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const holiday = await holidayService.update(id, req.body);

      res.status(200).json({
        status: 'success',
        message: 'Holiday updated successfully',
        data: { holiday },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete holiday
   * DELETE /api/v1/holidays/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await holidayService.delete(id);

      res.status(200).json({
        status: 'success',
        message: 'Holiday deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const holidayController = new HolidayController();
