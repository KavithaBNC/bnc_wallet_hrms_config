import api from './api';

export interface CostCentre {
  id: string;
  name: string;
  code?: string | null;
}

export default {
  async getByOrganization(organizationId: string): Promise<CostCentre[]> {
    const { data } = await api.get<{ data: { costCentres: CostCentre[] } }>('/cost-centres', {
      params: { organizationId },
    });
    return data.data?.costCentres ?? [];
  },
};
