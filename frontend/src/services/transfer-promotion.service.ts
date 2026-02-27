import api from './api';

export interface IncrementComponent {
  component: string;
  currentValue: number;
  incrementValue: number;
}

export interface CreateTransferPromotionInput {
  organizationId: string;
  employeeId: string;
  paygroupId?: string | null;
  effectiveDate: string;
  appliedFrom: string;
  isIncrement: boolean;
  incrementFrom?: string | null;
  afterLOP: number;
  beforeLOP: number;
  incrementComponents?: IncrementComponent[] | null;
  notes?: string | null;
}

export interface UpdateTransferPromotionInput {
  paygroupId?: string | null;
  effectiveDate?: string;
  appliedFrom?: string;
  isIncrement?: boolean;
  incrementFrom?: string | null;
  afterLOP?: number;
  beforeLOP?: number;
  incrementComponents?: IncrementComponent[] | null;
  notes?: string | null;
}

export interface TransferPromotionRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  paygroupId?: string | null;
  effectiveDate: string;
  appliedFrom: string;
  isIncrement: boolean;
  incrementFrom?: string | null;
  afterLOP: number;
  beforeLOP: number;
  incrementComponents?: IncrementComponent[] | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
  };
  paygroup?: { id: string; name: string } | null;
}

export interface ListTransferPromotionsParams {
  organizationId: string;
  employeeId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface ListTransferPromotionsResponse {
  transferPromotions: TransferPromotionRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default {
  async create(data: CreateTransferPromotionInput): Promise<TransferPromotionRecord> {
    const { data: res } = await api.post<{ status: string; data: { transferPromotion: TransferPromotionRecord } }>(
      '/transaction/transfer-promotions',
      data
    );
    return res.data.transferPromotion;
  },

  async getAll(params: ListTransferPromotionsParams): Promise<ListTransferPromotionsResponse> {
    const { data } = await api.get<{ status: string; data: ListTransferPromotionsResponse }>(
      '/transaction/transfer-promotions',
      { params }
    );
    return data.data;
  },

  async getById(id: string): Promise<TransferPromotionRecord> {
    const { data } = await api.get<{ status: string; data: { transferPromotion: TransferPromotionRecord } }>(
      `/transaction/transfer-promotions/${id}`
    );
    return data.data.transferPromotion;
  },

  async update(id: string, data: UpdateTransferPromotionInput): Promise<TransferPromotionRecord> {
    const { data: res } = await api.put<{ status: string; data: { transferPromotion: TransferPromotionRecord } }>(
      `/transaction/transfer-promotions/${id}`,
      data
    );
    return res.data.transferPromotion;
  },
};
