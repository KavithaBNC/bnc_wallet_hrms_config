import { z } from 'zod';

export const createLocationSchema = z.object({
  organizationId: z.string().uuid(),
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().max(50).optional().nullable(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
