import { z } from 'zod';

/**
 * Validation schema for creating organization
 */
export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(255),
  legalName: z.string().min(2).max(255).optional(),
  industry: z.string().max(100).optional(),
  sizeRange: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional(),
  taxId: z.string().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),
  website: z.string().url().max(255).optional().or(z.literal('')),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  timezone: z.string().max(50).default('UTC'),
  currency: z.string().length(3).default('USD'),
  fiscalYearStart: z.string().optional(), // ISO date string
  settings: z.object({
    workingDays: z.array(z.number().min(0).max(6)).optional(),
    workingHoursStart: z.string().optional(),
    workingHoursEnd: z.string().optional(),
    overtimeEnabled: z.boolean().optional(),
    leaveApprovalRequired: z.boolean().optional(),
  }).optional(),
  employeeIdPrefix: z.string().max(20).optional(),
  employeeIdStartingNumber: z.number().int().min(0).optional(),
});

/**
 * Validation schema for updating organization
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  legalName: z.string().min(2).max(255).optional(),
  industry: z.string().max(100).optional(),
  sizeRange: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional(),
  taxId: z.string().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),
  website: z.string().url().max(255).optional().or(z.literal('')),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  timezone: z.string().max(50).optional(),
  currency: z.string().length(3).optional(),
  fiscalYearStart: z.string().optional(), // ISO date string
  settings: z.object({
    workingDays: z.array(z.number().min(0).max(6)).optional(),
    workingHoursStart: z.string().optional(),
    workingHoursEnd: z.string().optional(),
    overtimeEnabled: z.boolean().optional(),
    leaveApprovalRequired: z.boolean().optional(),
  }).optional(),
  employeeIdPrefix: z.string().max(20).optional(),
  employeeIdStartingNumber: z.number().int().min(0).optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
