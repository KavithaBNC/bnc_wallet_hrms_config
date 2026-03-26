import api from './api';

export type SeparationType =
  | 'RESIGNATION'
  | 'TERMINATION'
  | 'RETIREMENT'
  | 'CONTRACT_END'
  | 'ABSONDING'
  | 'OTHER';

export interface EmployeeSeparation {
  id: string;
  employeeId: string;
  organizationId: string;
  resignationApplyDate: string;
  noticePeriod: number;
  noticePeriodReason?: string | null;
  relievingDate: string;
  reasonOfLeaving?: string | null;
  separationType: SeparationType;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface ConfiguratorUser {
  user_id: number;
  full_name: string;
  email?: string;
  code?: string;
  is_active?: boolean;
  [key: string]: any;
}

export interface CreateEmployeeSeparationInput {
  employeeId?: string;
  configuratorUserId?: number;
  organizationId: string;
  resignationApplyDate: string;
  noticePeriod: number;
  noticePeriodReason?: string | null;
  relievingDate: string;
  reasonOfLeaving?: string | null;
  separationType: SeparationType;
  remarks?: string | null;
}

export interface UpdateEmployeeSeparationInput {
  resignationApplyDate?: string;
  noticePeriod?: number;
  noticePeriodReason?: string | null;
  relievingDate?: string;
  reasonOfLeaving?: string | null;
  separationType?: SeparationType;
  remarks?: string | null;
}

export interface EmployeeSeparationListResponse {
  separations: EmployeeSeparation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EmployeeSeparationQuery {
  organizationId?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
  sortBy?: 'resignationApplyDate' | 'relievingDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

const employeeSeparationService = {
  async getAll(params?: EmployeeSeparationQuery): Promise<EmployeeSeparationListResponse> {
    const response = await api.get('/employee-separations', { params });
    return response.data.data;
  },

  async getById(id: string): Promise<EmployeeSeparation> {
    const response = await api.get(`/employee-separations/${id}`);
    return response.data.data.separation;
  },

  async create(data: CreateEmployeeSeparationInput): Promise<EmployeeSeparation> {
    const response = await api.post('/employee-separations', data);
    return response.data.data.separation;
  },

  async update(id: string, data: UpdateEmployeeSeparationInput): Promise<EmployeeSeparation> {
    const response = await api.put(`/employee-separations/${id}`, data);
    return response.data.data.separation;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/employee-separations/${id}`);
  },

  async getConfiguratorUsers(): Promise<ConfiguratorUser[]> {
    const response = await api.get('/configurator-data/users');
    return response.data.data ?? [];
  },
};

export default employeeSeparationService;
