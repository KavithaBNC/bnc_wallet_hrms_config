import api from './api';

export type LoanType = 'SALARY_ADVANCE' | 'PERSONAL_LOAN' | 'TRAVEL_ADVANCE' | 'INSURANCE_ADVANCE' | 'OTHER';
export type LoanStatus = 'PENDING' | 'APPROVED' | 'ACTIVE' | 'CLOSED' | 'REJECTED' | 'WRITTEN_OFF';

export interface EmployeeLoan {
  id: string;
  organizationId: string;
  employeeId: string;
  loanType: LoanType;
  loanAmount: string;
  disbursedAmount: string;
  pendingAmount: string;
  emiAmount: string;
  totalEmis: number;
  paidEmis: number;
  interestRate: string | null;
  startDate: string;
  endDate: string | null;
  disbursedDate: string | null;
  reason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string };
  };
  repayments?: LoanRepayment[];
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  amount: string;
  principalAmount: string;
  interestAmount: string;
  repaymentDate: string;
  status: string;
  createdAt: string;
}

export interface CreateLoanInput {
  organizationId: string;
  employeeId: string;
  loanType: LoanType;
  loanAmount: number;
  emiAmount?: number;
  totalEmis?: number;
  interestRate?: number;
  startDate: string;
  reason?: string;
}

export interface RecordRepaymentInput {
  amount: number;
  repaymentDate: string;
  principalAmount?: number;
  interestAmount?: number;
  payrollCycleId?: string;
}

export interface LoanListResponse {
  items: EmployeeLoan[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoanQuery {
  organizationId?: string;
  employeeId?: string;
  status?: LoanStatus;
  loanType?: LoanType;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

const loanService = {
  async getAll(params?: LoanQuery): Promise<LoanListResponse> {
    const response = await api.get('/loans', { params });
    return response.data;
  },

  async getById(id: string): Promise<EmployeeLoan> {
    const response = await api.get(`/loans/${id}`);
    return response.data.data;
  },

  async create(data: CreateLoanInput): Promise<EmployeeLoan> {
    const response = await api.post('/loans', data);
    return response.data.data;
  },

  async approve(id: string): Promise<EmployeeLoan> {
    const response = await api.patch(`/loans/${id}/approve`);
    return response.data.data;
  },

  async disburse(id: string): Promise<EmployeeLoan> {
    const response = await api.patch(`/loans/${id}/disburse`);
    return response.data.data;
  },

  async reject(id: string): Promise<EmployeeLoan> {
    const response = await api.patch(`/loans/${id}/reject`);
    return response.data.data;
  },

  async recordRepayment(id: string, data: RecordRepaymentInput): Promise<{ repayment: LoanRepayment; loanClosed: boolean; remainingAmount: number }> {
    const response = await api.post(`/loans/${id}/repayments`, data);
    return response.data.data;
  },
};

export default loanService;
