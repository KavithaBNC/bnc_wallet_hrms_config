import { Request, Response, NextFunction } from 'express';
import { leavePolicyService } from '../services/leave-policy.service';

export class LeavePolicyController {
  /**
   * Create new leave policy
   * POST /api/v1/leaves/policies
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const policy = await leavePolicyService.create(req.body);

      return res.status(201).json({
        status: 'success',
        message: 'Leave policy created successfully',
        data: { policy },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all leave policies
   * GET /api/v1/leaves/policies
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await leavePolicyService.getAll(req.query as any);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get leave policy by ID
   * GET /api/v1/leaves/policies/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const policy = await leavePolicyService.getById(id);

      return res.status(200).json({
        status: 'success',
        data: { policy },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update leave policy
   * PUT /api/v1/leaves/policies/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const policy = await leavePolicyService.update(id, req.body);

      return res.status(200).json({
        status: 'success',
        message: 'Leave policy updated successfully',
        data: { policy },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete leave policy
   * DELETE /api/v1/leaves/policies/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await leavePolicyService.delete(id);

      return res.status(200).json({
        status: 'success',
        message: 'Leave policy deleted successfully',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Check eligibility for leave type
   * GET /api/v1/leaves/policies/check-eligibility
   */
  async checkEligibility(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, leaveTypeId } = req.query;

      if (!employeeId || !leaveTypeId) {
        return res.status(400).json({
          status: 'fail',
          message: 'employeeId and leaveTypeId are required',
        });
      }

      const result = await leavePolicyService.checkEligibility(
        employeeId as string,
        leaveTypeId as string
      );

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const leavePolicyController = new LeavePolicyController();
