import { Request, Response } from 'express';
import { RightsAllocationService } from '../services/rights-allocation.service';

const rightsAllocationService = new RightsAllocationService();

export class RightsAllocationController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId || req.query.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }

      const rightsAllocation = await rightsAllocationService.create({
        organizationId,
        shortName: req.body.shortName,
        longName: req.body.longName,
        remarks: req.body.remarks,
        shiftId: req.body.shiftId,
        maxExcessTimeRequestDays: req.body.maxExcessTimeRequestDays,
        monthlyRegularizationCount: req.body.monthlyRegularizationCount,
        attendanceEvents: req.body.attendanceEvents,
        excessTimeEvents: req.body.excessTimeEvents,
        requestTypeEvents: req.body.requestTypeEvents,
        regularizationElements: req.body.regularizationElements,
      });

      return res.status(201).json({
        message: 'Rights allocation created successfully',
        data: { rightsAllocation },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create rights allocation';
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

      const result = await rightsAllocationService.getAll({
        organizationId,
        page: page?.toString(),
        limit: limit?.toString(),
        search,
      });

      return res.status(200).json({
        message: 'Rights allocations retrieved successfully',
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve rights allocations';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const rightsAllocation = await rightsAllocationService.getById(req.params.id);

      return res.status(200).json({
        message: 'Rights allocation retrieved successfully',
        data: { rightsAllocation },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve rights allocation';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const rightsAllocation = await rightsAllocationService.update(req.params.id, {
        shortName: req.body.shortName,
        longName: req.body.longName,
        remarks: req.body.remarks,
        shiftId: req.body.shiftId,
        maxExcessTimeRequestDays: req.body.maxExcessTimeRequestDays,
        monthlyRegularizationCount: req.body.monthlyRegularizationCount,
        attendanceEvents: req.body.attendanceEvents,
        excessTimeEvents: req.body.excessTimeEvents,
        requestTypeEvents: req.body.requestTypeEvents,
        regularizationElements: req.body.regularizationElements,
      });

      return res.status(200).json({
        message: 'Rights allocation updated successfully',
        data: { rightsAllocation },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update rights allocation';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await rightsAllocationService.delete(req.params.id);

      return res.status(200).json({
        message: 'Rights allocation deleted successfully',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete rights allocation';
      const status = error && typeof error === 'object' && 'status' in error ? (error.status as number) : 500;
      return res.status(status).json({ message });
    }
  }
}
