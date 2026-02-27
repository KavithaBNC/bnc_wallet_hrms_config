import { Request, Response } from 'express';
import { AutoCreditSettingService } from '../services/auto-credit-setting.service';

const autoCreditSettingService = new AutoCreditSettingService();

export class AutoCreditSettingController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId || req.query.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const autoCreditSetting = await autoCreditSettingService.create({
        organizationId,
        eventType: req.body.eventType,
        displayName: req.body.displayName,
        associate: req.body.associate,
        associateIds: req.body.associateIds,
        paygroupId: req.body.paygroupId,
        paygroupIds: req.body.paygroupIds,
        departmentId: req.body.departmentId,
        departmentIds: req.body.departmentIds,
        condition: req.body.condition,
        effectiveDate: req.body.effectiveDate,
        effectiveTo: req.body.effectiveTo,
        priority: req.body.priority,
        remarks: req.body.remarks,
        autoCreditRule: req.body.autoCreditRule,
      });
      return res.status(201).json({
        message: 'Auto credit setting created successfully',
        data: { autoCreditSetting },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create auto credit setting';
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
      const eventType = req.query.eventType ? String(req.query.eventType) : undefined;

      const result = await autoCreditSettingService.getAll({
        organizationId,
        eventType,
        page: page?.toString(),
        limit: limit?.toString(),
        search,
      });
      return res.status(200).json({
        message: 'Auto credit settings retrieved successfully',
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve auto credit settings';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const autoCreditSetting = await autoCreditSettingService.getById(req.params.id);
      return res.status(200).json({
        message: 'Auto credit setting retrieved successfully',
        data: { autoCreditSetting },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve auto credit setting';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const autoCreditSetting = await autoCreditSettingService.update(req.params.id, {
        eventType: req.body.eventType,
        displayName: req.body.displayName,
        associate: req.body.associate,
        associateIds: req.body.associateIds,
        paygroupId: req.body.paygroupId,
        paygroupIds: req.body.paygroupIds,
        departmentId: req.body.departmentId,
        departmentIds: req.body.departmentIds,
        condition: req.body.condition,
        effectiveDate: req.body.effectiveDate,
        effectiveTo: req.body.effectiveTo,
        priority: req.body.priority,
        remarks: req.body.remarks,
        autoCreditRule: req.body.autoCreditRule,
      });
      return res.status(200).json({
        message: 'Auto credit setting updated successfully',
        data: { autoCreditSetting },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update auto credit setting';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await autoCreditSettingService.delete(req.params.id);
      return res.status(200).json({
        message: 'Auto credit setting deleted successfully',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete auto credit setting';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }
}
