import { Request, Response, NextFunction } from 'express';
import { entityService } from '../services/entity.service';
import { createEntitySchema } from '../utils/entity.validation';

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
}
export const entityController = new EntityController();
