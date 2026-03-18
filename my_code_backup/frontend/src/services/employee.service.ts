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
  entityId?: string | null;
  locationId?: string | null;
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
  /** Configurator DB user ID (for delete/sync) */
  configuratorUserId?: number | null;
  /** 128-float face encoding for face attendance punch */
  faceEncoding?: number[] | null;
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
  costCentre?: {
    id: string;
    name: string;
    code?: string | null;
  };
  paygroup?: {
    id: string;
    name: string;
    code?: string | null;
  };
  shift?: {
    id: string;
    name: string;
    code?: string | null;
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
  entity?: {
    id: string;
    name: string;
    code?: string | null;
  };
  location?: {
    id: string;
    name: string;
    code?: string | null;
    entityId?: string;
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
  // Profile extensions JSON (stores role, costCentre, subDepartment names from import)
  profileExtensions?: Record<string, any> | null;
  costCentreId?: string | null;
  // From profileExtensions (getById only) – academic/previous employment/family
  academicQualifications?: Array<Record<string, unknown>>;
  previousEmployments?: Array<Record<string, unknown>>;
  familyMembers?: Array<Record<string, unknown>>;
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
  paygroupId?: string;
  departmentId?: string;
  positionId?: string;
  reportingManagerId?: string;
  employmentType?: EmploymentType;
  /** ACTIVE (default), SEPARATED (resigned/terminated), ALL, or specific status */
  employeeStatus?: EmployeeStatus | 'SEPARATED' | 'ALL';
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
   * Delete employee by HRMS UUID
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/employees/${id}`);
  },

  /**
   * Delete employee by Configurator user_id.
   * Calls DELETE /api/v1/employees/configurator/:userId
   * Backend handles: Configurator API call + sets configurator_active_status = false on both tables.
   */
  async deleteByConfiguratorUserId(configuratorUserId: number): Promise<void> {
    await api.delete(`/employees/configurator/${configuratorUserId}`);
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
   * Get employee credentials (for SUPER_ADMIN, ORG_ADMIN, HR_MANAGER).
   * Super Admin can pass organizationId to view a specific org's credentials.
   */
  async getCredentials(organizationId?: string): Promise<any[]> {
    const params = organizationId ? { organizationId } : {};
    const response = await api.get('/employees/credentials', { params });
    return response.data.data.credentials;
  },

  /**
   * Find an HRMS employee by email (exact match via search).
   * Returns the first matching employee or null if none found.
   */
  async getByEmail(email: string): Promise<Employee | null> {
    try {
      const response = await api.get('/employees', {
        params: { search: email, limit: 1, employeeStatus: 'ALL' },
      });
      const employees: Employee[] = response.data.data.employees || [];
      // Exact match (search is fuzzy, so filter for exact email)
      const match = employees.find(
        (e) => e.email?.toLowerCase() === email.toLowerCase()
      );
      return match || null;
    } catch {
      return null;
    }
  },

  /**
   * Rejoin: create new employee record from a separated (resigned/terminated) employee.
   * New employee gets new code and new login email; previous record is unchanged.
   */
  async rejoin(data: {
    previousEmployeeId: string;
    newJoiningDate: string;
    newLoginEmail: string;
  }): Promise<{ employee: Employee; temporaryPassword?: string }> {
    const response = await api.post('/employees/rejoin', data);
    return {
      employee: response.data.data.employee,
      temporaryPassword: response.data.data.temporaryPassword,
    };
  },
};

export default employeeService;
