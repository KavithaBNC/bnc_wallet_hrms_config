import { Request, Response, NextFunction } from 'express';
import { entityService } from '../services/entity.service';
import { createEntitySchema, updateEntitySchema } from '../utils/entity.validation';
import { generateEntityExcel, processEntityUpload } from '../services/designation-entity-bulk.service';

export class EntityController {
  async getByOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query as { organizationId: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const list = await entityService.getByOrganization(organizationId);
      return res.status(200).json({ status: 'success', data: { entities: list } });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createEntitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: 'fail', message: parsed.error.message });
      }
      const entity = await entityService.create(parsed.data);
      return res.status(201).json({ status: 'success', data: { entity } });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = updateEntitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: 'fail', message: parsed.error.message });
      }
      const entity = await entityService.update(id, parsed.data);
      return res.status(200).json({ status: 'success', message: 'Entity updated successfully', data: { entity } });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await entityService.softDelete(id);
      return res.status(200).json({ status: 'success', message: result.message });
    } catch (error) {
      return next(error);
    }
  }

  async downloadExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query as { organizationId: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const buffer = await generateEntityExcel(organizationId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=entities_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  }

  async uploadExcel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'Excel file is required' });
      }
      const organizationId = req.body.organizationId;
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId is required' });
      }
      const result = await processEntityUpload(req.file.buffer, organizationId);
      return res.status(200).json({
        status: 'success',
        message: `Import complete: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed`,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}
export const entityController = new EntityController();
