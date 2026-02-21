import api from './api';

export interface PostToPayrollMapping {
  id: string;
  organizationId: string;
  columnKey: string;
  columnName: string;
  format: string;
  elementMapping: string | null;
  orderIndex: number;
  showInList: boolean;
}

export interface PostToPayrollRowInput {
  columnKey: string;
  columnName: string;
  format: string;
  elementMapping?: string | null;
  orderIndex: number;
  showInList?: boolean;
}

const postToPayrollService = {
  getList: async (
    organizationId: string,
    showAll: boolean = true
  ): Promise<PostToPayrollMapping[]> => {
    const response = await api.get<{ data: { list: PostToPayrollMapping[] } }>(
      '/post-to-payroll',
      { params: { organizationId, showAll } }
    );
    return response.data.data?.list ?? [];
  },

  saveAll: async (
    organizationId: string,
    rows: PostToPayrollRowInput[]
  ): Promise<PostToPayrollMapping[]> => {
    const response = await api.post<{ data: { list: PostToPayrollMapping[] } }>(
      '/post-to-payroll/save',
      { organizationId, rows }
    );
    return response.data.data?.list ?? [];
  },
};

export default postToPayrollService;
