import { z } from 'zod';

const separationTypeEnum = z.enum([
  'RESIGNATION',
  'TERMINATION',
  'RETIREMENT',
  'CONTRACT_END',
  'ABSONDING',
  'OTHER',
]);

export const createEmployeeSeparationSchema = z.object({
  employeeId: z.string().uuid(),
  organizationId: z.string().uuid(),
  resignationApplyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  noticePeriod: z.number().int().min(0),
  noticePeriodReason: z.string().max(255).optional().nullable(),
  relievingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reasonOfLeaving: z.string().max(255).optional().nullable(),
  separationType: separationTypeEnum,
  remarks: z.string().max(2000).optional().nullable(),
});

export const updateEmployeeSeparationSchema = z.object({
  resignationApplyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  noticePeriod: z.number().int().min(0).optional(),
  noticePeriodReason: z.string().max(255).optional().nullable(),
  relievingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reasonOfLeaving: z.string().max(255).optional().nullable(),
  separationType: separationTypeEnum.optional(),
  remarks: z.string().max(2000).optional().nullable(),
});

export const queryEmployeeSeparationsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('10'),
  sortBy: z.enum(['resignationApplyDate', 'relievingDate', 'createdAt']).optional().default('resignationApplyDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateEmployeeSeparationInput = z.infer<typeof createEmployeeSeparationSchema>;
export type UpdateEmployeeSeparationInput = z.infer<typeof updateEmployeeSeparationSchema>;
export type QueryEmployeeSeparationsInput = z.infer<typeof queryEmployeeSeparationsSchema>;
