import api from './api';

export interface CompoundValue {
  id: string;
  value: string;
  sortOrder: number;
}

export interface Compound {
  id: string;
  organizationId: string;
  componentType: string;
  shortName: string;
  longName: string;
  type: string;
  isDropDown: boolean;
  isCompulsory: boolean;
  isFilterable: boolean;
  reimbDetails: string | null;
   showInPayslip: boolean;
  createdAt: string;
  updatedAt: string;
  values?: CompoundValue[];
}

export interface CompoundListParams {
  organizationId: string;
  page?: number;
  limit?: number;
  search?: string;
  componentType?: string;
  type?: string;
}

export interface CompoundListResponse {
  compounds: Compound[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateCompoundInput {
  organizationId: string;
  componentType: string;
  shortName: string;
  longName: string;
  type: string;
  isDropDown?: boolean;
  isCompulsory?: boolean;
  isFilterable?: boolean;
  reimbDetails?: string;
  showInPayslip?: boolean;
  values?: { value: string; sortOrder?: number }[];
}

export interface UpdateCompoundInput {
  componentType?: string;
  shortName?: string;
  longName?: string;
  type?: string;
  isDropDown?: boolean;
  isCompulsory?: boolean;
  isFilterable?: boolean;
  reimbDetails?: string;
  showInPayslip?: boolean;
  values?: { value: string; sortOrder?: number }[];
}

const compoundService = {
  getAll: (params: CompoundListParams) =>
    api.get<{ data: CompoundListResponse }>('/compounds', { params }).then((r) => r.data.data),

  getById: (id: string) =>
    api.get<{ data: { compound: Compound } }>(`/compounds/${id}`).then((r) => r.data.data.compound),

  create: (data: CreateCompoundInput) =>
    api.post<{ data: { compound: Compound } }>('/compounds', data).then((r) => r.data.data.compound),

  update: (id: string, data: UpdateCompoundInput) =>
    api.put<{ data: { compound: Compound } }>(`/compounds/${id}`, data).then((r) => r.data.data.compound),

  delete: (id: string) =>
    api.delete(`/compounds/${id}`).then((r) => r.data),
};

export default compoundService;
