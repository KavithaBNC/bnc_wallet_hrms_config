import { z } from 'zod';

export const createLoanSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  loanType: z.enum(['SALARY_ADVANCE', 'PERSONAL_LOAN', 'TRAVEL_ADVANCE', 'INSURANCE_ADVANCE', 'OTHER']),
  loanAmount: z.number().positive(),
  emiAmount: z.number().positive().optional(),
  totalEmis: z.number().int().positive().optional(),
  interestRate: z.number().min(0).max(100).optional(),
  startDate: z.string(),
  reason: z.string().max(1000).optional(),
});

export const updateLoanSchema = z.object({
  loanType: z.enum(['SALARY_ADVANCE', 'PERSONAL_LOAN', 'TRAVEL_ADVANCE', 'INSURANCE_ADVANCE', 'OTHER']).optional(),
  emiAmount: z.number().positive().optional(),
  totalEmis: z.number().int().positive().optional(),
  interestRate: z.number().min(0).max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().max(1000).optional(),
});

export const queryLoanSchema = z.object({
  organizationId: z.string().uuid(),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('10'),
  status: z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'CLOSED', 'REJECTED', 'WRITTEN_OFF']).optional(),
  loanType: z.enum(['SALARY_ADVANCE', 'PERSONAL_LOAN', 'TRAVEL_ADVANCE', 'INSURANCE_ADVANCE', 'OTHER']).optional(),
  employeeId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const recordRepaymentSchema = z.object({
  amount: z.number().positive(),
  principalAmount: z.number().min(0).optional(),
  interestAmount: z.number().min(0).optional(),
  repaymentDate: z.string(),
  payrollCycleId: z.string().uuid().optional(),
  remarks: z.string().max(500).optional(),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type QueryLoanInput = z.infer<typeof queryLoanSchema>;
export type RecordRepaymentInput = z.infer<typeof recordRepaymentSchema>;
