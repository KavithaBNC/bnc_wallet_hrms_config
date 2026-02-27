import api from './api';

export interface EmployeeChangeRequestListItem {
  id: string;
  employeeId: string;
  submittedById: string;
  organizationId: string;
  status: string;
  existingData: Record<string, unknown>;
  requestedData: Record<string, unknown>;
  submittedAt: string;
  employee: { id: string; employeeCode: string; firstName: string; lastName: string };
  submittedBy?: { id: string; email: string };
}

export interface EmployeeChangeRequestDetail extends EmployeeChangeRequestListItem {
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
}

export const employeeChangeRequestService = {
  async submit(payload: {
    employeeId: string;
    organizationId: string;
    existingData: Record<string, unknown>;
    requestedData: Record<string, unknown>;
  }) {
    const { data } = await api.post('/employee-change-requests/submit', payload);
    return data.data.request as EmployeeChangeRequestDetail;
  },

  async listPending(): Promise<EmployeeChangeRequestListItem[]> {
    const { data } = await api.get('/employee-change-requests');
    return data.data.list ?? [];
  },

  async getById(id: string): Promise<EmployeeChangeRequestDetail> {
    const { data } = await api.get(`/employee-change-requests/${id}`);
    return data.data.request;
  },

  async approve(id: string) {
    const { data } = await api.post(`/employee-change-requests/${id}/approve`);
    return data.data.request as EmployeeChangeRequestDetail;
  },

  async reject(id: string, rejectionReason?: string) {
    const { data } = await api.post(`/employee-change-requests/${id}/reject`, {
      rejectionReason: rejectionReason || undefined,
    });
    return data.data.request as EmployeeChangeRequestDetail;
  },
};
