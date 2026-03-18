import { Request, Response, NextFunction } from 'express';
import { costCentreService } from '../services/cost-centre.service';

export class CostCentreController {
  async getByOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query as { organizationId: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const list = await costCentreService.getByOrganization(organizationId, req.user?.userId);
      return res.status(200).json({ status: 'success', data: { costCentres: list } });
    } catch (error) {
      return next(error);
    }
  }

  /** Create cost centre in Config DB. POST /api/v1/cost-centres */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const created = await costCentreService.create(req.body, req.user?.userId);
      return res.status(201).json({ status: 'success', data: { costCentre: created } });
    } catch (error) {
      return next(error);
    }
  }
}
export const costCentreController = new CostCentreController();
