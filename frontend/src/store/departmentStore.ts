import { create } from 'zustand';
import departmentService, { Department, DepartmentHierarchy } from '../services/department.service';

interface DepartmentStore {
  departments: Department[];
  currentDepartment: Department | null;
  hierarchy: DepartmentHierarchy[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchDepartments: (organizationId: string, options?: { listView?: boolean; sortBy?: 'name' | 'code' | 'createdAt'; sortOrder?: 'asc' | 'desc' }) => Promise<void>;
  fetchDepartmentById: (id: string) => Promise<void>;
  fetchHierarchy: (organizationId: string) => Promise<void>;
  createDepartment: (data: any) => Promise<Department>;
  updateDepartment: (id: string, data: any) => Promise<Department>;
  deleteDepartment: (id: string) => Promise<void>;
  setCurrentDepartment: (department: Department | null) => void;
  clearError: () => void;
}

export const useDepartmentStore = create<DepartmentStore>((set) => ({
  departments: [],
  currentDepartment: null,
  hierarchy: [],
  loading: false,
  error: null,

  fetchDepartments: async (organizationId: string, options?: { listView?: boolean; sortBy?: 'name' | 'code' | 'createdAt'; sortOrder?: 'asc' | 'desc' }) => {
    set({ loading: true, error: null });
    try {
      const response = await departmentService.getAll({
        organizationId,
        limit: 100,
        listView: options?.listView ?? true,
        sortBy: options?.sortBy,
        sortOrder: options?.sortOrder,
      });
      const departments = response.departments || response.data?.departments || [];
      set({ departments, loading: false });
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch departments';
      set({ error: errorMessage, loading: false, departments: [] });
    }
  },

  fetchDepartmentById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const department = await departmentService.getById(id);
      set({ currentDepartment: department, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch department', loading: false });
    }
  },

  fetchHierarchy: async (organizationId: string) => {
    set({ loading: true, error: null });
    try {
      const hierarchy = await departmentService.getHierarchy(organizationId);
      set({ hierarchy, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch hierarchy', loading: false });
    }
  },

  createDepartment: async (data: any) => {
    set({ loading: true, error: null });
    try {
      const department = await departmentService.create(data);
      set((state) => ({
        departments: [...state.departments, department],
        loading: false,
      }));
      return department;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create department', loading: false });
      throw error;
    }
  },

  updateDepartment: async (id: string, data: any) => {
    set({ loading: true, error: null });
    try {
      const department = await departmentService.update(id, data);
      set((state) => ({
        departments: state.departments.map((d) => (d.id === id ? department : d)),
        currentDepartment: state.currentDepartment?.id === id ? department : state.currentDepartment,
        loading: false,
      }));
      return department;
    } catch (error: any) {
      set({ error: error.message || 'Failed to update department', loading: false });
      throw error;
    }
  },

  deleteDepartment: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await departmentService.delete(id);
      set((state) => ({
        departments: state.departments.filter((d) => d.id !== id),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete department', loading: false });
      throw error;
    }
  },

  setCurrentDepartment: (department: Department | null) => {
    set({ currentDepartment: department });
  },

  clearError: () => {
    set({ error: null });
  },
}));
