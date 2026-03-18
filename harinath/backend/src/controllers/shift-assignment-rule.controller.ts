import { Request, Response, NextFunction } from 'express';
import { shiftAssignmentRuleService } from '../services/shift-assignment-rule.service';

export class ShiftAssignmentRuleController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const rule = await shiftAssignmentRuleService.create(req.body);
      return res.status(201).json({
        status: 'success',
        message: 'Shift assignment rule created successfully',
        data: { rule },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await shiftAssignmentRuleService.getAll(req.query as any);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const rule = await shiftAssignmentRuleService.getById(id);
      return res.status(200).json({ status: 'success', data: { rule } });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const rule = await shiftAssignmentRuleService.update(id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Shift assignment rule updated successfully',
        data: { rule },
      });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await shiftAssignmentRuleService.delete(id);
      return res.status(200).json({
        status: 'success',
        message: 'Shift assignment rule deleted successfully',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const shiftAssignmentRuleController = new ShiftAssignmentRuleController();
