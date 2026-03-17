import api from './api';

export interface StatutoryRateConfig {
  id: string;
  configType: string;
  country: string;
  region: string | null;
  financialYear: string;
  name: string;
  rules: any;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const complianceService = {
  async getPfEcr(year: number, month: number): Promise<any> {
    const res = await api.get(`/compliance-reports/pf-ecr?year=${year}&month=${month}`);
    return res.data.data;
  },

  async downloadPfEcrCsv(year: number, month: number): Promise<Blob> {
    const res = await api.get(`/compliance-reports/pf-ecr?year=${year}&month=${month}&format=csv`, {
      responseType: 'blob',
    });
    return res.data;
  },

  async getEsicStatement(cycleId: string): Promise<any> {
    const res = await api.get(`/compliance-reports/esic-statement?cycleId=${cycleId}`);
    return res.data.data;
  },

  async downloadEsicCsv(cycleId: string): Promise<Blob> {
    const res = await api.get(`/compliance-reports/esic-statement?cycleId=${cycleId}&format=csv`, {
      responseType: 'blob',
    });
    return res.data;
  },

  async getPtReport(cycleId: string): Promise<any> {
    const res = await api.get(`/compliance-reports/pt-report?cycleId=${cycleId}`);
    return res.data.data;
  },

  async downloadPtCsv(cycleId: string): Promise<Blob> {
    const res = await api.get(`/compliance-reports/pt-report?cycleId=${cycleId}&format=csv`, {
      responseType: 'blob',
    });
    return res.data;
  },

  async getTdsWorkingSheet(financialYear: string): Promise<any> {
    const res = await api.get(`/compliance-reports/tds-working-sheet?financialYear=${financialYear}`);
    return res.data.data;
  },

  async getForm16(financialYear: string, employeeId?: string): Promise<any> {
    const params = new URLSearchParams({ financialYear });
    if (employeeId) params.set('employeeId', employeeId);
    const res = await api.get(`/compliance-reports/form16?${params.toString()}`);
    return res.data.data;
  },

  async getPayrollRegister(cycleId: string): Promise<any> {
    const res = await api.get(`/compliance-reports/payroll-register?cycleId=${cycleId}`);
    return res.data.data;
  },

  async downloadPayrollRegisterCsv(cycleId: string): Promise<Blob> {
    const res = await api.get(`/compliance-reports/payroll-register?cycleId=${cycleId}&format=csv`, { responseType: 'blob' });
    return res.data;
  },

  async downloadTdsCsv(financialYear: string): Promise<Blob> {
    const res = await api.get(`/compliance-reports/tds-working-sheet?financialYear=${financialYear}&format=csv`, { responseType: 'blob' });
    return res.data;
  },

  async downloadForm16Csv(financialYear: string, employeeId?: string): Promise<Blob> {
    const params = new URLSearchParams({ financialYear, format: 'csv' });
    if (employeeId) params.set('employeeId', employeeId);
    const res = await api.get(`/compliance-reports/form16?${params.toString()}`, { responseType: 'blob' });
    return res.data;
  },
};

export const statutoryConfigService = {
  async getAll(configType?: string, financialYear?: string): Promise<StatutoryRateConfig[]> {
    const params = new URLSearchParams();
    if (configType) params.set('configType', configType);
    if (financialYear) params.set('financialYear', financialYear);
    const res = await api.get(`/statutory-config?${params.toString()}`);
    return res.data.data;
  },

  async update(id: string, data: Partial<StatutoryRateConfig>): Promise<StatutoryRateConfig> {
    const res = await api.put(`/statutory-config/${id}`, data);
    return res.data.data;
  },

  async create(payload: Omit<StatutoryRateConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<StatutoryRateConfig> {
    const res = await api.post(`/statutory-config`, payload);
    return res.data.data;
  },
};
