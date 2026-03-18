import { z } from 'zod';

const incrementComponentSchema = z.object({
  component: z.string(),
  currentValue: z.number(),
  incrementValue: z.number(),
});

export const createTransferPromotionSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  paygroupId: z.string().uuid().optional().nullable(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appliedFrom: z.string().min(1).max(50),
  isIncrement: z.boolean().default(true),
  incrementFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  afterLOP: z.number().min(0).default(0),
  beforeLOP: z.number().min(0).default(0),
  incrementComponents: z.array(incrementComponentSchema).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateTransferPromotionSchema = z.object({
  paygroupId: z.string().uuid().optional().nullable(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  appliedFrom: z.string().min(1).max(50).optional(),
  isIncrement: z.boolean().optional(),
  incrementFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  afterLOP: z.number().min(0).optional(),
  beforeLOP: z.number().min(0).optional(),
  incrementComponents: z.array(incrementComponentSchema).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const queryTransferPromotionsSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  search: z.string().optional(),
});

export type CreateTransferPromotionInput = z.infer<typeof createTransferPromotionSchema>;
export type UpdateTransferPromotionInput = z.infer<typeof updateTransferPromotionSchema>;
export type QueryTransferPromotionsInput = z.infer<typeof queryTransferPromotionsSchema>;
