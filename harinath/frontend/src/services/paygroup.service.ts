import api from './api';

export interface Paygroup {
  id: string;
  name: string;
  code?: string | null;
  isActive: boolean;
}

export interface GetPaygroupsParams {
  organizationId: string;
  search?: string;
}

export interface CreatePaygroupData {
  organizationId: string;
  name: string;
  code?: string;
}

export default {
  async getAll(params: GetPaygroupsParams): Promise<Paygroup[]> {
    const { data } = await api.get<{ status: string; data: { paygroups: Paygroup[] } }>(
      '/paygroups',
      { params: { organizationId: params.organizationId, search: params.search || '' } }
    );
    return data.data?.paygroups ?? [];
  },

  async create(data: CreatePaygroupData): Promise<Paygroup> {
    const { data: response } = await api.post<{ status: string; data: { paygroup: Paygroup } }>(
      '/paygroups',
      data
    );
    return response.data.paygroup;
  },
};
