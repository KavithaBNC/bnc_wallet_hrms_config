import { z } from 'zod';

/**
 * Validation schema for creating department
 */
export const createDepartmentSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(255),
  code: z.string().min(2).max(50).optional(),
  description: z.string().max(1000).optional(),
  parentDepartmentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  costCenter: z.string().max(50).optional(),
  location: z.string().max(255).optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Validation schema for updating department
 */
export const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  code: z.string().min(2).max(50).optional(),
  description: z.string().max(1000).optional(),
  parentDepartmentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  costCenter: z.string().max(50).optional(),
  location: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Validation schema for querying departments
 */
export const queryDepartmentsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  parentDepartmentId: z.string().uuid().optional().nullable(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  sortBy: z.enum(['name', 'code', 'createdAt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  listView: z.enum(['true', 'false']).optional(), // lighter response for list page
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type QueryDepartmentsInput = z.infer<typeof queryDepartmentsSchema>;
