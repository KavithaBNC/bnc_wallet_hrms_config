import { z } from 'zod';

export const createEsopSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  financialYear: z.string().min(1).max(20),
  noOfEsop: z.coerce.number().int().min(0),
  dateOfAllocation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  visted: z.string().max(255).optional().nullable(),
});

export const createEsopBulkSchema = z.object({
  organizationId: z.string().uuid(),
  financialYear: z.string().min(1).max(20),
  records: z.array(
    z.object({
      employeeId: z.string().uuid(),
      noOfEsop: z.coerce.number().int().min(0),
      dateOfAllocation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      visted: z.string().max(255).optional().nullable(),
    })
  ),
});

export const updateEsopSchema = z.object({
  noOfEsop: z.coerce.number().int().min(0).optional(),
  dateOfAllocation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  visted: z.string().max(255).optional().nullable(),
});

export const queryEsopSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  financialYear: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  search: z.string().optional(),
});

export type CreateEsopInput = z.infer<typeof createEsopSchema>;
export type CreateEsopBulkInput = z.infer<typeof createEsopBulkSchema>;
export type UpdateEsopInput = z.infer<typeof updateEsopSchema>;
export type QueryEsopInput = z.infer<typeof queryEsopSchema>;
