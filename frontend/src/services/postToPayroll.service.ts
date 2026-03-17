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

export interface ColumnOption {
  key: string;
  label: string;
  format: string;
}

const postToPayrollService = {
  /** Get column options from MonthlyAttendanceSummary fields */
  getColumnOptions: async (): Promise<ColumnOption[]> => {
    const response = await api.get<{ data: { options: ColumnOption[] } }>(
      '/post-to-payroll/columns'
    );
    return response.data.data?.options ?? [];
  },

  /** Get salary element names from Salary Structure components */
  getSalaryElementNames: async (organizationId: string): Promise<string[]> => {
    const response = await api.get<{ data: { names: string[] } }>(
      '/post-to-payroll/salary-element-names',
      { params: { organizationId } }
    );
    return response.data.data?.names ?? [];
  },

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

  // HR Activities: Preview, Post, Unpost
  getPreview: async (
    organizationId: string,
    year: number,
    month: number,
    associate?: string,
    showAll: boolean = true
  ) => {
    const params: Record<string, string | number | boolean> = {
      organizationId,
      year,
      month,
      showAll,
    };
    if (associate?.trim()) params.associate = associate.trim();
    const response = await api.get<{ data: { rows: Record<string, unknown>[]; mappings: PostToPayrollMapping[] } }>(
      '/post-to-payroll/preview',
      { params }
    );
    return response.data.data ?? { rows: [], mappings: [] };
  },

  getPostStatus: async (organizationId: string, year: number, month: number) => {
    const response = await api.get<{ data: { posted: boolean; status: string | null; cycleId: string | null } }>(
      '/post-to-payroll/post-status',
      { params: { organizationId, year, month } }
    );
    return response.data.data ?? { posted: false, status: null, cycleId: null };
  },

  postMonth: async (organizationId: string, year: number, month: number) => {
    const response = await api.post<{ data: { cycle: { id: string; status: string } } }>(
      '/post-to-payroll/post-month',
      { organizationId, year, month }
    );
    return response.data.data?.cycle;
  },

  unpostMonth: async (organizationId: string, year: number, month: number) => {
    const response = await api.delete<{ data: { deleted: boolean; id: string } }>(
      '/post-to-payroll/unpost-month',
      { params: { organizationId, year, month } }
    );
    return response.data.data;
  },

  /** Core HR Variable Input Entry: save (upsert) edited rows for paygroup + month + year */
  saveVariableInputEntry: async (
    organizationId: string,
    paygroupId: string,
    year: number,
    month: number,
    rows: Array<{
      employeeId: string;
      compensationSalary: number;
      lossOfPay: number;
      vehicleAllowance: number;
      nfh: number;
      weekOff: number;
      otHours: number;
      otherEarnings: number;
      incentive: number;
      normalTax: number;
      salaryAdvance: number;
      otherDeductions: number;
      ptax: number;
    }>
  ): Promise<void> => {
    await api.post('/post-to-payroll/variable-input-entry', {
      organizationId,
      paygroupId,
      year,
      month,
      rows,
    });
  },

  /** Core HR Variable Input Entry: get posted data for paygroup + month + year (same as Post to Payroll list) */
  getVariableInputEntry: async (
    organizationId: string,
    paygroupId: string,
    year: number,
    month: number
  ) => {
    const response = await api.get<{
      data: {
        rows: Array<{
          employeeId: string;
          associateCode: string;
          associateName: string;
          compensationSalary: number;
          lossOfPay: number;
          vehicleAllowance: number;
          nfh: number;
          weekOff: number;
          otHours: number;
          otherEarnings: number;
          incentive: number;
          normalTax: number;
          salaryAdvance: number;
          otherDeductions: number;
          ptax: number;
        }>;
      };
    }>('/post-to-payroll/variable-input-entry', {
      params: { organizationId, paygroupId, year, month },
    });
    return response.data.data?.rows ?? [];
  },
};

export default postToPayrollService;
