import { Request, Response } from 'express';
import { compoundService } from '../services/compound.service';

export class CompoundController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const { componentType, shortName, longName, type } = req.body;
      if (!componentType?.trim()) return res.status(400).json({ message: 'Component Type is required' });
      if (!shortName?.trim()) return res.status(400).json({ message: 'Short Name is required' });
      if (!longName?.trim()) return res.status(400).json({ message: 'Long Name is required' });
      if (!type?.trim()) return res.status(400).json({ message: 'Type is required' });
      const compound = await compoundService.create({
        organizationId,
        componentType: req.body.componentType,
        shortName: req.body.shortName,
        longName: req.body.longName,
        type: req.body.type,
        isDropDown: req.body.isDropDown,
        isCompulsory: req.body.isCompulsory,
        isFilterable: req.body.isFilterable,
        reimbDetails: req.body.reimbDetails,
        showInPayslip: req.body.showInPayslip,
        values: req.body.values,
      });
      return res.status(201).json({
        message: 'Compound created successfully',
        data: { compound },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create compound';
      const status = (error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : null) ?? 500;
      return res.status(status).json({ message });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const result = await compoundService.getAll({
        organizationId,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        componentType: req.query.componentType as string | undefined,
        type: req.query.type as string | undefined,
      });
      return res.status(200).json({
        message: 'Compounds retrieved successfully',
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve compounds';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const compound = await compoundService.getById(req.params.id);
      return res.status(200).json({
        message: 'Compound retrieved successfully',
        data: { compound },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Compound not found';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const compound = await compoundService.update(req.params.id, {
        componentType: req.body.componentType,
        shortName: req.body.shortName,
        longName: req.body.longName,
        type: req.body.type,
        isDropDown: req.body.isDropDown,
        isCompulsory: req.body.isCompulsory,
        isFilterable: req.body.isFilterable,
        reimbDetails: req.body.reimbDetails,
        showInPayslip: req.body.showInPayslip,
        values: req.body.values,
      });
      return res.status(200).json({
        message: 'Compound updated successfully',
        data: { compound },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update compound';
      const status = (error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : null) ?? 500;
      return res.status(status).json({ message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await compoundService.delete(req.params.id);
      return res.status(200).json({
        message: 'Compound deleted successfully',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete compound';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }
}

export const compoundController = new CompoundController();
