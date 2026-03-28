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

      if (!req.user?.userId) {
        throw new AppError('User authentication required', 401);
      }

      const createSalaryRecords = req.body.createSalaryRecords === 'true';
      const skipConfiguratorSync = req.body.skipConfiguratorSync === 'true';

      console.log('[BulkImport Controller] Starting import:', {
        fileName: file.originalname,
        fileSize: file.size,
        organizationId,
        userId: req.user.userId,
        createSalaryRecords,
        skipConfiguratorSync,
      });

      const configuratorAccessToken = req.body.configuratorAccessToken || null;

      const result = await employeeBulkImportService.bulkImport(
        file.buffer,
        file.originalname,
        organizationId,
        req.user.userId,
        { createSalaryRecords, skipConfiguratorSync, configuratorAccessToken },
      );

      console.log('[BulkImport Controller] Import completed:', {
        total: result.total,
        success: result.success,
        updated: result.updated,
        failed: result.failed,
        configuratorSyncStatus: result.configuratorSyncStatus,
      });

      res.status(200).json({
        status: 'success',
        message: `Import complete: ${result.success} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`,
        data: result,
      });
    } catch (error: any) {
      console.error('[BulkImport Controller] ERROR:', error?.message, error?.stack?.split('\n').slice(0, 5).join('\n'));
      if (error instanceof AppError) {
        // Return structured validation errors directly for frontend consumption
        if (error.validationErrors && error.validationErrors.length > 0) {
          res.status(error.statusCode).json({
            status: 'error',
            message: error.message,
            validationErrors: error.validationErrors,
          });
          return;
        }
        next(error);
      } else {
        next(new AppError(error?.message || 'Bulk import failed with an unexpected error', 500));
      }
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
        select: { configuratorAccessToken: true, organizationId: true },
      });

      if (!tokenUser?.configuratorAccessToken) {
        throw new AppError('No Configurator access token available. Please login again.', 401);
      }

      // Look up the organization's configuratorCompanyId
      let companyId = 0;
      if (tokenUser.organizationId) {
        const org = await prisma.organization.findUnique({
          where: { id: tokenUser.organizationId },
          select: { configuratorCompanyId: true },
        });
        companyId = org?.configuratorCompanyId ?? 0;
      }

      const buffer = await configuratorService.downloadEmployeeImportTemplate(
        tokenUser.configuratorAccessToken,
        companyId,
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
