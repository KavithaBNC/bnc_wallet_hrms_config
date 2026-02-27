import { Request, Response, NextFunction } from 'express';
import { costCentreService } from '../services/cost-centre.service';

export class CostCentreController {
  async getByOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query as { organizationId: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const list = await costCentreService.getByOrganization(organizationId);
      return res.status(200).json({ status: 'success', data: { costCentres: list } });
    } catch (error) {
      return next(error);
    }
  }
}
export const costCentreController = new CostCentreController();
