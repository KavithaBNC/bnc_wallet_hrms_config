import api from './api';

export interface TransferComponent {
  component: string;
  currentValue: string;
  newValue: string;
}

export interface CreateTransferPromotionEntryInput {
  organizationId: string;
  employeeId: string;
  paygroupId?: string | null;
  effectiveDate: string;
  remarks?: string | null;
  promotionEnabled: boolean;
  promotionFromId?: string | null;
  promotionToId?: string | null;
  transferComponents?: TransferComponent[] | null;
}

export interface UpdateTransferPromotionEntryInput {
  paygroupId?: string | null;
  effectiveDate?: string;
  remarks?: string | null;
  promotionEnabled?: boolean;
  promotionFromId?: string | null;
  promotionToId?: string | null;
  transferComponents?: TransferComponent[] | null;
}

export interface TransferPromotionEntryRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  paygroupId?: string | null;
  effectiveDate: string;
  remarks?: string | null;
  promotionEnabled: boolean;
  promotionFromId?: string | null;
  promotionToId?: string | null;
  transferComponents?: TransferComponent[] | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email?: string;
  };
  paygroup?: { id: string; name: string; code?: string } | null;
  promotionFrom?: { id: string; title: string; code?: string } | null;
  promotionTo?: { id: string; title: string; code?: string } | null;
  organization?: { id: string; name: string };
}

export interface ListTransferPromotionEntriesParams {
  organizationId: string;
  employeeId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface ListTransferPromotionEntriesResponse {
  transferPromotionEntries: TransferPromotionEntryRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default {
  async create(data: CreateTransferPromotionEntryInput): Promise<TransferPromotionEntryRecord> {
    const { data: res } = await api.post<{
      status: string;
      data: { transferPromotionEntry: TransferPromotionEntryRecord };
    }>('/transaction/transfer-promotion-entry', data);
    return res.data.transferPromotionEntry;
  },

  async getAll(
    params: ListTransferPromotionEntriesParams
  ): Promise<ListTransferPromotionEntriesResponse> {
    const { data } = await api.get<{
      status: string;
      data: ListTransferPromotionEntriesResponse;
    }>('/transaction/transfer-promotion-entry', { params });
    return data.data;
  },

  async getById(id: string): Promise<TransferPromotionEntryRecord> {
    const { data } = await api.get<{
      status: string;
      data: { transferPromotionEntry: TransferPromotionEntryRecord };
    }>(`/transaction/transfer-promotion-entry/${id}`);
    return data.data.transferPromotionEntry;
  },

  async update(
    id: string,
    data: UpdateTransferPromotionEntryInput
  ): Promise<TransferPromotionEntryRecord> {
    const { data: res } = await api.put<{
      status: string;
      data: { transferPromotionEntry: TransferPromotionEntryRecord };
    }>(`/transaction/transfer-promotion-entry/${id}`, data);
    return res.data.transferPromotionEntry;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/transaction/transfer-promotion-entry/${id}`);
  },
};
