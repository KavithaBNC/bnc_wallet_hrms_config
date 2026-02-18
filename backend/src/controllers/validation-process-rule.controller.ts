import { Request, Response } from 'express';
import { ValidationProcessRuleService } from '../services/validation-process-rule.service';

const validationProcessRuleService = new ValidationProcessRuleService();

export class ValidationProcessRuleController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId || req.query.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const rule = await validationProcessRuleService.create({
        organizationId,
        displayName: req.body.displayName,
        effectiveDate: req.body.effectiveDate,
        priority: req.body.priority,
        remarks: req.body.remarks,
        autoCorrect: req.body.autoCorrect,
        correctAfterDays: req.body.correctAfterDays,
        primaryAction: req.body.primaryAction,
        hasLimit: req.body.hasLimit,
        validationGrouping: req.body.validationGrouping,
        employeeIds: req.body.employeeIds,
        shiftIds: req.body.shiftIds,
        paygroupIds: req.body.paygroupIds,
        departmentIds: req.body.departmentIds,
        limits: req.body.limits,
        actions: req.body.actions,
      });
      return res.status(201).json({
        message: 'Validation process rule created successfully',
        data: { rule },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create validation process rule';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const result = await validationProcessRuleService.getAll({
        organizationId,
        validationGrouping: req.query.validationGrouping as string | undefined,
        effectiveOn: req.query.effectiveOn as string | undefined,
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
        search: req.query.search as string | undefined,
      });
      return res.status(200).json({
        message: 'Validation process rules retrieved successfully',
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve validation process rules';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const rule = await validationProcessRuleService.getById(req.params.id);
      return res.status(200).json({
        message: 'Validation process rule retrieved successfully',
        data: { rule },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve validation process rule';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const rule = await validationProcessRuleService.update(req.params.id, {
        displayName: req.body.displayName,
        effectiveDate: req.body.effectiveDate,
        priority: req.body.priority,
        remarks: req.body.remarks,
        autoCorrect: req.body.autoCorrect,
        correctAfterDays: req.body.correctAfterDays,
        primaryAction: req.body.primaryAction,
        hasLimit: req.body.hasLimit,
        validationGrouping: req.body.validationGrouping,
        employeeIds: req.body.employeeIds,
        shiftIds: req.body.shiftIds,
        paygroupIds: req.body.paygroupIds,
        departmentIds: req.body.departmentIds,
        limits: req.body.limits,
        actions: req.body.actions,
      });
      return res.status(200).json({
        message: 'Validation process rule updated successfully',
        data: { rule },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update validation process rule';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await validationProcessRuleService.delete(req.params.id);
      return res.status(200).json({
        message: 'Validation process rule deleted successfully',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete validation process rule';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }
}
