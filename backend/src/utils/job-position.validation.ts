import { z } from 'zod';

/**
 * Validation schema for creating job position
 */
export const createJobPositionSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(2).max(255),
  code: z.string().min(2).max(50).optional(),
  departmentId: z.string().uuid().optional().nullable(),
  level: z.enum([
    'ENTRY',
    'JUNIOR',
    'SENIOR',
    'LEAD',
    'MANAGER',
    'DIRECTOR',
    'VP',
    'C_LEVEL',
  ]).optional(),
  employmentType: z.enum([
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'INTERN',
  ]).optional(),
  description: z.string().max(5000).optional(),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  salaryRangeMin: z.number().positive().optional(),
  salaryRangeMax: z.number().positive().optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Validation schema for updating job position
 */
export const updateJobPositionSchema = z.object({
  title: z.string().min(2).max(255).optional(),
  code: z.string().min(2).max(50).optional(),
  departmentId: z.string().uuid().optional().nullable(),
  level: z.enum([
    'ENTRY',
    'JUNIOR',
    'SENIOR',
    'LEAD',
    'MANAGER',
    'DIRECTOR',
    'VP',
    'C_LEVEL',
  ]).optional(),
  employmentType: z.enum([
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'INTERN',
  ]).optional(),
  description: z.string().max(5000).optional(),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  salaryRangeMin: z.number().positive().optional(),
  salaryRangeMax: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Validation schema for querying job positions
 */
export const queryJobPositionsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  level: z.enum([
    'ENTRY',
    'JUNIOR',
    'SENIOR',
    'LEAD',
    'MANAGER',
    'DIRECTOR',
    'VP',
    'C_LEVEL',
  ]).optional(),
  employmentType: z.enum([
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'INTERN',
  ]).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  sortBy: z.enum(['title', 'code', 'level', 'createdAt']).optional().default('title'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type CreateJobPositionInput = z.infer<typeof createJobPositionSchema>;
export type UpdateJobPositionInput = z.infer<typeof updateJobPositionSchema>;
export type QueryJobPositionsInput = z.infer<typeof queryJobPositionsSchema>;
