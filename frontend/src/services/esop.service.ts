import api from './api';

// ─────────────────────────────────────────────
// Configurator ESOP Record (simple CRUD)
// ─────────────────────────────────────────────
export interface EsopRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  financialYear: string;
  noOfEsop: number;
  dateOfAllocation: string | null;
  visted: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    middleName?: string;
    lastName: string;
  };
}

export interface CreateEsopBulkInput {
  organizationId: string;
  financialYear: string;
  records: Array<{
    employeeId: string;
    noOfEsop: number;
    dateOfAllocation?: string | null;
    visted?: string | null;
  }>;
}

export interface QueryEsopParams {
  organizationId: string;
  employeeId?: string;
  financialYear?: string;
  page?: number;
  limit?: number;
  search?: string;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type VestingFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type GrantStatus = 'ACTIVE' | 'CANCELLED' | 'COMPLETED';
export type VestingScheduleStatus = 'PENDING' | 'VESTED' | 'LAPSED';
export type ExerciseRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type EsopLedgerType =
  | 'POOL_CREATED' | 'POOL_UPDATED' | 'PLAN_CREATED'
  | 'GRANT_ISSUED' | 'GRANT_CANCELLED' | 'SHARES_VESTED'
  | 'EXERCISE_REQUESTED' | 'EXERCISE_APPROVED' | 'EXERCISE_REJECTED' | 'EXERCISE_COMPLETED';

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────
export interface EsopPool {
  id: string;
  organizationId: string;
  poolName: string;
  totalShares: number;
  allocatedShares: number;
  availableShares: number;
  sharePrice: string;
  currency: string;
  description: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { grants: number };
}

export interface VestingPlan {
  id: string;
  organizationId: string;
  planName: string;
  description: string | null;
  vestingPeriodMonths: number;
  cliffMonths: number;
  frequency: VestingFrequency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { grants: number };
}

export interface EsopGrant {
  id: string;
  organizationId: string;
  employeeId: string;
  poolId: string;
  vestingPlanId: string;
  grantDate: string;
  totalShares: number;
  vestedShares: number;
  exercisedShares: number;
  grantPrice: string;
  status: GrantStatus;
  remarks: string | null;
  grantedBy: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; employeeCode: string; firstName: string; lastName: string; department?: { name: string } };
  pool?: { id: string; poolName: string; sharePrice: string };
  vestingPlan?: { id: string; planName: string; frequency: VestingFrequency; vestingPeriodMonths: number; cliffMonths: number };
  vestingSchedules?: VestingSchedule[];
  exerciseRequests?: EsopExerciseRequest[];
  _count?: { vestingSchedules: number; exerciseRequests: number };
}

export interface VestingSchedule {
  id: string;
  organizationId: string;
  grantId: string;
  trancheNumber: number;
  vestingDate: string;
  scheduledShares: number;
  vestedShares: number;
  status: VestingScheduleStatus;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  grant?: EsopGrant & { employee?: { id: string; employeeCode: string; firstName: string; lastName: string } };
}

export interface EsopExerciseRequest {
  id: string;
  organizationId: string;
  grantId: string;
  employeeId: string;
  sharesRequested: number;
  exercisePrice: string;
  totalExerciseValue: string;
  requestDate: string;
  status: ExerciseRequestStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  completedAt: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; employeeCode: string; firstName: string; lastName: string };
  grant?: { id: string; grantDate: string; totalShares: number; vestedShares: number; grantPrice: string };
}

export interface EsopLedgerEntry {
  id: string;
  organizationId: string;
  transactionType: EsopLedgerType;
  poolId: string | null;
  grantId: string | null;
  scheduleId: string | null;
  exerciseRequestId: string | null;
  employeeId: string | null;
  sharesCount: number | null;
  sharePrice: string | null;
  transactionValue: string | null;
  description: string | null;
  performedBy: string | null;
  transactionDate: string;
  metadata: Record<string, unknown> | null;
  grant?: EsopGrant & { employee?: { id: string; employeeCode: string; firstName: string; lastName: string } };
}

export interface EsopDashboardStats {
  totalPools: number;
  totalPoolShares: number;
  totalAllocatedShares: number;
  totalAvailableShares: number;
  totalActiveGrants: number;
  totalGrantedShares: number;
  totalVestedShares: number;
  totalExercisedShares: number;
  pendingExerciseRequests: number;
  pendingVestingSchedules: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─── Input types ─────────────────────────────────────────────────────────────
export interface CreatePoolInput {
  organizationId: string;
  poolName: string;
  totalShares: number;
  sharePrice: number;
  currency?: string;
  description?: string;
}

export interface CreateVestingPlanInput {
  organizationId: string;
  planName: string;
  description?: string;
  vestingPeriodMonths: number;
  cliffMonths?: number;
  frequency: VestingFrequency;
}

export interface CreateGrantInput {
  organizationId: string;
  employeeId: string;
  poolId: string;
  vestingPlanId: string;
  grantDate: string;
  totalShares: number;
  grantPrice: number;
  remarks?: string;
}

export interface CreateExerciseRequestInput {
  organizationId: string;
  grantId: string;
  employeeId: string;
  sharesRequested: number;
  exercisePrice: number;
  remarks?: string;
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────
export const esopService = {
  // Dashboard
  getDashboard: async (organizationId: string): Promise<EsopDashboardStats> => {
    const res = await api.get('/esop/dashboard', { params: { organizationId } });
    return res.data.data;
  },

  // Pools
  getAllPools: async (params?: Record<string, unknown>): Promise<PaginatedResponse<EsopPool>> => {
    const res = await api.get('/esop/pools', { params });
    return { items: res.data.items, pagination: res.data.pagination };
  },
  getPoolById: async (id: string): Promise<EsopPool> => {
    const res = await api.get(`/esop/pools/${id}`);
    return res.data.data;
  },
  createPool: async (data: CreatePoolInput): Promise<EsopPool> => {
    const res = await api.post('/esop/pools', data);
    return res.data.data;
  },
  updatePool: async (id: string, data: Partial<CreatePoolInput> & { isActive?: boolean }): Promise<EsopPool> => {
    const res = await api.put(`/esop/pools/${id}`, data);
    return res.data.data;
  },
  deletePool: async (id: string): Promise<void> => {
    await api.delete(`/esop/pools/${id}`);
  },

  // Vesting Plans
  getAllVestingPlans: async (params?: Record<string, unknown>): Promise<PaginatedResponse<VestingPlan>> => {
    const res = await api.get('/esop/vesting-plans', { params });
    return { items: res.data.items, pagination: res.data.pagination };
  },
  getVestingPlanById: async (id: string): Promise<VestingPlan> => {
    const res = await api.get(`/esop/vesting-plans/${id}`);
    return res.data.data;
  },
  createVestingPlan: async (data: CreateVestingPlanInput): Promise<VestingPlan> => {
    const res = await api.post('/esop/vesting-plans', data);
    return res.data.data;
  },
  updateVestingPlan: async (id: string, data: Partial<CreateVestingPlanInput> & { isActive?: boolean }): Promise<VestingPlan> => {
    const res = await api.put(`/esop/vesting-plans/${id}`, data);
    return res.data.data;
  },
  deleteVestingPlan: async (id: string): Promise<void> => {
    await api.delete(`/esop/vesting-plans/${id}`);
  },

  // Grants
  getAllGrants: async (params?: Record<string, unknown>): Promise<PaginatedResponse<EsopGrant>> => {
    const res = await api.get('/esop/grants', { params });
    return { items: res.data.items, pagination: res.data.pagination };
  },
  getGrantById: async (id: string): Promise<EsopGrant> => {
    const res = await api.get(`/esop/grants/${id}`);
    return res.data.data;
  },
  createGrant: async (data: CreateGrantInput): Promise<EsopGrant> => {
    const res = await api.post('/esop/grants', data);
    return res.data.data;
  },
  cancelGrant: async (id: string): Promise<EsopGrant> => {
    const res = await api.put(`/esop/grants/${id}/cancel`);
    return res.data.data;
  },
  getAvailableToExercise: async (grantId: string): Promise<{ totalVested: number; committedShares: number; availableToExercise: number }> => {
    const res = await api.get(`/esop/grants/${grantId}/available-to-exercise`);
    return res.data.data;
  },

  // Vesting Schedules
  getVestingSchedules: async (params?: Record<string, unknown>): Promise<PaginatedResponse<VestingSchedule>> => {
    const res = await api.get('/esop/vesting-schedules', { params });
    return { items: res.data.items, pagination: res.data.pagination };
  },
  processVesting: async (organizationId: string, asOf?: string): Promise<{ processed: number; totalSharesVested: number }> => {
    const res = await api.post('/esop/process-vesting', { organizationId, asOf });
    return res.data.data;
  },

  // Exercise Requests
  getAllExerciseRequests: async (params?: Record<string, unknown>): Promise<PaginatedResponse<EsopExerciseRequest>> => {
    const res = await api.get('/esop/exercise-requests', { params });
    return { items: res.data.items, pagination: res.data.pagination };
  },
  getExerciseRequestById: async (id: string): Promise<EsopExerciseRequest> => {
    const res = await api.get(`/esop/exercise-requests/${id}`);
    return res.data.data;
  },
  createExerciseRequest: async (data: CreateExerciseRequestInput): Promise<EsopExerciseRequest> => {
    const res = await api.post('/esop/exercise-requests', data);
    return res.data.data;
  },
  approveExercise: async (id: string): Promise<EsopExerciseRequest> => {
    const res = await api.put(`/esop/exercise-requests/${id}/approve`);
    return res.data.data;
  },
  rejectExercise: async (id: string, rejectionReason: string): Promise<EsopExerciseRequest> => {
    const res = await api.put(`/esop/exercise-requests/${id}/reject`, { rejectionReason });
    return res.data.data;
  },
  completeExercise: async (id: string): Promise<EsopExerciseRequest> => {
    const res = await api.put(`/esop/exercise-requests/${id}/complete`);
    return res.data.data;
  },

  // Ledger
  getLedger: async (params?: Record<string, unknown>): Promise<PaginatedResponse<EsopLedgerEntry>> => {
    const res = await api.get('/esop/ledger', { params });
    return { items: res.data.items, pagination: res.data.pagination };
  },
};

// ─────────────────────────────────────────────
// Configurator simple ESOP CRUD
// ─────────────────────────────────────────────
export const esopSimpleService = {
  async getAll(params: QueryEsopParams) {
    const { data } = await api.get<{
      status: string;
      data: {
        esopRecords: EsopRecord[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }>('/esop', { params });
    return data.data;
  },

  async getByEmployeeId(employeeId: string) {
    const { data } = await api.get<{
      status: string;
      data: { esopRecords: EsopRecord[] };
    }>(`/esop/employee/${employeeId}`);
    return data.data.esopRecords;
  },

  async createBulk(payload: CreateEsopBulkInput) {
    const { data } = await api.post<{
      status: string;
      message: string;
      data: { created: EsopRecord[]; count: number };
    }>('/esop/bulk', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<Pick<EsopRecord, 'noOfEsop' | 'dateOfAllocation' | 'visted'>>) {
    const { data } = await api.put<{
      status: string;
      data: { esop: EsopRecord };
    }>(`/esop/${id}`, payload);
    return data.data.esop;
  },

  async delete(id: string) {
    await api.delete(`/esop/${id}`);
  },
};

export default esopService;
