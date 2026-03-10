import { z } from 'zod';

export const calculateFnfSettlementSchema = z.object({
  separationId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export const updateFnfSettlementSchema = z.object({
  otherEarnings: z.number().min(0).optional(),
  otherDeductions: z.number().min(0).optional(),
  remarks: z.string().max(2000).optional().nullable(),
});

export const queryFnfSettlementsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'CALCULATED', 'APPROVED', 'PAID']).optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('10'),
});

export type CalculateFnfSettlementInput = z.infer<typeof calculateFnfSettlementSchema>;
export type UpdateFnfSettlementInput = z.infer<typeof updateFnfSettlementSchema>;
export type QueryFnfSettlementsInput = z.infer<typeof queryFnfSettlementsSchema>;
