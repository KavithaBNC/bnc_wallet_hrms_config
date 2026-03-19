import { z } from 'zod';

export const createEntitySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().max(50).optional().nullable(),
});

export const updateEntitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
