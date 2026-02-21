import { Request, Response } from 'express';
import { PostToPayrollService } from '../services/post-to-payroll.service';

const postToPayrollService = new PostToPayrollService();

export class PostToPayrollController {
  async getAll(req: Request, res: Response) {
    try {
      const organizationId = (req.query.organizationId || req.body?.organizationId) as string | undefined;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const showAllParam = req.query.showAll;
      const showAll = showAllParam === undefined ? true : String(showAllParam).toLowerCase() === 'true';
      const list = await postToPayrollService.getAll(organizationId, showAll);
      return res.status(200).json({
        message: 'Post to payroll mappings retrieved successfully',
        data: { list },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve mappings';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }

  async saveAll(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId as string | undefined;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
      const list = await postToPayrollService.saveAll(organizationId, rows);
      return res.status(200).json({
        message: 'Post to payroll mappings saved successfully',
        data: { list },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save mappings';
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 500;
      return res.status(status).json({ message });
    }
  }
}
