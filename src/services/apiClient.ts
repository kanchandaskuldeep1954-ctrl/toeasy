import axios, { AxiosError, AxiosResponse } from 'axios';

// Create axios instance
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const data = error.response?.data as any;

    // 401 - Unauthorized (Token expired)
    if (status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject({
        message: 'Session expired. Please log in again.',
        type: 'AUTH_ERROR',
        status: 401
      });
    }

    // 403 - Forbidden (Feature locked, upgrade required)
    if (status === 403) {
      return Promise.reject({
        message: data?.message || 'You need to upgrade your plan to access this feature.',
        type: 'UPGRADE_REQUIRED',
        status: 403,
        action: 'SHOW_UPGRADE_MODAL'
      });
    }

    // 429 - Rate Limited
    if (status === 429) {
      const retryAfter = error.response?.headers['retry-after'];
      const waitSeconds = retryAfter ? parseInt(retryAfter) : 60;
      return Promise.reject({
        message: `Too many requests. Please retry in ${waitSeconds} seconds.`,
        type: 'RATE_LIMITED',
        status: 429,
        retryAfter: waitSeconds
      });
    }

    // 400 - Bad Request
    if (status === 400) {
      return Promise.reject({
        message: data?.message || 'Invalid request. Please check your input.',
        type: 'VALIDATION_ERROR',
        status: 400,
        details: data?.errors
      });
    }

    // 404 - Not Found
    if (status === 404) {
      return Promise.reject({
        message: 'Resource not found.',
        type: 'NOT_FOUND',
        status: 404
      });
    }

    // 500+ - Server Error
    if (status && status >= 500) {
      return Promise.reject({
        message: data?.message || 'Server error. Please try again later or contact support.',
        type: 'SERVER_ERROR',
        status,
        supportEmail: 'support@toeasy.com'
      });
    }

    // Network error
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        message: 'Request timeout. Please check your connection.',
        type: 'TIMEOUT_ERROR'
      });
    }

    // Other errors
    return Promise.reject({
      message: error.message || 'An error occurred. Please try again.',
      type: 'UNKNOWN_ERROR',
      original: error
    });
  }
);

export default apiClient;
