import api from './api';

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

export const esopService = {
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

  async getById(id: string) {
    const { data } = await api.get<{
      status: string;
      data: { esop: EsopRecord };
    }>(`/esop/${id}`);
    return data.data.esop;
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
