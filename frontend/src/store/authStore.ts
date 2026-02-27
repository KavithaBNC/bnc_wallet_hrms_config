import { create } from 'zustand';
import { authService, User, LoginData, RegisterData } from '../services/auth.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
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

  login: async (data: LoginData) => {
    try {
      set({ isLoading: true, error: null });
      const loginResult = await authService.login(data);
      const { user: loginUser } = loginResult;
      // Refresh user data to ensure we have latest employee/organization info
      try {
        const refreshedUser = await authService.getCurrentUser();
        set({ user: refreshedUser, isAuthenticated: true, isLoading: false });
      } catch (meError: any) {
        // Fallback: use user from login response so user can still get in
        set({ user: loginUser, isAuthenticated: true, isLoading: false });
      }
    } catch (error: any) {
      let errorMessage = 'Login failed. Please try again.';
      
      // Handle network errors
      if (!error.response) {
        if (error.message && error.message.includes('timeout')) {
          errorMessage = 'Request timeout. Please check your connection and try again.';
        } else if (error.message && error.message.includes('Network Error')) {
          errorMessage = 'Cannot connect to server. Run "npm run dev" from project root to start both backend and frontend.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      } else if (error.response?.data) {
        // Check for validation errors (Zod/backend)
        if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
          errorMessage = error.response.data.errors
            .map((err: any) => err.message || err.msg)
            .join(', ');
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error?.message) {
          errorMessage = error.response.data.error.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
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
      const user = await authService.getCurrentUser();
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
