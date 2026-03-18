import { Request, Response, NextFunction } from 'express';
import { employeeBulkImportService } from '../services/employee-bulk-import.service';
import { configuratorService } from '../services/configurator.service';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

export class EmployeeBulkImportController {
  /**
   * Bulk import employees from Excel file.
   * POST /api/v1/employees/bulk-import
   * Content-Type: multipart/form-data
   * Fields: file (Excel), organizationId (UUID)
   */
  async bulkImport(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        throw new AppError('Excel file is required', 400);
      }

      const organizationId = req.body.organizationId;
      if (!organizationId) {
        throw new AppError('organizationId is required', 400);
      }

      const createSalaryRecords = req.body.createSalaryRecords === 'true';
      const skipConfiguratorSync = req.body.skipConfiguratorSync === 'true';

      const result = await employeeBulkImportService.bulkImport(
        file.buffer,
        file.originalname,
        organizationId,
        req.user!.userId,
        { createSalaryRecords, skipConfiguratorSync },
      );

      res.status(200).json({
        status: 'success',
        message: `Import complete: ${result.success} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download employee import template from Configurator.
   * GET /api/v1/employees/import-template
   */
  async downloadTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const tokenUser = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { configuratorAccessToken: true },
      });

      if (!tokenUser?.configuratorAccessToken) {
        throw new AppError('No Configurator access token available. Please login again.', 401);
      }

      const buffer = await configuratorService.downloadEmployeeImportTemplate(
        tokenUser.configuratorAccessToken,
      );

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="employee_import_template_${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}

export const employeeBulkImportController = new EmployeeBulkImportController();
