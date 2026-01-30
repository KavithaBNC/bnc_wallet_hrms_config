import api from './api';

export interface Organization {
  id: string;
  name: string;
  legalName?: string;
  industry?: string;
  sizeRange?: string;
  taxId?: string;
  registrationNumber?: string;
  website?: string;
  logoUrl?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  timezone: string;
  currency: string;
  fiscalYearStart?: string;
  settings?: {
    workingDays?: number[];
    workingHoursStart?: string;
    workingHoursEnd?: string;
    overtimeEnabled?: boolean;
    leaveApprovalRequired?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationStatistics {
  totalEmployees: number;
  activeEmployees: number;
  totalDepartments: number;
  totalPositions: number;
  recentHires: number;
}

export interface CreateOrganizationData {
  name: string;
  legalName?: string;
  industry?: string;
  sizeRange?: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';
  timezone?: string;
  currency?: string;
}

export interface OrganizationsListResponse {
  organizations: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const organizationService = {
  /**
   * Create new organization
   */
  async create(data: CreateOrganizationData): Promise<Organization> {
    const response = await api.post('/organizations', data);
    return response.data.data.organization;
  },

  /**
   * Get all organizations (Super Admin only)
   */
  async getAll(page: number = 1, limit: number = 20, search?: string): Promise<OrganizationsListResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) {
      params.append('search', search);
    }
    const response = await api.get(`/organizations?${params.toString()}`);
    return response.data.data;
  },

  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<Organization> {
    const response = await api.get(`/organizations/${id}`);
    return response.data.data.organization;
  },

  /**
   * Update organization
   */
  async update(id: string, data: Partial<Organization>): Promise<Organization> {
    const response = await api.put(`/organizations/${id}`, data);
    return response.data.data.organization;
  },

  /**
   * Update organization logo
   */
  async updateLogo(id: string, logoUrl: string): Promise<Organization> {
    const response = await api.post(`/organizations/${id}/logo`, { logoUrl });
    return response.data.data.organization;
  },

  /**
   * Get organization statistics
   */
  async getStatistics(id: string): Promise<OrganizationStatistics> {
    const response = await api.get(`/organizations/${id}/statistics`);
    return response.data.data.statistics;
  },

  /**
   * Create organization admin user
   */
  async createAdmin(organizationId: string, data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{
    user: { id: string; email: string; role: string };
    employee: { id: string; employeeCode: string; firstName: string; lastName: string };
    organization: { id: string; name: string };
  }> {
    const response = await api.post(`/organizations/${organizationId}/admins`, data);
    return response.data.data;
  },
};

export default organizationService;
