import { z } from 'zod';

/**
 * Validation schema for bulk import request body (organizationId comes as form field).
 * The Excel file is handled by multer middleware, not Zod.
 */
export const bulkImportBodySchema = z.object({
  organizationId: z.string().uuid(),
  createSalaryRecords: z.enum(['true', 'false']).optional().default('false'),
  skipConfiguratorSync: z.enum(['true', 'false']).optional().default('false'),
});

export type BulkImportBody = z.infer<typeof bulkImportBodySchema>;

export interface BulkImportRowResult {
  row: number;
  email?: string;
  associateCode?: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  message: string;
}

export interface BulkImportResult {
  total: number;
  success: number;
  updated: number;
  skipped: number;
  failed: number;
  managersSet: number;
  failures: BulkImportRowResult[];
  configuratorResults?: {
    total: number;
    created: number;
    updated: number;
    failed: number;
  };
  /** Status of Configurator sync: 'success' | 'failed' | 'skipped' */
  configuratorSyncStatus?: 'success' | 'failed' | 'skipped';
  /** Message about Configurator sync outcome */
  configuratorSyncMessage?: string;
}
