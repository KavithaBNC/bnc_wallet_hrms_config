import api from './api';

export type FnfStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID';

export interface FnfSettlement {
  id: string;
  organizationId: string;
  employeeId: string;
  separationId: string;
  lastWorkingDate: string;
  settlementDate?: string;

  // Final month salary
  finalMonthGross: number;
  finalMonthDeductions: number;
  finalMonthNet: number;

  // Leave encashment
  encashableLeaveDays: number;
  leaveEncashmentAmount: number;

  // Gratuity
  gratuityEligible: boolean;
  yearsOfService: number;
  gratuityAmount: number;

  // Notice period
  noticePeriodDays: number;
  noticePeriodServed: number;
  noticePeriodRecovery: number;

  // Bonus & adjustments
  bonusPayable: number;
  compensationAmount: number;
  otherEarnings: number;
  otherDeductions: number;

  // F&F deductions
  tdsAdjustment: number;
  excessLeaveRecovery: number;
  insuranceRecovery: number;
  travelRecovery: number;
  loanAdvanceRecovery: number;

  // Totals
  totalPayable: number;
  totalRecovery: number;
  netSettlement: number;

  // Breakdown (JSON)
  earningsBreakdown?: Array<{ component: string; amount: number; days?: number }>;
  deductionsBreakdown?: Array<{ component: string; amount: number }>;

  // Workflow
  status: FnfStatus;
  calculatedBy?: string;
  calculatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    dateOfJoining: string;
    department?: { name: string };
    paygroup?: { name: string };
  };
  separation?: {
    id: string;
    separationType: string;
    resignationApplyDate: string;
    relievingDate: string;
    noticePeriod: number;
    noticePeriodReason?: string;
  };
}

export interface FnfCalculationDetails {
  employee: {
    id: string;
    name: string;
    code: string;
    department?: string;
    paygroup?: string;
    joiningDate: string;
    lastWorkingDate: string;
  };
  finalMonthSalary: {
    grossSalary: number;
    deductions: number;
    netSalary: number;
    paidDays: number;
    totalDays: number;
  };
  leaveEncashment: {
    days: number;
    amount: number;
    breakdown: Array<{ leaveType: string; days: number; amount: number }>;
  };
  gratuity: { eligible: boolean; yearsOfService: number; amount: number };
  noticeRecovery: { totalDays: number; servedDays: number; shortfall: number; recovery: number };
  bonusPayable: number;
  tdsAdjustment: number;
  excessLeaveRecovery: number;
  loanAdvanceRecovery: number;
  totals: { totalPayable: number; totalRecovery: number; netSettlement: number };
}

export interface FnfPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

class FnfSettlementService {
  /**
   * Calculate F&F settlement for a given separation
   */
  async calculate(separationId: string, organizationId: string): Promise<{
    settlement: FnfSettlement;
    details: FnfCalculationDetails;
  }> {
    const response = await api.post('/fnf-settlements/calculate', {
      separationId,
      organizationId,
    });
    return response.data.data;
  }

  /**
   * Get all F&F settlements with pagination and filtering
   */
  async getAll(params: {
    organizationId: string;
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{ items: FnfSettlement[]; pagination: FnfPagination }> {
    const response = await api.get('/fnf-settlements', { params });
    return response.data.data;
  }

  /**
   * Get F&F settlement by ID with full details
   */
  async getById(id: string): Promise<FnfSettlement> {
    const response = await api.get(`/fnf-settlements/${id}`);
    return response.data.data;
  }

  /**
   * Approve a settlement
   */
  async approve(id: string): Promise<FnfSettlement> {
    const response = await api.put(`/fnf-settlements/${id}/approve`);
    return response.data.data;
  }

  /**
   * Mark a settlement as paid
   */
  async markAsPaid(id: string): Promise<FnfSettlement> {
    const response = await api.put(`/fnf-settlements/${id}/paid`);
    return response.data.data;
  }

  /**
   * Update manual adjustments (other earnings/deductions, remarks)
   */
  async update(
    id: string,
    data: { otherEarnings?: number; otherDeductions?: number; remarks?: string }
  ): Promise<FnfSettlement> {
    const response = await api.put(`/fnf-settlements/${id}`, data);
    return response.data.data;
  }

  /**
   * Delete a DRAFT or CALCULATED settlement
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/fnf-settlements/${id}`);
  }

  /**
   * Get dashboard stats (counts by status + total paid amount)
   */
  async getStats(): Promise<{ pending: number; hrApproved: number; completed: number; totalPaidAmount: number }> {
    const response = await api.get('/fnf-settlements/stats');
    return response.data.data;
  }

  /**
   * Get separations without a settlement (eligible for initiation)
   */
  async getEligibleSeparations(): Promise<EligibleSeparation[]> {
    const response = await api.get('/fnf-settlements/eligible-separations');
    return response.data.data;
  }
}

export interface EligibleSeparation {
  id: string;
  organizationId: string;
  separationType: string;
  resignationApplyDate: string;
  relievingDate: string;
  noticePeriod: number;
  noticePeriodReason?: string;
  reasonOfLeaving?: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    dateOfJoining: string;
    department?: { name: string };
    position?: { title: string };
  };
}

export default new FnfSettlementService();
