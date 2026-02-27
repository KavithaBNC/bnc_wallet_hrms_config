import { z } from 'zod';

const transferComponentSchema = z.object({
  component: z.string(),
  currentValue: z.string(),
  newValue: z.string(),
});

export const createTransferPromotionEntrySchema = z.object({
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  paygroupId: z.string().uuid().optional().nullable(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks: z.string().max(500).optional().nullable(),
  promotionEnabled: z.boolean().default(false),
  promotionFromId: z.string().uuid().optional().nullable(),
  promotionToId: z.string().uuid().optional().nullable(),
  transferComponents: z.array(transferComponentSchema).optional().nullable(),
});

export const updateTransferPromotionEntrySchema = z.object({
  paygroupId: z.string().uuid().optional().nullable(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  remarks: z.string().max(500).optional().nullable(),
  promotionEnabled: z.boolean().optional(),
  promotionFromId: z.string().uuid().optional().nullable(),
  promotionToId: z.string().uuid().optional().nullable(),
  transferComponents: z.array(transferComponentSchema).optional().nullable(),
});

export const queryTransferPromotionEntriesSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  search: z.string().optional(),
});

export type CreateTransferPromotionEntryInput = z.infer<typeof createTransferPromotionEntrySchema>;
export type UpdateTransferPromotionEntryInput = z.infer<typeof updateTransferPromotionEntrySchema>;
export type QueryTransferPromotionEntriesInput = z.infer<typeof queryTransferPromotionEntriesSchema>;
