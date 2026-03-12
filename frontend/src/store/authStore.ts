import { create } from 'zustand';
import { authService, User, LoginData, RegisterData, CompanyVerifyResponse } from '../services/auth.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  verifyCompany: (companyNameOrCode: string) => Promise<CompanyVerifyResponse>;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string }) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: authService.getStoredUser(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,

  verifyCompany: async (companyNameOrCode: string) => {
    try {
      set({ isLoading: true, error: null });
      const result = await authService.verifyCompany(companyNameOrCode);
      set({ isLoading: false });
      return result;
    } catch (error: any) {
      let errorMessage = 'Company verification failed. Please try again.';
      const data = error.response?.data;

      if (!error.response) {
        if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
          errorMessage = 'Cannot connect to server. Please check your connection.';
        }
      } else if (data) {
        if (typeof data.message === 'string') {
          errorMessage = data.message;
        } else if (data.error?.message) {
          errorMessage = data.error.message;
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        }
      }

      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  login: async (data: LoginData) => {
    try {
      set({ isLoading: true, error: null });
      const loginResult = await authService.login(data);
      const { user: loginUser } = loginResult;
      // User data comes directly from Configurator API response — no need for a separate /me call
      set({ user: loginUser, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      let errorMessage = 'Login failed. Please try again.';
      const data = error.response?.data;

      // Handle network errors (no response = server unreachable)
      if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          errorMessage = 'Request timeout. Please check your connection and try again.';
        } else if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
          errorMessage = 'Cannot connect to server. Please check your connection.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      } else if (data) {
        // Configurator API returned error - extract message
        if (typeof data.message === 'string') {
          errorMessage = data.message;
        } else if (data.error?.message) {
          errorMessage = data.error.message;
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        }
      }

      console.error('Login error:', error);
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  register: async (data: RegisterData) => {
    try {
      set({ isLoading: true, error: null });
      await authService.register(data);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Registration failed. Please try again.';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      await authService.logout();
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  loadUser: async () => {
    try {
      if (!authService.isAuthenticated()) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      set({ isLoading: true, error: null });
      const [user] = await Promise.all([
        authService.getCurrentUser(),
        authService.getModules(),
      ]);
      console.log('Loaded user data:', user);
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error: any) {
      console.error('Error loading user:', error);
      const status = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load user data';
      // Only clear auth on 401 (token invalid/expired). For other errors (network, 500, etc.) keep user so they stay logged in.
      if (status === 401) {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: errorMessage,
        });
      } else {
        // Keep existing user from storage so login is not lost (e.g. SUPER_ADMIN with no employee, or transient API errors)
        const storedUser = authService.getStoredUser();
        set({ user: storedUser, isAuthenticated: !!storedUser, isLoading: false, error: null });
      }
      throw error;
    }
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    try {
      set({ isLoading: true, error: null });
      await authService.changePassword(data);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Failed to change password. Please try again.';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateProfile: async (data: { firstName?: string; lastName?: string; phone?: string }) => {
    try {
      set({ isLoading: true, error: null });
      const user = await authService.updateProfile(data);
      set({ user, isLoading: false });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Failed to update profile. Please try again.';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
