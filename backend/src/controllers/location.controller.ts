import { Request, Response, NextFunction } from 'express';
import { locationService } from '../services/location.service';
import { createLocationSchema } from '../utils/location.validation';

export class LocationController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, entityId } = req.query as { organizationId?: string; entityId?: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const list = entityId
        ? await locationService.getByEntity(entityId)
        : await locationService.getByOrganization(organizationId);
      return res.status(200).json({ status: 'success', data: { locations: list } });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createLocationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: 'fail', message: parsed.error.message });
      }
      const location = await locationService.create(parsed.data);
      return res.status(201).json({ status: 'success', data: { location } });
    } catch (error) {
      return next(error);
    }
  }
}
export const locationController = new LocationController();
