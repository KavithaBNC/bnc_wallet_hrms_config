import { z } from 'zod';

export const queryPaygroupsSchema = z.object({
  organizationId: z.string().uuid(),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional().default('true'),
});

export const createPaygroupSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1, 'Paygroup name is required').max(255),
  code: z.string().max(50).optional().nullable(),
});

export type QueryPaygroupsInput = z.infer<typeof queryPaygroupsSchema>;
export type CreatePaygroupInput = z.infer<typeof createPaygroupSchema>;
