import api from './api';

export interface CreateOrganizationData {
  name: string;
  legalName?: string;
  industry?: string;
  sizeRange?: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';
  timezone?: string;
  currency?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  createOrganization?: CreateOrganizationData;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  employee?: {
    id: string;
    organizationId: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
    department?: {
      name: string;
    };
    position?: {
      title: string;
    };
    organization?: {
      id: string;
      name: string;
    };
  };
}

export interface AuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterData) {
    const response = await api.post('/auth/register', data);
    return response.data;
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post('/auth/login', data);
    const { user, tokens } = response.data.data;

    // Save tokens to localStorage
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    return { user, tokens };
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API response
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get('/auth/me');
      const user = response.data.data.user;

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(user));

      console.log('getCurrentUser response:', user);
      return user;
    } catch (error: any) {
      console.error('getCurrentUser error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(data: ForgotPasswordData) {
    const response = await api.post('/auth/forgot-password', data);
    return response.data;
  }

  /**
   * Reset password
   */
  async resetPassword(data: ResetPasswordData) {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string) {
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    const response = await api.post('/auth/refresh-token', { refreshToken });
    const { tokens } = response.data.data;

    // Save new tokens
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    return tokens;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  }

  /**
   * Get stored user from localStorage
   */
  getStoredUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch (error) {
      return null;
    }
  }

  /**
   * Change password
   */
  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const response = await api.post('/auth/change-password', data);
    return response.data;
  }

  /**
   * Update profile
   */
  async updateProfile(data: { firstName?: string; lastName?: string; phone?: string }): Promise<User> {
    const response = await api.put('/auth/profile', data);
    const user = response.data.data.user;

    // Update localStorage
    localStorage.setItem('user', JSON.stringify(user));

    return user;
  }
}

export const authService = new AuthService();
