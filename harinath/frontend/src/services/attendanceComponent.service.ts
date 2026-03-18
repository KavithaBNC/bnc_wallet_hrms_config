import api from './api';

export interface AttendanceComponent {
  id: string;
  organizationId: string;
  shortName: string;
  eventName: string;
  description: string | null;
  eventCategory: string;
  authorized: boolean;
  considerAsWorkHours: boolean;
  hasBalance: boolean;
  creditFromOverTime: boolean;
  allowBalanceEntry: boolean;
  allowEventOpeningRule: boolean;
  allowAutoCreditRule: boolean;
  allowHourly: boolean;
  allowDatewise: boolean;
  allowWeekOffSelection: boolean;
  allowHolidaySelection: boolean;
  applicableForRegularization: boolean;
  allowDifferentLeavePeriod: boolean;
  allowEventChange: boolean;
  validationRemarksMandatory: boolean;
  leaveDeductionWhileInFandF: boolean;
  cannotOverlapWith: string | null;
  priority: number | null;
  eventEntryForm: string | null;
  autoCreditEngine: string | null;
  encashment: string | null;
  sendMailToOnEntry: boolean;
  sendSMSToOnEntry: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceComponentListParams {
  organizationId: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface AttendanceComponentListResponse {
  components: AttendanceComponent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateAttendanceComponentInput {
  organizationId: string;
  shortName: string;
  eventName: string;
  description?: string;
  eventCategory: string;
  authorized?: boolean;
  considerAsWorkHours?: boolean;
  hasBalance?: boolean;
  creditFromOverTime?: boolean;
  allowBalanceEntry?: boolean;
  allowEventOpeningRule?: boolean;
  allowAutoCreditRule?: boolean;
  allowHourly?: boolean;
  allowDatewise?: boolean;
  allowWeekOffSelection?: boolean;
  allowHolidaySelection?: boolean;
  applicableForRegularization?: boolean;
  allowDifferentLeavePeriod?: boolean;
  allowEventChange?: boolean;
  validationRemarksMandatory?: boolean;
  leaveDeductionWhileInFandF?: boolean;
  cannotOverlapWith?: string[];
  priority?: number;
  eventEntryForm?: string;
  autoCreditEngine?: string;
  encashment?: string;
  sendMailToOnEntry?: boolean;
  sendSMSToOnEntry?: boolean;
}

const attendanceComponentService = {
  getAll: async (params: AttendanceComponentListParams): Promise<AttendanceComponentListResponse> => {
    const { data } = await api.get<{ data: AttendanceComponentListResponse }>('/attendance-components', {
      params: {
        organizationId: params.organizationId,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        search: params.search || undefined,
      },
    });
    return data.data;
  },

  getById: async (id: string): Promise<AttendanceComponent> => {
    const { data } = await api.get<{ data: { component: AttendanceComponent } }>(`/attendance-components/${id}`);
    return data.data.component;
  },

  create: async (body: CreateAttendanceComponentInput): Promise<AttendanceComponent> => {
    const { data } = await api.post<{ data: { component: AttendanceComponent } }>('/attendance-components', body);
    return data.data.component;
  },

  update: async (
    id: string,
    body: Partial<CreateAttendanceComponentInput>
  ): Promise<AttendanceComponent> => {
    const { data } = await api.put<{ data: { component: AttendanceComponent } }>(`/attendance-components/${id}`, body);
    return data.data.component;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/attendance-components/${id}`);
  },
};

export default attendanceComponentService;
