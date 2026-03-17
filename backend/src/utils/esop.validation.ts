import { z } from 'zod';

// ─────────────────────────────────────────────
// ESOP Pool Schemas
// ─────────────────────────────────────────────
export const createPoolSchema = z.object({
  organizationId: z.string().uuid(),
  poolName: z.string().min(1).max(255),
  totalShares: z.number().int().positive(),
  sharePrice: z.number().positive(),
  currency: z.string().max(3).default('INR'),
  description: z.string().optional().nullable(),
});

export const updatePoolSchema = z.object({
  poolName: z.string().min(1).max(255).optional(),
  totalShares: z.number().int().positive().optional(),
  sharePrice: z.number().positive().optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const queryPoolSchema = z.object({
  organizationId: z.string().uuid(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─────────────────────────────────────────────
// Vesting Plan Schemas
// ─────────────────────────────────────────────
export const createVestingPlanSchema = z.object({
  organizationId: z.string().uuid(),
  planName: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  vestingPeriodMonths: z.number().int().positive().min(1),
  cliffMonths: z.number().int().min(0).default(0),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
}).refine((d) => d.cliffMonths <= d.vestingPeriodMonths, {
  message: 'Cliff months cannot exceed vesting period months',
  path: ['cliffMonths'],
});

export const updateVestingPlanSchema = z.object({
  planName: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  vestingPeriodMonths: z.number().int().positive().optional(),
  cliffMonths: z.number().int().min(0).optional(),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  isActive: z.boolean().optional(),
});

export const queryVestingPlanSchema = z.object({
  organizationId: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─────────────────────────────────────────────
// ESOP Grant Schemas
// ─────────────────────────────────────────────
export const createGrantSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  poolId: z.string().uuid(),
  vestingPlanId: z.string().uuid(),
  grantDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  totalShares: z.number().int().positive(),
  grantPrice: z.number().positive(),
  remarks: z.string().optional().nullable(),
});

export const queryGrantSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  poolId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'CANCELLED', 'COMPLETED']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─────────────────────────────────────────────
// Vesting Schedule Schemas
// ─────────────────────────────────────────────
export const queryVestingScheduleSchema = z.object({
  organizationId: z.string().uuid(),
  grantId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'VESTED', 'LAPSED']).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const processVestingSchema = z.object({
  organizationId: z.string().uuid(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─────────────────────────────────────────────
// Exercise Request Schemas
// ─────────────────────────────────────────────
export const createExerciseRequestSchema = z.object({
  organizationId: z.string().uuid(),
  grantId: z.string().uuid(),
  employeeId: z.string().uuid(),
  sharesRequested: z.number().int().positive(),
  exercisePrice: z.number().positive(),
  remarks: z.string().optional().nullable(),
});

export const rejectExerciseSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});

export const queryExerciseSchema = z.object({
  organizationId: z.string().uuid(),
  grantId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─────────────────────────────────────────────
// Ledger Query Schema
// ─────────────────────────────────────────────
export const queryLedgerSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  grantId: z.string().uuid().optional(),
  transactionType: z
    .enum([
      'POOL_CREATED','POOL_UPDATED','PLAN_CREATED',
      'GRANT_ISSUED','GRANT_CANCELLED','SHARES_VESTED',
      'EXERCISE_REQUESTED','EXERCISE_APPROVED','EXERCISE_REJECTED','EXERCISE_COMPLETED',
    ])
    .optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────
export type CreatePoolInput = z.infer<typeof createPoolSchema>;
export type UpdatePoolInput = z.infer<typeof updatePoolSchema>;
export type QueryPoolInput = z.infer<typeof queryPoolSchema>;

export type CreateVestingPlanInput = z.infer<typeof createVestingPlanSchema>;
export type UpdateVestingPlanInput = z.infer<typeof updateVestingPlanSchema>;
export type QueryVestingPlanInput = z.infer<typeof queryVestingPlanSchema>;

export type CreateGrantInput = z.infer<typeof createGrantSchema>;
export type QueryGrantInput = z.infer<typeof queryGrantSchema>;

export type QueryVestingScheduleInput = z.infer<typeof queryVestingScheduleSchema>;
export type ProcessVestingInput = z.infer<typeof processVestingSchema>;

export type CreateExerciseRequestInput = z.infer<typeof createExerciseRequestSchema>;
export type RejectExerciseInput = z.infer<typeof rejectExerciseSchema>;
export type QueryExerciseInput = z.infer<typeof queryExerciseSchema>;

export type QueryLedgerInput = z.infer<typeof queryLedgerSchema>;
