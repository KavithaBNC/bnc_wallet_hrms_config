import { Request, Response, NextFunction } from 'express';
import { costCentreService } from '../services/cost-centre.service';
import { generateCostCentreExcel, processCostCentreUpload } from '../services/department-masters-bulk.service';

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

  /** Download sample Excel template. GET /api/v1/cost-centres/download-excel */
  async downloadExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query as { organizationId: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const configToken = req.headers['x-configurator-token'] as string | undefined;
      const buffer = await generateCostCentreExcel(organizationId, req.user!.userId, configToken);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=cost_centres_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  }

  /** Bulk upload cost centres from Excel. POST /api/v1/cost-centres/upload-excel */
  async uploadExcel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'Excel file is required' });
      }
      const organizationId = req.body.organizationId;
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId is required' });
      }
      const configToken = req.headers['x-configurator-token'] as string | undefined;
      const result = await processCostCentreUpload(req.file.buffer, organizationId, req.user!.userId, configToken);
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
export const costCentreController = new CostCentreController();
