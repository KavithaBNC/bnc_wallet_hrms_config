import api from './api';

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  parentDepartmentId?: string | null;
  managerId?: string | null;
  costCenter?: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    name: string;
  };
  manager?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  parentDepartment?: {
    id: string;
    name: string;
    code?: string;
  };
  subDepartments?: Array<{
    id: string;
    name: string;
    code?: string;
    isActive: boolean;
    _count?: {
      employees: number;
    };
  }>;
  _count?: {
    employees: number;
    subDepartments: number;
    jobPositions: number;
  };
}

export interface DepartmentHierarchy extends Department {
  children: DepartmentHierarchy[];
}

export interface DepartmentListResponse {
  departments: Department[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DepartmentQuery {
  organizationId?: string;
  parentDepartmentId?: string | null;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'code' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  listView?: boolean;
}

const departmentService = {
  /**
   * Get all departments
   */
  async getAll(params?: DepartmentQuery): Promise<DepartmentListResponse> {
    const response = await api.get('/departments', { params });
    return response.data.data;
  },

  /**
   * Get department by ID
   */
  async getById(id: string): Promise<Department> {
    const response = await api.get(`/departments/${id}`);
    return response.data.data.department;
  },

  /**
   * Create department
   */
  async create(data: {
    organizationId: string;
    name: string;
    code?: string;
    description?: string;
    parentDepartmentId?: string | null;
    managerId?: string | null;
    costCenter?: string;
    location?: string;
    isActive?: boolean;
  }): Promise<Department> {
    const response = await api.post('/departments', data);
    return response.data.data.department;
  },

  /**
   * Update department
   */
  async update(id: string, data: Partial<Department>): Promise<Department> {
    const response = await api.put(`/departments/${id}`, data);
    return response.data.data.department;
  },

  /**
   * Delete department
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/departments/${id}`);
  },

  /**
   * Get department hierarchy
   */
  async getHierarchy(organizationId: string): Promise<DepartmentHierarchy[]> {
    const response = await api.get(`/departments/hierarchy/${organizationId}`);
    return response.data.data.hierarchy;
  },
};

export default departmentService;
