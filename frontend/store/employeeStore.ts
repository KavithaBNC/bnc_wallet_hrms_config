import { create } from 'zustand';
import employeeService, { Employee } from '../services/employee.service';

interface EmployeeStore {
  employees: Employee[];
  currentEmployee: Employee | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Actions
  fetchEmployees: (params?: any) => Promise<void>;
  fetchEmployeeById: (id: string) => Promise<void>;
  createEmployee: (data: any) => Promise<Employee>;
  updateEmployee: (id: string, data: any) => Promise<Employee>;
  deleteEmployee: (id: string) => Promise<void>;
  setCurrentEmployee: (employee: Employee | null) => void;
  clearError: () => void;
}

export const useEmployeeStore = create<EmployeeStore>((set) => ({
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

  fetchEmployees: async (params?: any) => {
    set({ loading: true, error: null });
    try {
      const response = await employeeService.getAll(params);
      const employees = response.employees || response.data?.employees || [];
      const pagination = response.pagination || response.data?.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      };
      set({
        employees,
        pagination,
        loading: false,
      });
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch employees';
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
      set((state) => ({
        employees: [...state.employees, result.employee],
        loading: false,
      }));
      return result; // Return both employee and temporaryPassword
    } catch (error: any) {
      set({ error: error.message || 'Failed to create employee', loading: false });
      throw error;
    }
  },

  updateEmployee: async (id: string, data: any) => {
    set({ loading: true, error: null });
    try {
      const employee = await employeeService.update(id, data);
      set((state) => ({
        employees: state.employees.map((e) => (e.id === id ? employee : e)),
        currentEmployee: state.currentEmployee?.id === id ? employee : state.currentEmployee,
        loading: false,
      }));
      return employee;
    } catch (error: any) {
      set({ error: error.message || 'Failed to update employee', loading: false });
      throw error;
    }
  },

  deleteEmployee: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await employeeService.delete(id);
      set((state) => ({
        employees: state.employees.filter((e) => e.id !== id),
        loading: false,
      }));
    } catch (error: any) {
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
