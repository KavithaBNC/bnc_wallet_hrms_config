import api from './api';
import { EmploymentType } from './position.service';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'RESIGNED';

export interface Employee {
  id: string;
  organizationId: string;
  employeeCode: string;
  userId: string;
  // Personal Info
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  personalEmail?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  profilePictureUrl?: string;
  // Employment Info
  departmentId?: string | null;
  positionId?: string | null;
  reportingManagerId?: string | null;
  workLocation?: string;
  employmentType?: EmploymentType;
  employeeStatus: EmployeeStatus;
  // Dates
  dateOfJoining: string;
  probationEndDate?: string;
  confirmationDate?: string;
  dateOfLeaving?: string;
  terminationReason?: string;
  // JSON fields
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  }>;
  bankDetails?: {
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
    accountHolderName?: string;
  };
  taxInformation?: {
    taxId?: string;
    panNumber?: string;
    taxFilingStatus?: string;
  };
  documents?: Array<{
    type: string;
    name: string;
    url: string;
    uploadedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  // Relations
  organization?: {
    id: string;
    name: string;
  };
  department?: {
    id: string;
    name: string;
    code?: string;
  };
  position?: {
    id: string;
    title: string;
    code?: string;
    level?: string;
  };
  reportingManager?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  subordinates?: Array<{
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeStatus: EmployeeStatus;
  }>;
  user?: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    isEmailVerified: boolean;
    lastLoginAt?: string;
  };
}

export interface EmployeeListResponse {
  employees: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EmployeeQuery {
  organizationId?: string;
  departmentId?: string;
  positionId?: string;
  reportingManagerId?: string;
  employmentType?: EmploymentType;
  employeeStatus?: EmployeeStatus;
  gender?: Gender;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'firstName' | 'lastName' | 'employeeCode' | 'dateOfJoining' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  listView?: boolean;
}

const employeeService = {
  /**
   * Get all employees
   */
  async getAll(params?: EmployeeQuery): Promise<EmployeeListResponse> {
    const response = await api.get('/employees', { params });
    return response.data.data;
  },

  /**
   * Get employee by ID
   */
  async getById(id: string): Promise<Employee> {
    const response = await api.get(`/employees/${id}`);
    return response.data.data.employee;
  },

  /**
   * Create employee
   */
  async create(data: any): Promise<{ employee: Employee; temporaryPassword?: string }> {
    const response = await api.post('/employees', data);
    return {
      employee: response.data.data.employee,
      temporaryPassword: response.data.data.temporaryPassword,
    };
  },

  /**
   * Update employee
   */
  async update(id: string, data: Partial<Employee>): Promise<Employee> {
    const response = await api.put(`/employees/${id}`, data);
    return response.data.data.employee;
  },

  /**
   * Delete employee
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/employees/${id}`);
  },

  /**
   * Get employee hierarchy
   */
  async getHierarchy(id: string): Promise<any> {
    const response = await api.get(`/employees/${id}/hierarchy`);
    return response.data.data;
  },

  /**
   * Get employee statistics
   */
  async getStatistics(organizationId: string): Promise<any> {
    const response = await api.get(`/employees/statistics/${organizationId}`);
    return response.data.data.statistics;
  },

  /**
   * Get employee credentials (for ORG_ADMIN only)
   */
  async getCredentials(): Promise<any[]> {
    const response = await api.get('/employees/credentials');
    return response.data.data.credentials;
  },
};

export default employeeService;
