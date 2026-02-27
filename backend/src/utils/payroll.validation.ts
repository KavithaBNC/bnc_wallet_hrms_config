import { z } from 'zod';

// ============================================================================
// Salary Structure Validation
// ============================================================================

export const salaryComponentSchema = z.object({
  name: z.string().min(1, 'Component name is required'),
  code: z.string().optional(), // Component code (e.g., 'BASIC', 'HRA', 'PF')
  type: z.enum(['EARNING', 'DEDUCTION']),
  calculationType: z.enum(['FIXED', 'PERCENTAGE', 'FORMULA']),
  value: z.number().min(0, 'Value must be positive'),
  isTaxable: z.boolean().default(false),
  isStatutory: z.boolean().default(false),
  formula: z.string().optional(), // For FORMULA calculation type
  baseComponent: z.string().optional(), // For PERCENTAGE calculations, which component to base on (e.g., 'BASIC')
  description: z.string().optional(),
}).refine(
  (data) => {
    // If calculationType is PERCENTAGE, value should be <= 100
    if (data.calculationType === 'PERCENTAGE' && data.value > 100) {
      return false;
    }
    return true;
  },
  {
    message: 'Percentage value cannot exceed 100%',
    path: ['value'],
  }
).refine(
  (data) => {
    // If calculationType is FORMULA, formula should be provided
    if (data.calculationType === 'FORMULA' && !data.formula) {
      return false;
    }
    return true;
  },
  {
    message: 'Formula is required for FORMULA calculation type',
    path: ['formula'],
  }
).refine(
  (data) => {
    // If calculationType is PERCENTAGE, baseComponent should be provided
    if (data.calculationType === 'PERCENTAGE' && !data.baseComponent) {
      return false;
    }
    return true;
  },
  {
    message: 'Base component is required for PERCENTAGE calculation type',
    path: ['baseComponent'],
  }
);

export const createSalaryStructureSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  components: z.array(salaryComponentSchema).min(1, 'At least one component is required'),
  isActive: z.boolean().default(true),
});

export const updateSalaryStructureSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  components: z.array(salaryComponentSchema).optional(),
  isActive: z.boolean().optional(),
});

export const querySalaryStructuresSchema = z.object({
  organizationId: z.string().uuid().optional(),
  isActive: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

// ============================================================================
// Employee Bank Account Validation
// ============================================================================

export const createBankAccountSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  bankName: z.string().min(1, 'Bank name is required').max(255),
  accountNumber: z.string().min(1, 'Account number is required').max(50),
  routingNumber: z.string().max(50).optional(),
  accountType: z.enum(['CHECKING', 'SAVINGS']),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateBankAccountSchema = z.object({
  bankName: z.string().min(1).max(255).optional(),
  accountNumber: z.string().min(1).max(50).optional(),
  routingNumber: z.string().max(50).optional(),
  accountType: z.enum(['CHECKING', 'SAVINGS']).optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Employee Salary Validation
// ============================================================================

export const createEmployeeSalarySchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  salaryStructureId: z.string().uuid().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  basicSalary: z.number().min(0, 'Basic salary must be positive'),
  grossSalary: z.number().min(0, 'Gross salary must be positive'),
  netSalary: z.number().min(0, 'Net salary must be positive'),
  components: z.record(z.any()).optional(), // Actual component values
  currency: z.string().length(3).default('USD'),
  paymentFrequency: z.enum(['MONTHLY', 'BI_WEEKLY', 'WEEKLY']),
  bankAccountId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

export const updateEmployeeSalarySchema = z.object({
  salaryStructureId: z.string().uuid().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  basicSalary: z.number().min(0).optional(),
  grossSalary: z.number().min(0).optional(),
  netSalary: z.number().min(0).optional(),
  components: z.record(z.any()).optional(),
  currency: z.string().length(3).optional(),
  paymentFrequency: z.enum(['MONTHLY', 'BI_WEEKLY', 'WEEKLY']).optional(),
  bankAccountId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const queryEmployeeSalariesSchema = z.object({
  employeeId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  isActive: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// ============================================================================
// Payroll Cycle Validation
// ============================================================================

export const createPayrollCycleSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  name: z.string().min(1, 'Name is required').max(255),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  notes: z.string().optional(),
}).refine(
  (data) => {
    const start = new Date(data.periodStart);
    const end = new Date(data.periodEnd);
    return end >= start;
  },
  {
    message: 'Period end date must be after or equal to period start date',
    path: ['periodEnd'],
  }
).refine(
  (data) => {
    const end = new Date(data.periodEnd);
    const payment = new Date(data.paymentDate);
    return payment >= end;
  },
  {
    message: 'Payment date must be after or equal to period end date',
    path: ['paymentDate'],
  }
);

export const updatePayrollCycleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['DRAFT', 'PROCESSING', 'PROCESSED', 'FINALIZED', 'PAID', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});

export const queryPayrollCyclesSchema = z.object({
  organizationId: z.string().uuid().optional(),
  status: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  payrollMonth: z.string().optional(), // 1-12
  payrollYear: z.string().optional(), // e.g., 2026
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const processPayrollCycleSchema = z.object({
  employeeIds: z.array(z.string().uuid()).optional(), // If empty, process all active employees
  recalculate: z.boolean().default(false),
  taxRegime: z.enum(['OLD', 'NEW']).default('NEW'), // India tax regime
});

// ============================================================================
// Payslip Validation
// ============================================================================

export const queryPayslipsSchema = z.object({
  employeeId: z.string().uuid().optional(),
  payrollCycleId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const updatePayslipSchema = z.object({
  status: z.enum(['DRAFT', 'GENERATED', 'SENT', 'PAID', 'HOLD']).optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CHECK', 'CASH']).optional(),
  paymentReference: z.string().max(100).optional(),
  paymentStatus: z.enum(['PENDING', 'COMPLETED', 'FAILED']).optional(),
});

// ============================================================================
// Tax Configuration Validation
// ============================================================================

export const createTaxConfigurationSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  country: z.string().min(1, 'Country is required').max(100),
  region: z.string().max(100).optional(),
  taxType: z.enum(['INCOME_TAX', 'SOCIAL_SECURITY', 'MEDICARE', 'UNEMPLOYMENT', 'OTHER']),
  name: z.string().min(1, 'Name is required').max(255),
  calculationRules: z.record(z.any()), // Slabs, rates, exemptions
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive: z.boolean().default(true),
});

export const updateTaxConfigurationSchema = z.object({
  country: z.string().min(1).max(100).optional(),
  region: z.string().max(100).optional(),
  taxType: z.enum(['INCOME_TAX', 'SOCIAL_SECURITY', 'MEDICARE', 'UNEMPLOYMENT', 'OTHER']).optional(),
  name: z.string().min(1).max(255).optional(),
  calculationRules: z.record(z.any()).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive: z.boolean().optional(),
});

export const queryTaxConfigurationsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  country: z.string().optional(),
  taxType: z.string().optional(),
  isActive: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// ============================================================================
// Statutory Compliance Validation
// ============================================================================

export const createStatutoryComplianceSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  country: z.string().min(1, 'Country is required').max(100),
  complianceType: z.string().min(1, 'Compliance type is required').max(100),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  rules: z.record(z.any()), // Compliance rules
  filingFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']).optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isMandatory: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateStatutoryComplianceSchema = z.object({
  country: z.string().min(1).max(100).optional(),
  complianceType: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  rules: z.record(z.any()).optional(),
  filingFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']).optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isMandatory: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const queryStatutoryCompliancesSchema = z.object({
  organizationId: z.string().uuid().optional(),
  country: z.string().optional(),
  complianceType: z.string().optional(),
  isActive: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// ============================================================================
// Salary Template Validation
// ============================================================================

export const createSalaryTemplateSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  salaryStructureId: z.string().uuid('Invalid salary structure ID'),
  name: z.string().min(1, 'Name is required').max(255),
  grade: z.string().max(50).optional(),
  level: z.string().max(50).optional(),
  description: z.string().optional(),
  ctc: z.number().min(0, 'CTC must be positive'),
  basicSalary: z.number().min(0, 'Basic salary must be positive'),
  grossSalary: z.number().min(0, 'Gross salary must be positive'),
  netSalary: z.number().min(0, 'Net salary must be positive'),
  components: z.record(z.any()), // Actual component values
  currency: z.string().length(3).default('USD'),
  paymentFrequency: z.enum(['MONTHLY', 'BI_WEEKLY', 'WEEKLY']),
  isActive: z.boolean().default(true),
}).refine(
  (data) => data.grossSalary >= data.basicSalary,
  {
    message: 'Gross salary must be greater than or equal to basic salary',
    path: ['grossSalary'],
  }
).refine(
  (data) => data.netSalary <= data.grossSalary,
  {
    message: 'Net salary must be less than or equal to gross salary',
    path: ['netSalary'],
  }
).refine(
  (data) => data.ctc >= data.grossSalary,
  {
    message: 'CTC must be greater than or equal to gross salary',
    path: ['ctc'],
  }
);

export const updateSalaryTemplateSchema = z.object({
  salaryStructureId: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  grade: z.string().max(50).optional(),
  level: z.string().max(50).optional(),
  description: z.string().optional(),
  ctc: z.number().min(0).optional(),
  basicSalary: z.number().min(0).optional(),
  grossSalary: z.number().min(0).optional(),
  netSalary: z.number().min(0).optional(),
  components: z.record(z.any()).optional(),
  currency: z.string().length(3).optional(),
  paymentFrequency: z.enum(['MONTHLY', 'BI_WEEKLY', 'WEEKLY']).optional(),
  isActive: z.boolean().optional(),
});

export const querySalaryTemplatesSchema = z.object({
  organizationId: z.string().uuid().optional(),
  salaryStructureId: z.string().uuid().optional(),
  grade: z.string().optional(),
  level: z.string().optional(),
  isActive: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

// ============================================================================
// Enhanced Employee Salary Validation (with CTC and Revision)
// ============================================================================

export const createEmployeeSalaryEnhancedSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  salaryStructureId: z.string().uuid().optional(),
  salaryTemplateId: z.string().uuid().optional(), // Can use template for quick assignment
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  basicSalary: z.number().min(0, 'Basic salary must be positive'),
  grossSalary: z.number().min(0, 'Gross salary must be positive'),
  netSalary: z.number().min(0, 'Net salary must be positive'),
  ctc: z.number().min(0, 'CTC must be positive').optional(),
  components: z.record(z.any()).optional(),
  ctcBreakdown: z.record(z.any()).optional(), // Detailed CTC breakdown
  revisionReason: z.string().optional(), // Reason for salary revision
  currency: z.string().length(3).default('USD'),
  paymentFrequency: z.enum(['MONTHLY', 'BI_WEEKLY', 'WEEKLY']),
  bankAccountId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
}).refine(
  (data) => !data.salaryStructureId || !data.salaryTemplateId || data.salaryStructureId || data.salaryTemplateId,
  {
    message: 'Either salary structure ID or salary template ID must be provided',
  }
);

export const updateEmployeeSalaryEnhancedSchema = z.object({
  salaryStructureId: z.string().uuid().optional(),
  salaryTemplateId: z.string().uuid().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // For revision history
  basicSalary: z.number().min(0).optional(),
  grossSalary: z.number().min(0).optional(),
  netSalary: z.number().min(0).optional(),
  ctc: z.number().min(0).optional(),
  components: z.record(z.any()).optional(),
  ctcBreakdown: z.record(z.any()).optional(),
  revisionReason: z.string().optional(),
  currency: z.string().length(3).optional(),
  paymentFrequency: z.enum(['MONTHLY', 'BI_WEEKLY', 'WEEKLY']).optional(),
  bankAccountId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>;
export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>;
export type QuerySalaryStructuresInput = z.infer<typeof querySalaryStructuresSchema>;

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;

export type CreateEmployeeSalaryInput = z.infer<typeof createEmployeeSalarySchema>;
export type UpdateEmployeeSalaryInput = z.infer<typeof updateEmployeeSalarySchema>;
export type QueryEmployeeSalariesInput = z.infer<typeof queryEmployeeSalariesSchema>;

export type CreatePayrollCycleInput = z.infer<typeof createPayrollCycleSchema>;
export type UpdatePayrollCycleInput = z.infer<typeof updatePayrollCycleSchema>;
export type QueryPayrollCyclesInput = z.infer<typeof queryPayrollCyclesSchema>;
export type ProcessPayrollCycleInput = z.infer<typeof processPayrollCycleSchema>;

export type QueryPayslipsInput = z.infer<typeof queryPayslipsSchema>;
export type UpdatePayslipInput = z.infer<typeof updatePayslipSchema>;

export type CreateTaxConfigurationInput = z.infer<typeof createTaxConfigurationSchema>;
export type UpdateTaxConfigurationInput = z.infer<typeof updateTaxConfigurationSchema>;
export type QueryTaxConfigurationsInput = z.infer<typeof queryTaxConfigurationsSchema>;

export type CreateStatutoryComplianceInput = z.infer<typeof createStatutoryComplianceSchema>;
export type UpdateStatutoryComplianceInput = z.infer<typeof updateStatutoryComplianceSchema>;
export type QueryStatutoryCompliancesInput = z.infer<typeof queryStatutoryCompliancesSchema>;

export type CreateSalaryTemplateInput = z.infer<typeof createSalaryTemplateSchema>;
export type UpdateSalaryTemplateInput = z.infer<typeof updateSalaryTemplateSchema>;
export type QuerySalaryTemplatesInput = z.infer<typeof querySalaryTemplatesSchema>;

export type CreateEmployeeSalaryEnhancedInput = z.infer<typeof createEmployeeSalaryEnhancedSchema>;
export type UpdateEmployeeSalaryEnhancedInput = z.infer<typeof updateEmployeeSalaryEnhancedSchema>;
