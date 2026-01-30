import api from './api';

export interface SubDepartment {
  id: string;
  name: string;
}

export const subDepartmentService = {
  async getByOrganization(organizationId: string): Promise<SubDepartment[]> {
    const { data } = await api.get<{ data: { subDepartments: SubDepartment[] } }>('/sub-departments', {
      params: { organizationId },
    });
    return data.data?.subDepartments ?? [];
  },

  async create(organizationId: string, name: string): Promise<SubDepartment> {
    const { data } = await api.post<{ data: { subDepartment: SubDepartment } }>('/sub-departments', {
      organizationId,
      name: name.trim(),
    });
    return data.data!.subDepartment;
  },
};
