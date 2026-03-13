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
        // Strategy 1: Try HRMS backend refresh first (uses HRMS refresh token)
        const hrmsRefreshToken = localStorage.getItem('refreshToken');
        if (hrmsRefreshToken) {
          try {
            const hrmsRes = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
              refreshToken: hrmsRefreshToken,
            });
            const newTokens = hrmsRes.data?.data?.tokens;
            if (newTokens?.accessToken) {
              localStorage.setItem('accessToken', newTokens.accessToken);
              localStorage.setItem('refreshToken', newTokens.refreshToken || hrmsRefreshToken);
              originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
              return api(originalRequest);
            }
          } catch {
            // HRMS refresh failed, try Configurator refresh below
          }
        }

        // Strategy 2: Refresh via Configurator API (uses Configurator refresh token)
        const configuratorRefreshToken = localStorage.getItem('configuratorRefreshToken')
          || localStorage.getItem('refreshToken');
        if (!configuratorRefreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post('/configurator-api/api/v1/auth/token/refresh', {
          refresh_token: configuratorRefreshToken,
        });

        const newConfigAccessToken = response.data.access_token || '';
        const newConfigRefreshToken = response.data.refresh_token || configuratorRefreshToken;

        // Update Configurator tokens
        localStorage.setItem('configuratorAccessToken', newConfigAccessToken);
        localStorage.setItem('configuratorRefreshToken', newConfigRefreshToken);

        // Use Configurator token for HRMS backend as well
        // (the HRMS authenticate middleware has a Configurator token fallback
        //  that decodes and looks up/creates the user)
        localStorage.setItem('accessToken', newConfigAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newConfigAccessToken}`;
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
