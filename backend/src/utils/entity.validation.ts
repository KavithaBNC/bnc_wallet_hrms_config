import { z } from 'zod';

export const createEntitySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().max(50).optional().nullable(),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
