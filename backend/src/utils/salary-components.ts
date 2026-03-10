/**
 * Salary Component Constants and Helpers
 * Phase 4 - Module 1: Salary Structure Management
 */

// ============================================================================
// EARNINGS COMPONENTS
// ============================================================================

export const EARNING_COMPONENTS = {
  BASIC: {
    name: 'Basic Salary',
    code: 'BASIC',
    description: 'Base salary component',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: true,
    isStatutory: false,
    isMandatory: true,
  },
  HRA: {
    name: 'House Rent Allowance',
    code: 'HRA',
    description: 'House rent allowance',
    defaultCalculationType: 'PERCENTAGE' as const,
    isTaxable: true,
    isStatutory: false,
    isMandatory: false,
    defaultPercentage: 40, // Typically 40-50% of Basic
  },
  TRANSPORT: {
    name: 'Transport Allowance',
    code: 'TRANSPORT',
    description: 'Transportation allowance',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: true,
    isStatutory: false,
    isMandatory: false,
  },
  SPECIAL_ALLOWANCE: {
    name: 'Special Allowance',
    code: 'SPECIAL_ALLOWANCE',
    description: 'Special allowance component',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: true,
    isStatutory: false,
    isMandatory: false,
  },
  BONUS: {
    name: 'Bonus',
    code: 'BONUS',
    description: 'Performance bonus or annual bonus',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: true,
    isStatutory: false,
    isMandatory: false,
  },
  MEDICAL_ALLOWANCE: {
    name: 'Medical Allowance',
    code: 'MEDICAL',
    description: 'Medical reimbursement allowance',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: false, // Usually tax-free up to a limit
    isStatutory: false,
    isMandatory: false,
  },
  FOOD_ALLOWANCE: {
    name: 'Food Allowance',
    code: 'FOOD',
    description: 'Food and meal allowance',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: false, // Usually tax-free
    isStatutory: false,
    isMandatory: false,
  },
  OVERTIME: {
    name: 'Overtime',
    code: 'OVERTIME',
    description: 'Overtime earnings',
    defaultCalculationType: 'FORMULA' as const,
    isTaxable: true,
    isStatutory: false,
    isMandatory: false,
    defaultFormula: 'overtimeHours * hourlyRate * 1.5', // 1.5x for overtime
  },
  NFH: {
    name: 'NFH',
    code: 'NFH',
    description: 'Non-Festival Holiday allowance / holiday days',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: true,
    isStatutory: false,
    isMandatory: false,
  },
  WO: {
    name: 'Week Off',
    code: 'WO',
    description: 'Week Off allowance / weekend days',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: true,
    isStatutory: false,
    isMandatory: false,
  },
} as const;

// ============================================================================
// DEDUCTION COMPONENTS
// ============================================================================

export const DEDUCTION_COMPONENTS = {
  PF: {
    name: 'Provident Fund (PF)',
    code: 'PF',
    description: 'Employee Provident Fund contribution',
    defaultCalculationType: 'PERCENTAGE' as const,
    isTaxable: false,
    isStatutory: true,
    isMandatory: true,
    defaultPercentage: 12, // Typically 12% of Basic + DA
  },
  ESI: {
    name: 'Employee State Insurance (ESI)',
    code: 'ESI',
    description: 'ESI contribution',
    defaultCalculationType: 'PERCENTAGE' as const,
    isTaxable: false,
    isStatutory: true,
    isMandatory: false, // Depends on salary threshold
    defaultPercentage: 0.75, // 0.75% of gross salary
  },
  PROFESSIONAL_TAX: {
    name: 'Professional Tax',
    code: 'PROFESSIONAL_TAX',
    description: 'Professional tax deduction',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: false,
    isStatutory: true,
    isMandatory: false, // Depends on state
    defaultValue: 200, // Varies by state and salary
  },
  INCOME_TAX: {
    name: 'Income Tax / TDS',
    code: 'INCOME_TAX',
    description: 'Tax Deducted at Source',
    defaultCalculationType: 'FORMULA' as const,
    isTaxable: false,
    isStatutory: true,
    isMandatory: true,
    defaultFormula: 'calculateIncomeTax(taxableIncome)', // Complex calculation
  },
  LWF: {
    name: 'Labour Welfare Fund',
    code: 'LWF',
    description: 'Labour welfare fund contribution',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: false,
    isStatutory: true,
    isMandatory: false,
    defaultValue: 20,
  },
  LOAN_DEDUCTION: {
    name: 'Loan Deduction',
    code: 'LOAN',
    description: 'Loan EMI or advance deduction',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: false,
    isStatutory: false,
    isMandatory: false,
  },
  OTHER_DEDUCTION: {
    name: 'Other Deduction',
    code: 'OTHER',
    description: 'Other miscellaneous deductions',
    defaultCalculationType: 'FIXED' as const,
    isTaxable: false,
    isStatutory: false,
    isMandatory: false,
  },
  LOP: {
    name: 'Loss of Pay',
    code: 'LOP',
    description: 'Loss of Pay deduction for absent/unpaid leave days',
    defaultCalculationType: 'FORMULA' as const,
    isTaxable: false,
    isStatutory: false,
    isMandatory: false,
    defaultFormula: '(grossSalary/totalWorkingDays)*(absentDays+unpaidLeaveDays)',
  },
} as const;

// ============================================================================
// COMPONENT TYPES
// ============================================================================

export type ComponentType = 'EARNING' | 'DEDUCTION';
export type CalculationType = 'FIXED' | 'PERCENTAGE' | 'FORMULA';

export interface SalaryComponent {
  name: string;
  code?: string;
  type: ComponentType;
  calculationType: CalculationType;
  value: number;
  isTaxable: boolean;
  isStatutory: boolean;
  formula?: string;
  baseComponent?: string; // For PERCENTAGE calculations, which component to base on
  description?: string;
  /** When true, the component value is paid as a flat amount — no attendance proration applied */
  isFlat?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all predefined earning components
 */
export function getPredefinedEarnings(): typeof EARNING_COMPONENTS {
  return EARNING_COMPONENTS;
}

/**
 * Get all predefined deduction components
 */
export function getPredefinedDeductions(): typeof DEDUCTION_COMPONENTS {
  return DEDUCTION_COMPONENTS;
}

/**
 * Get component by code
 */
export function getComponentByCode(code: string): SalaryComponent | null {
  const allComponents = { ...EARNING_COMPONENTS, ...DEDUCTION_COMPONENTS };
  const component = Object.values(allComponents).find((c) => c.code === code);
  
  if (!component) return null;

  return {
    name: component.name,
    code: component.code,
    type: Object.keys(EARNING_COMPONENTS).includes(code) ? 'EARNING' : 'DEDUCTION',
    calculationType: component.defaultCalculationType,
    value: (component as any).defaultValue || (component as any).defaultPercentage || 0,
    isTaxable: component.isTaxable,
    isStatutory: component.isStatutory,
    formula: (component as any).defaultFormula,
    description: component.description,
  };
}

/**
 * Calculate component value based on calculation type
 */
export function calculateComponentValue(
  component: SalaryComponent,
  baseSalary: number,
  allComponents: Record<string, number> = {}
): number {
  switch (component.calculationType) {
    case 'FIXED':
      return component.value;

    case 'PERCENTAGE':
      const baseValue = component.baseComponent
        ? allComponents[component.baseComponent] || baseSalary
        : baseSalary;
      return (baseValue * component.value) / 100;

    case 'FORMULA':
      // For FORMULA type, return the value as-is (formula evaluation should be done separately)
      // This is a placeholder - in production, you'd use a formula parser
      return component.value;

    default:
      return 0;
  }
}

/**
 * Validate component structure
 */
export function validateComponent(component: SalaryComponent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!component.name || component.name.trim().length === 0) {
    errors.push('Component name is required');
  }

  if (component.calculationType === 'PERCENTAGE' && component.value > 100) {
    errors.push('Percentage value cannot exceed 100%');
  }

  if (component.calculationType === 'PERCENTAGE' && component.value < 0) {
    errors.push('Percentage value cannot be negative');
  }

  if (component.calculationType === 'FORMULA' && !component.formula) {
    errors.push('Formula is required for FORMULA calculation type');
  }

  if (component.calculationType === 'PERCENTAGE' && !component.baseComponent) {
    errors.push('Base component is required for PERCENTAGE calculation type');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate gross salary from earnings
 */
export function calculateGrossSalary(earnings: SalaryComponent[], baseSalary: number): number {
  let gross = baseSalary;
  
  for (const earning of earnings) {
    if (earning.type === 'EARNING' && earning.code !== 'BASIC') {
      const value = calculateComponentValue(earning, baseSalary);
      gross += value;
    }
  }

  return gross;
}

/**
 * Calculate total deductions
 */
export function calculateTotalDeductions(
  deductions: SalaryComponent[],
  grossSalary: number,
  taxableIncome: number
): number {
  let total = 0;

  for (const deduction of deductions) {
    if (deduction.type === 'DEDUCTION') {
      const value = calculateComponentValue(deduction, grossSalary, { grossSalary, taxableIncome });
      total += value;
    }
  }

  return total;
}

/**
 * Calculate net salary
 */
export function calculateNetSalary(
  grossSalary: number,
  totalDeductions: number
): number {
  return Math.max(0, grossSalary - totalDeductions);
}

/**
 * Get taxable income (earnings that are taxable)
 */
export function getTaxableIncome(earnings: SalaryComponent[], baseSalary: number): number {
  let taxable = 0;

  for (const earning of earnings) {
    if (earning.type === 'EARNING' && earning.isTaxable) {
      const value = earning.code === 'BASIC'
        ? baseSalary
        : calculateComponentValue(earning, baseSalary);
      taxable += value;
    }
  }

  return taxable;
}
