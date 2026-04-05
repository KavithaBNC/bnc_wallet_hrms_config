import axios, { AxiosInstance, AxiosError } from 'axios';

import { API_BASE_URL } from '@/config/env';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Increased timeout to 30 seconds
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: any = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const hrmsRefreshToken = localStorage.getItem('refreshToken');
        if (!hrmsRefreshToken) throw new Error('No refresh token');
        const hrmsRes = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken: hrmsRefreshToken,
        });
        const newTokens = hrmsRes.data?.data?.tokens;
        if (!newTokens?.accessToken) throw new Error('Refresh response missing token');
        localStorage.setItem('accessToken', newTokens.accessToken);
        localStorage.setItem('refreshToken', newTokens.refreshToken || hrmsRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('configuratorRefreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle network errors
    if (!error.response) {
      // Network error (server not reachable, timeout, etc.)
      console.error('Network Error:', error.message);
      if (error.code === 'ECONNABORTED') {
        error.message = 'Request timeout. Please check your connection and try again.';
      } else if (error.message === 'Network Error' || error.code === 'ECONNREFUSED') {
        error.message = 'Backend is not running. Start it with: cd backend && npm run dev';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
