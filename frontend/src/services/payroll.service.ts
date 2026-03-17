import api from './api';

export interface SalaryComponent {
  name: string;
  code?: string;
  type: 'EARNING' | 'DEDUCTION';
  calculationType: 'FIXED' | 'PERCENTAGE' | 'FORMULA';
  value: number;
  isTaxable: boolean;
  isStatutory: boolean;
  formula?: string;
  baseComponent?: string; // For PERCENTAGE calculations
  description?: string;
}

export interface PredefinedComponent {
  name: string;
  code: string;
  description: string;
  defaultCalculationType: 'FIXED' | 'PERCENTAGE' | 'FORMULA';
  isTaxable: boolean;
  isStatutory: boolean;
  isMandatory: boolean;
  defaultPercentage?: number;
  defaultValue?: number;
  defaultFormula?: string;
}

export interface SalaryStructure {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  components: SalaryComponent[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryTemplate {
  id: string;
  organizationId: string;
  salaryStructureId: string;
  name: string;
  grade?: string;
  level?: string;
  ctc: number;
  basicSalary: number;
  grossSalary: number;
  netSalary: number;
  components: Record<string, any>;
  currency: string;
  paymentFrequency: 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  salaryStructure?: { id: string; name: string };
}

export interface EmployeeSalary {
  id: string;
  employeeId: string;
  salaryStructureId?: string;
  salaryTemplateId?: string;
  effectiveDate: string;
  endDate?: string;
  basicSalary: number;
  grossSalary: number;
  netSalary: number;
  ctc?: number;
  ctcBreakdown?: Record<string, any>;
  components: Record<string, any>;
  revisionReason?: string;
  currency: string;
  paymentFrequency: 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY';
  bankAccountId?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccount {
  id: string;
  employeeId: string;
  bankName: string;
  accountNumber: string;
  routingNumber?: string;
  accountType: 'CHECKING' | 'SAVINGS';
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollCycle {
  id: string;
  organizationId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  status: 'DRAFT' | 'PROCESSING' | 'PROCESSED' | 'FINALIZED' | 'PAID' | 'CANCELLED';
  totalEmployees?: number;
  totalGross?: number;
  totalDeductions?: number;
  totalNet?: number;
  processedBy?: string;
  processedAt?: string;
  finalizedBy?: string;
  finalizedAt?: string;
  paidBy?: string;
  paidAt?: string;
  isLocked?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payslip {
  id: string;
  payrollCycleId: string;
  employeeId: string;
  employeeSalaryId?: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  basicSalary?: number;
  earnings?: Array<{ component: string; amount: number; isTaxable: boolean }>;
  deductions?: Array<{ component: string; amount: number; type: string }>;
  grossSalary: number;
  totalDeductions?: number;
  netSalary: number;
  attendanceDays?: number;
  paidDays?: number;
  unpaidDays?: number;
  overtimeHours?: number;
  taxDetails?: any;
  statutoryDeductions?: any;
  status: 'DRAFT' | 'GENERATED' | 'SENT' | 'PAID' | 'HOLD';
  pdfUrl?: string;
  paymentMethod?: 'BANK_TRANSFER' | 'CHECK' | 'CASH';
  paymentReference?: string;
  paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    email?: string;
  };
}

// ============================================================================
// Salary Structure Service
// ============================================================================

export const salaryStructureService = {
  async create(data: {
    organizationId: string;
    name: string;
    description?: string;
    components: SalaryComponent[];
    isActive?: boolean;
  }): Promise<SalaryStructure> {
    const response = await api.post('/payroll/salary-structures', data);
    return response.data.data;
  },

  async getAll(params?: {
    organizationId?: string;
    isActive?: string;
    page?: string;
    limit?: string;
    search?: string;
  }): Promise<{ data: SalaryStructure[]; pagination: any }> {
    const response = await api.get('/payroll/salary-structures', { params });
    return response.data;
  },

  async getById(id: string): Promise<SalaryStructure> {
    const response = await api.get(`/payroll/salary-structures/${id}`);
    return response.data.data;
  },

  async update(id: string, data: Partial<SalaryStructure>): Promise<SalaryStructure> {
    const response = await api.put(`/payroll/salary-structures/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/payroll/salary-structures/${id}`);
  },

  async getPredefinedComponents(): Promise<{
    earnings: PredefinedComponent[];
    deductions: PredefinedComponent[];
  }> {
    const response = await api.get('/payroll/salary-components');
    return response.data.data;
  },
};

// ============================================================================
// Salary Template Service
// ============================================================================

export const salaryTemplateService = {
  async create(data: {
    organizationId: string;
    salaryStructureId: string;
    name: string;
    grade?: string;
    level?: string;
    ctc: number;
    basicSalary: number;
    grossSalary: number;
    netSalary: number;
    components?: Record<string, any>;
    currency?: string;
    paymentFrequency?: 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY';
    isActive?: boolean;
  }): Promise<SalaryTemplate> {
    const response = await api.post('/payroll/salary-templates', data);
    return response.data.data;
  },

  async getAll(params?: {
    organizationId?: string;
    isActive?: string;
    page?: string;
    limit?: string;
  }): Promise<{ data: SalaryTemplate[]; pagination: any }> {
    const response = await api.get('/payroll/salary-templates', { params });
    return response.data;
  },

  async getById(id: string): Promise<SalaryTemplate> {
    const response = await api.get(`/payroll/salary-templates/${id}`);
    return response.data.data;
  },

  async getByGradeAndLevel(params: {
    organizationId: string;
    grade?: string;
    level?: string;
  }): Promise<SalaryTemplate[]> {
    const response = await api.get('/payroll/salary-templates/grade-level', { params });
    return response.data.data || [];
  },

  async update(id: string, data: Partial<SalaryTemplate>): Promise<SalaryTemplate> {
    const response = await api.put(`/payroll/salary-templates/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/payroll/salary-templates/${id}`);
  },
};

// ============================================================================
// Employee Salary Service
// ============================================================================

export const employeeSalaryService = {
  async createSalary(data: {
    employeeId: string;
    salaryStructureId?: string;
    effectiveDate: string;
    basicSalary: number;
    grossSalary: number;
    netSalary: number;
    components?: Record<string, any>;
    currency?: string;
    paymentFrequency: 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY';
    bankAccountId?: string;
    isActive?: boolean;
  }): Promise<EmployeeSalary> {
    const response = await api.post('/payroll/employee-salaries', data);
    return response.data.data;
  },

  async createSalaryEnhanced(data: {
    employeeId: string;
    salaryStructureId?: string;
    salaryTemplateId?: string;
    effectiveDate: string;
    basicSalary: number;
    grossSalary: number;
    netSalary: number;
    ctc?: number;
    ctcBreakdown?: Record<string, any>;
    components?: Record<string, any>;
    revisionReason?: string;
    currency?: string;
    paymentFrequency: 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY';
    bankAccountId?: string;
    isActive?: boolean;
  }): Promise<EmployeeSalary> {
    const response = await api.post('/payroll/employee-salaries/enhanced', data);
    return response.data.data;
  },

  async getAllSalaries(params?: {
    employeeId?: string;
    organizationId?: string;
    isActive?: string;
    page?: string;
    limit?: string;
  }): Promise<{ data: EmployeeSalary[]; pagination: any }> {
    const response = await api.get('/payroll/employee-salaries', { params });
    return response.data;
  },

  async getSalaryById(id: string): Promise<EmployeeSalary> {
    const response = await api.get(`/payroll/employee-salaries/${id}`);
    return response.data.data;
  },

  async getCurrentSalary(employeeId: string): Promise<EmployeeSalary> {
    const response = await api.get(`/payroll/employee-salaries/employee/${employeeId}/current`);
    return response.data.data;
  },

  async getSalaryHistory(employeeId: string): Promise<EmployeeSalary[]> {
    const response = await api.get(`/payroll/employee-salaries/employee/${employeeId}/history`);
    return response.data.data || [];
  },

  async updateSalary(id: string, data: Partial<EmployeeSalary>): Promise<EmployeeSalary> {
    const response = await api.put(`/payroll/employee-salaries/${id}`, data);
    return response.data.data;
  },

  // Bank Account methods
  async createBankAccount(data: {
    employeeId: string;
    bankName: string;
    accountNumber: string;
    routingNumber?: string;
    accountType: 'CHECKING' | 'SAVINGS';
    isPrimary?: boolean;
    isActive?: boolean;
  }): Promise<BankAccount> {
    const response = await api.post('/payroll/bank-accounts', data);
    return response.data.data;
  },

  async getBankAccounts(employeeId: string): Promise<BankAccount[]> {
    const response = await api.get(`/payroll/bank-accounts/employee/${employeeId}`);
    return response.data.data;
  },

  async updateBankAccount(id: string, data: Partial<BankAccount>): Promise<BankAccount> {
    const response = await api.put(`/payroll/bank-accounts/${id}`, data);
    return response.data.data;
  },

  async deleteBankAccount(id: string): Promise<void> {
    await api.delete(`/payroll/bank-accounts/${id}`);
  },
};

// ============================================================================
// Payroll Cycle Service
// ============================================================================

export const payrollCycleService = {
  async create(data: {
    organizationId: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    paymentDate: string;
    notes?: string;
  }): Promise<PayrollCycle> {
    const response = await api.post('/payroll/payroll-cycles', data);
    return response.data.data;
  },

  async getAll(params?: {
    organizationId?: string;
    status?: string;
    periodStart?: string;
    periodEnd?: string;
    page?: string;
    limit?: string;
  }): Promise<{ data: PayrollCycle[]; pagination: any }> {
    const response = await api.get('/payroll/payroll-cycles', { params });
    return response.data;
  },

  async getById(id: string): Promise<PayrollCycle> {
    const response = await api.get(`/payroll/payroll-cycles/${id}`);
    return response.data.data;
  },

  async update(id: string, data: Partial<PayrollCycle>): Promise<PayrollCycle> {
    const response = await api.put(`/payroll/payroll-cycles/${id}`, data);
    return response.data.data;
  },

  async processPayrollCycle(id: string, data?: {
    employeeIds?: string[];
    recalculate?: boolean;
  }): Promise<any> {
    const response = await api.post(`/payroll/payroll-cycles/${id}/process`, data || {});
    return response.data;
  },


  async markAsPaid(id: string): Promise<PayrollCycle> {
    const response = await api.post(`/payroll/payroll-cycles/${id}/mark-paid`);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/payroll/payroll-cycles/${id}`);
  },

  async finalizePayrollCycle(id: string): Promise<PayrollCycle> {
    const response = await api.post(`/payroll/payroll-cycles/${id}/finalize`);
    return response.data.data;
  },

  async rollbackPayrollCycle(id: string): Promise<PayrollCycle> {
    const response = await api.post(`/payroll/payroll-cycles/${id}/rollback`);
    return response.data.data;
  },

  async preRunCheck(id: string): Promise<{
    checks: Array<{ label: string; status: 'pass' | 'warn' | 'fail'; detail: string }>;
    employeeCount: number;
  }> {
    const response = await api.get(`/payroll/payroll-cycles/${id}/pre-run-check`);
    return response.data;
  },
};

// ============================================================================
// Payslip Service
// ============================================================================

export const payslipService = {
  async getAll(params?: {
    employeeId?: string;
    payrollCycleId?: string;
    organizationId?: string;
    status?: string;
    periodStart?: string;
    periodEnd?: string;
    page?: string;
    limit?: string;
  }): Promise<{ data: Payslip[]; pagination: any }> {
    const response = await api.get('/payroll/payslips', { params });
    return response.data;
  },

  async getById(id: string): Promise<Payslip> {
    const response = await api.get(`/payroll/payslips/${id}`);
    return response.data.data;
  },

  async getByEmployeeId(employeeId: string, params?: {
    page?: string;
    limit?: string;
  }): Promise<{ data: Payslip[]; pagination: any }> {
    const response = await api.get(`/payroll/payslips/employee/${employeeId}`, { params });
    return response.data;
  },

  async update(id: string, data: Partial<Payslip>): Promise<Payslip> {
    const response = await api.put(`/payroll/payslips/${id}`, data);
    return response.data.data;
  },

  async generatePDF(id: string): Promise<{ pdfUrl: string }> {
    const response = await api.post(`/payroll/payslips/${id}/generate-pdf`);
    return response.data.data;
  },

  async sendPayslip(id: string): Promise<Payslip> {
    const response = await api.post(`/payroll/payslips/${id}/send`);
    return response.data.data;
  },

  async getComprehensive(id: string): Promise<Payslip & {
    earningsBreakdown?: Array<{ component: string; amount: number; isTaxable: boolean; description: string }>;
    deductionsBreakdown?: Array<{ component: string; amount: number; type: string; isStatutory: boolean; description: string }>;
    ytdTotals?: { ytdGrossSalary: number; ytdDeductions: number; ytdNetSalary: number; ytdTaxPaid: number };
    bankDetails?: { bankName: string; accountNumber: string; routingNumber?: string; accountType: string; isPrimary: boolean } | null;
  }> {
    const response = await api.get(`/payroll/payslips/${id}/comprehensive`);
    return response.data.data;
  },

  async downloadPayslipPDF(id: string): Promise<Blob> {
    const response = await api.get(`/payroll/payslips/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async viewPayslipPDF(id: string): Promise<Blob> {
    const response = await api.get(`/payroll/payslips/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
