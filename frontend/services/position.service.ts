import api from './api';

export type PositionLevel = 'ENTRY' | 'JUNIOR' | 'SENIOR' | 'LEAD' | 'MANAGER' | 'DIRECTOR' | 'VP' | 'C_LEVEL';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';

export interface Position {
  id: string;
  organizationId: string;
  title: string;
  code?: string;
  departmentId?: string | null;
  level?: PositionLevel;
  employmentType?: EmploymentType;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    name: string;
  };
  department?: {
    id: string;
    name: string;
    code?: string;
  };
  _count?: {
    employees: number;
  };
}

export interface PositionListResponse {
  positions: Position[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PositionQuery {
  organizationId?: string;
  departmentId?: string;
  level?: PositionLevel;
  employmentType?: EmploymentType;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'title' | 'code' | 'level' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

const positionService = {
  /**
   * Get all positions
   */
  async getAll(params?: PositionQuery): Promise<PositionListResponse> {
    const response = await api.get('/positions', { params });
    return response.data.data;
  },

  /**
   * Get position by ID
   */
  async getById(id: string): Promise<Position> {
    const response = await api.get(`/positions/${id}`);
    return response.data.data.position;
  },

  /**
   * Create position
   */
  async create(data: {
    organizationId: string;
    title: string;
    code?: string;
    departmentId?: string | null;
    level?: PositionLevel;
    employmentType?: EmploymentType;
    description?: string;
    requirements?: string[];
    responsibilities?: string[];
    salaryRangeMin?: number;
    salaryRangeMax?: number;
    isActive?: boolean;
  }): Promise<Position> {
    const response = await api.post('/positions', data);
    return response.data.data.position;
  },

  /**
   * Update position
   */
  async update(id: string, data: Partial<Position>): Promise<Position> {
    const response = await api.put(`/positions/${id}`, data);
    return response.data.data.position;
  },

  /**
   * Delete position
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/positions/${id}`);
  },

  /**
   * Get positions by department
   */
  async getByDepartment(departmentId: string): Promise<Position[]> {
    const response = await api.get(`/positions/department/${departmentId}`);
    return response.data.data.positions;
  },

  /**
   * Get position statistics
   */
  async getStatistics(organizationId: string): Promise<any> {
    const response = await api.get(`/positions/statistics/${organizationId}`);
    return response.data.data.statistics;
  },
};

export default positionService;
