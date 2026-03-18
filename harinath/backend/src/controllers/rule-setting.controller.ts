import { Request, Response } from 'express';
import { RuleSettingService } from '../services/rule-setting.service';

const ruleSettingService = new RuleSettingService();

export class RuleSettingController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId || req.query.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const ruleSetting = await ruleSettingService.create({
        organizationId,
        eventId: req.body.eventId,
        eventType: req.body.eventType,
        displayName: req.body.displayName,
        associate: req.body.associate,
        associateIds: req.body.associateIds,
        paygroupId: req.body.paygroupId,
        departmentId: req.body.departmentId,
        priority: req.body.priority,
        remarks: req.body.remarks,
        eventRuleDefinition: req.body.eventRuleDefinition,
      });
      return res.status(201).json({
        message: 'Rule setting created successfully',
        data: { ruleSetting },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create rule setting';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const search = req.query.search ? String(req.query.search) : undefined;
      const eventId = req.query.eventId ? String(req.query.eventId) : undefined;
      const eventType = req.query.eventType ? String(req.query.eventType) : undefined;

      const result = await ruleSettingService.getAll({
        organizationId,
        eventId,
        eventType,
        page: page?.toString(),
        limit: limit?.toString(),
        search,
      });
      return res.status(200).json({
        message: 'Rule settings retrieved successfully',
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve rule settings';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const ruleSetting = await ruleSettingService.getById(req.params.id);
      return res.status(200).json({
        message: 'Rule setting retrieved successfully',
        data: { ruleSetting },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve rule setting';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const ruleSetting = await ruleSettingService.update(req.params.id, {
        eventId: req.body.eventId,
        eventType: req.body.eventType,
        displayName: req.body.displayName,
        associate: req.body.associate,
        associateIds: req.body.associateIds,
        paygroupId: req.body.paygroupId,
        departmentId: req.body.departmentId,
        priority: req.body.priority,
        remarks: req.body.remarks,
        eventRuleDefinition: req.body.eventRuleDefinition,
      });
      return res.status(200).json({
        message: 'Rule setting updated successfully',
        data: { ruleSetting },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update rule setting';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await ruleSettingService.delete(req.params.id);
      return res.status(200).json({
        message: 'Rule setting deleted successfully',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete rule setting';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }
}
