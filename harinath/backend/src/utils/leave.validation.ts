import { z } from 'zod';

// Leave Type Validation
export const createLeaveTypeSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  name: z.string().min(1, 'Leave type name is required').max(100, 'Name too long'),
  code: z.string().max(50, 'Code too long').optional(),
  description: z.string().optional(),
  isPaid: z.boolean().default(true),
  defaultDaysPerYear: z.number().positive().max(365).optional(),
  maxCarryForward: z.number().nonnegative().max(365).optional(),
  maxConsecutiveDays: z.number().int().positive().max(365).optional(),
  requiresDocument: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
  canBeNegative: z.boolean().default(false),
  accrualType: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY', 'NONE']).optional(),
  colorCode: z.string().max(20).optional(),
  isActive: z.boolean().default(true),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial().extend({
  organizationId: z.string().uuid().optional(),
});

export const queryLeaveTypesSchema = z.object({
  organizationId: z.string().uuid().optional(),
  isActive: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        return val === 'true' || val === '1';
      }
      return val;
    },
    z.boolean().optional()
  ),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
});

// Leave Request Validation
export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid('Invalid leave type ID'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  totalDays: z.number().positive().max(366).optional(), // Optional: for half-day/hourly (e.g. 0.5)
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000, 'Reason too long'),
  supportingDocuments: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    type: z.string(),
  })).optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end >= start;
  },
  {
    message: 'End date must be greater than or equal to start date',
    path: ['endDate'],
  }
);

export const updateLeaveRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().min(10).max(1000).optional(),
  supportingDocuments: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    type: z.string(),
  })).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end >= start;
    }
    return true;
  },
  {
    message: 'End date must be greater than or equal to start date',
    path: ['endDate'],
  }
);

export const approveLeaveRequestSchema = z.object({
  reviewComments: z.string().max(500).optional(),
});

export const rejectLeaveRequestSchema = z.object({
  reviewComments: z.string().min(10, 'Review comments are required').max(500, 'Comments too long'),
});

export const cancelLeaveRequestSchema = z.object({
  cancellationReason: z.string().min(10, 'Cancellation reason is required').max(500, 'Reason too long'),
});

export const queryLeaveRequestsSchema = z.object({
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid().optional(),
  workflowMappingId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().max(200).optional(),
  organizationId: z.string().uuid().optional(),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  sortBy: z.enum(['appliedOn', 'startDate', 'endDate', 'status']).optional().default('appliedOn'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Leave Balance Query
export const queryLeaveBalanceSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  year: z.string().regex(/^\d{4}$/, 'Invalid year format').optional(),
  leaveTypeId: z.string().uuid().optional(),
});

// Leave Calendar Query
export const queryLeaveCalendarSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  departmentId: z.string().uuid().optional(),
});

// Types
export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;
export type QueryLeaveTypesInput = z.infer<typeof queryLeaveTypesSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;
export type ApproveLeaveRequestInput = z.infer<typeof approveLeaveRequestSchema>;
export type RejectLeaveRequestInput = z.infer<typeof rejectLeaveRequestSchema>;
export type CancelLeaveRequestInput = z.infer<typeof cancelLeaveRequestSchema>;
export type QueryLeaveRequestsInput = z.infer<typeof queryLeaveRequestsSchema>;
export type QueryLeaveBalanceInput = z.infer<typeof queryLeaveBalanceSchema>;
export type QueryLeaveCalendarInput = z.infer<typeof queryLeaveCalendarSchema>;
