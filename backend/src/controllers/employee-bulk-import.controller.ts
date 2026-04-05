import { Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import { employeeBulkImportService } from '../services/employee-bulk-import.service';
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

      const result = await employeeBulkImportService.bulkImport(
        file.buffer,
        file.originalname,
        organizationId,
        req.user.userId,
        { createSalaryRecords, skipConfiguratorSync },
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
   * Download employee import template — generated locally (no RAG API needed).
   * GET /api/v1/employees/import-template
   */
  async downloadTemplate(_req: Request, res: Response, next: NextFunction) {
    try {
      // Generate a blank template with the expected column headers
      const headers = [
        'first_name', 'last_name', 'email', 'phone', 'password',
        'department', 'sub_department', 'cost_centre', 'manager',
        'employee_code', 'designation', 'date_of_joining', 'date_of_birth',
        'gender', 'marital_status', 'blood_group', 'nationality',
        'role', 'paygroup', 'entity', 'place_of_tax_deduction',
        'basic_salary', 'hra', 'conveyance', 'medical', 'special_allowance',
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employees');
      const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="employee_import_template_${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}

export const employeeBulkImportController = new EmployeeBulkImportController();
