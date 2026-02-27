import { Request, Response } from 'express';
import { EncashmentCarryForwardService } from '../services/encashment-carry-forward.service';

const encashmentCarryForwardService = new EncashmentCarryForwardService();

export class EncashmentCarryForwardController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId || req.query.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }

      const rule = await encashmentCarryForwardService.create({
        organizationId,
        displayName: req.body.displayName,
        associateId: req.body.associateId,
        paygroupIds: req.body.paygroupIds,
        departmentIds: req.body.departmentIds,
        remarks: req.body.remarks,
        maxEncashmentDays: req.body.maxEncashmentDays,
        isEncashmentApplicable: req.body.isEncashmentApplicable,
        maxCarryForwardDays: req.body.maxCarryForwardDays,
        isCarryForwardApplicable: req.body.isCarryForwardApplicable,
        eventType: req.body.eventType,
      });

      return res.status(201).json({
        message: 'Encashment/Carry Forward rule created successfully',
        data: { rule },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create encashment/carry forward rule';
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

      const result = await encashmentCarryForwardService.getAll({
        organizationId,
        page: page?.toString(),
        limit: limit?.toString(),
        search,
        eventType,
      });

      return res.status(200).json({
        message: 'Encashment/Carry Forward rules retrieved successfully',
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve encashment/carry forward rules';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const rule = await encashmentCarryForwardService.getById(req.params.id);

      return res.status(200).json({
        message: 'Encashment/Carry Forward rule retrieved successfully',
        data: { rule },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve encashment/carry forward rule';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const rule = await encashmentCarryForwardService.update(req.params.id, {
        displayName: req.body.displayName,
        associateId: req.body.associateId,
        paygroupIds: req.body.paygroupIds,
        departmentIds: req.body.departmentIds,
        remarks: req.body.remarks,
        maxEncashmentDays: req.body.maxEncashmentDays,
        isEncashmentApplicable: req.body.isEncashmentApplicable,
        maxCarryForwardDays: req.body.maxCarryForwardDays,
        isCarryForwardApplicable: req.body.isCarryForwardApplicable,
        eventType: req.body.eventType,
      });

      return res.status(200).json({
        message: 'Encashment/Carry Forward rule updated successfully',
        data: { rule },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update encashment/carry forward rule';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await encashmentCarryForwardService.delete(req.params.id);

      return res.status(200).json({
        message: 'Encashment/Carry Forward rule deleted successfully',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete encashment/carry forward rule';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }
}
