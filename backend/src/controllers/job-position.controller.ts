import { Request, Response, NextFunction } from 'express';
import { jobPositionService } from '../services/job-position.service';
import { generateDesignationExcel, processDesignationUpload } from '../services/designation-entity-bulk.service';

export class JobPositionController {
  /**
   * Create new job position
   * POST /api/v1/positions
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const position = await jobPositionService.create(req.body);

      res.status(201).json({
        status: 'success',
        message: 'Job position created successfully',
        data: { position },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all job positions with filtering
   * GET /api/v1/positions
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await jobPositionService.getAll(req.query as any);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get job position by ID
   * GET /api/v1/positions/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const position = await jobPositionService.getById(id);

      // Verify organization access for non-SUPER_ADMIN users
      if (req.rbac?.organizationId && position.organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied. You can only access positions from your organization.',
        });
      }

      res.status(200).json({
        status: 'success',
        data: { position },
      });
      return;
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update job position
   * PUT /api/v1/positions/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Verify organization access before updating
      if (req.rbac?.organizationId) {
        const existing = await jobPositionService.getById(id);
        if (existing.organizationId !== req.rbac.organizationId) {
          return res.status(403).json({
            status: 'fail',
            message: 'Access denied. You can only update positions from your organization.',
          });
        }
      }

      const position = await jobPositionService.update(id, req.body);

      res.status(200).json({
        status: 'success',
        message: 'Job position updated successfully',
        data: { position },
      });
      return;
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete job position
   * DELETE /api/v1/positions/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Verify organization access before deleting
      if (req.rbac?.organizationId) {
        const existing = await jobPositionService.getById(id);
        if (existing.organizationId !== req.rbac.organizationId) {
          return res.status(403).json({
            status: 'fail',
            message: 'Access denied. You can only delete positions from your organization.',
          });
        }
      }

      const result = await jobPositionService.delete(id);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
      return;
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get positions by department
   * GET /api/v1/positions/department/:departmentId
   */
  async getByDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const { departmentId } = req.params;
      const positions = await jobPositionService.getByDepartment(departmentId);

      res.status(200).json({
        status: 'success',
        data: { positions },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get position statistics
   * GET /api/v1/positions/statistics/:organizationId
   */
  async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.params;
      const statistics = await jobPositionService.getStatistics(organizationId);

      res.status(200).json({
        status: 'success',
        data: { statistics },
      });
    } catch (error) {
      next(error);
    }
  }
  async downloadExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query as { organizationId: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const buffer = await generateDesignationExcel(organizationId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=designations_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
      const result = await processDesignationUpload(req.file.buffer, organizationId);
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

export const jobPositionController = new JobPositionController();
