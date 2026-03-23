import { create } from 'zustand';
import { Employee } from '../services/employee.service';
import employeeService from '../services/employee.service';
import configuratorDataService from '../services/configurator-data.service';

interface EmployeeStore {
  /** Employee list from Configurator API (ConfigUser[]) */
  employees: any[];
  currentEmployee: Employee | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  /** Keep for backward compatibility — same as employees */
  allConfigUsers: any[];

  // Actions
  fetchEmployees: (params?: any) => Promise<void>;
  fetchEmployeeById: (id: string) => Promise<void>;
  createEmployee: (data: any) => Promise<{ employee: Employee; temporaryPassword?: string }>;
  updateEmployee: (id: string, data: any) => Promise<Employee>;
  deleteEmployee: (id: string | number) => Promise<void>;
  setCurrentEmployee: (employee: Employee | null) => void;
  clearError: () => void;
}

export const useEmployeeStore = create<EmployeeStore>((set, _get) => ({
  employees: [],
  currentEmployee: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  allConfigUsers: [],

  /**
   * Fetch employees from Configurator API: POST /api/v1/users/list
   * Supports filters: cost_centre_id, department_id, sub_department_id
   * Client-side filtering for: search, is_active
   */
  fetchEmployees: async (params?: any) => {
    set({ loading: true, error: null });
    try {
      // Build Configurator API filter payload
      const filters: { cost_centre_id?: number; department_id?: number; sub_department_id?: number } = {};
      if (params?.costCentreId && params.costCentreId !== 'ALL') {
        const ccId = parseInt(params.costCentreId, 10);
        if (!isNaN(ccId) && ccId > 0) filters.cost_centre_id = ccId;
      }
      if (params?.departmentId && params.departmentId !== 'ALL') {
        const deptId = parseInt(params.departmentId, 10);
        if (!isNaN(deptId) && deptId > 0) filters.department_id = deptId;
      }
      if (params?.subDepartmentId && params.subDepartmentId !== 'ALL') {
        const subId = parseInt(params.subDepartmentId, 10);
        if (!isNaN(subId) && subId > 0) filters.sub_department_id = subId;
      }

      console.log('[employeeStore.fetchEmployees] Calling POST /api/v1/users/list with filters:', filters);
      let list = await configuratorDataService.listConfiguratorUsers(
        Object.keys(filters).length > 0 ? filters : undefined
      );
      console.log('[employeeStore.fetchEmployees] Raw API response:', list.length, 'users');

      // Client-side: filter by is_active (status)
      if (params?.employeeStatus && params.employeeStatus !== 'ALL') {
        if (params.employeeStatus === 'ACTIVE') {
          list = list.filter((u) => u.is_active === true);
        } else if (params.employeeStatus === 'INACTIVE') {
          list = list.filter((u) => u.is_active === false);
        }
      }

      // Client-side: search filter (name, email, phone, code)
      if (params?.search) {
        const q = params.search.toLowerCase().trim();
        list = list.filter((u) =>
          (u.full_name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q) ||
          (u.code || '').toLowerCase().includes(q)
        );
      }

      console.log('[employeeStore.fetchEmployees] After filters:', list.length, 'users');

      const total = list.length;
      const page = params?.page || 1;
      const limit = params?.limit || 20;
      const totalPages = Math.ceil(total / limit);

      // Client-side pagination
      const start = (page - 1) * limit;
      const paginatedList = list.slice(start, start + limit);

      set({
        employees: paginatedList,
        allConfigUsers: paginatedList,
        pagination: { page, limit, total, totalPages },
        loading: false,
      });
    } catch (error: any) {
      console.error('[employeeStore.fetchEmployees] Error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unable to load employee list. Please try again.';
      set({ error: errorMessage, loading: false, employees: [] });
    }
  },

  fetchEmployeeById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const employee = await employeeService.getById(id);
      set({ currentEmployee: employee, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch employee', loading: false });
    }
  },

  createEmployee: async (data: any) => {
    set({ loading: true, error: null });
    try {
      const result = await employeeService.create(data);
      // After create, re-fetch the list from Configurator API
      set({ loading: false });
      return result;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create employee', loading: false });
      throw error;
    }
  },

  updateEmployee: async (id: string, data: any) => {
    set({ loading: true, error: null });
    try {
      const employee = await employeeService.update(id, data);
      set({ currentEmployee: employee, loading: false });
      return employee;
    } catch (error: any) {
      set({ error: error.message || 'Failed to update employee', loading: false });
      throw error;
    }
  },

  deleteEmployee: async (id: string | number) => {
    set({ loading: true, error: null });
    try {
      const userId = typeof id === 'string' ? parseInt(id, 10) : id;

      if (!userId || isNaN(userId)) {
        throw new Error('Invalid user ID');
      }

      // Call HRMS backend DELETE /api/v1/employees/configurator/:userId
      // This handles: Configurator API call + sets configurator_active_status = false on both tables
      await employeeService.deleteByConfiguratorUserId(userId);
      console.log('[employeeStore.deleteEmployee] Delete successful for configurator user_id:', userId);

      set((state) => ({
        employees: state.employees.filter((e: any) => e.user_id !== userId),
        loading: false,
      }));
    } catch (error: any) {
      console.error('[employeeStore.deleteEmployee] Error:', error);
      set({ error: error.message || 'Failed to delete employee', loading: false });
      throw error;
    }
  },

  setCurrentEmployee: (employee: Employee | null) => {
    set({ currentEmployee: employee });
  },

  clearError: () => {
    set({ error: null });
  },
}));
