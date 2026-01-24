/**
 * Backend API Client
 * 
 * This client handles all communication with the Railway backend server.
 * Uses axios for HTTP requests with automatic JWT token injection.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

let apiClient: AxiosInstance;

/**
 * Initialize API client with token
 */
export function initializeAPIClient(token?: string | null) {
  apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Request interceptor - add JWT token
  apiClient.interceptors.request.use(
    (config) => {
      const authToken = token || localStorage.getItem('auth_token');
      if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle 401 errors
  apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Token expired, clear auth
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  return apiClient;
}

/**
 * Get or create API client
 */
function getClient(): AxiosInstance {
  if (!apiClient) {
    initializeAPIClient();
  }
  return apiClient;
}

// ============================================
// Auth Endpoints
// ============================================

export const authAPI = {
  login: (email: string, password: string) =>
    getClient().post('/auth/login', { email, password }),

  register: (email: string, password: string, full_name: string) =>
    getClient().post('/auth/register', { email, password, full_name }),

  refresh: (refreshToken: string) =>
    getClient().post('/auth/refresh', { refresh_token: refreshToken }),

  logout: () =>
    getClient().post('/auth/logout')
};

// ============================================
// Workspace Endpoints
// ============================================

export const workspaceAPI = {
  list: () =>
    getClient().get('/workspaces'),

  get: (id: string) =>
    getClient().get(`/workspaces/${id}`),

  create: (data: { name: string; description?: string }) =>
    getClient().post('/workspaces', data),

  update: (id: string, data: { name?: string; description?: string }) =>
    getClient().put(`/workspaces/${id}`, data),

  delete: (id: string) =>
    getClient().delete(`/workspaces/${id}`),

  getStats: (id: string) =>
    getClient().get(`/workspaces/${id}/stats`)
};

// ============================================
// Dataset Endpoints
// ============================================

export const datasetAPI = {
  list: (workspaceId: string) =>
    getClient().get(`/workspaces/${workspaceId}/datasets`),

  get: (workspaceId: string, datasetId: string) =>
    getClient().get(`/workspaces/${workspaceId}/datasets/${datasetId}`),

  create: (workspaceId: string, data: FormData) =>
    getClient().post(`/workspaces/${workspaceId}/datasets`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  update: (workspaceId: string, datasetId: string, data: any) =>
    getClient().put(`/workspaces/${workspaceId}/datasets/${datasetId}`, data),

  delete: (workspaceId: string, datasetId: string) =>
    getClient().delete(`/workspaces/${workspaceId}/datasets/${datasetId}`),

  preview: (workspaceId: string, datasetId: string, limit: number = 100) =>
    getClient().get(`/workspaces/${workspaceId}/datasets/${datasetId}/preview`, {
      params: { limit }
    })
};

// ============================================
// Validation Endpoints
// ============================================

export const validationAPI = {
  validate: (workspaceId: string, datasetId: string, rules: any) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/validate`, {
      rules
    }),

  getIssues: (workspaceId: string, datasetId: string) =>
    getClient().get(`/workspaces/${workspaceId}/datasets/${datasetId}/issues`),

  createRule: (workspaceId: string, datasetId: string, rule: any) =>
    getClient().post(`/workspaces/${workspaceId}/validation-rules`, {
      dataset_id: datasetId,
      ...rule
    }),

  listRules: (workspaceId: string, datasetId: string) =>
    getClient().get(`/workspaces/${workspaceId}/validation-rules`, {
      params: { dataset_id: datasetId }
    })
};

// ============================================
// Analysis Endpoints
// ============================================

export const analysisAPI = {
  analyze: (workspaceId: string, datasetId: string) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/analyze`),

  getAnalysis: (workspaceId: string, datasetId: string) =>
    getClient().get(`/workspaces/${workspaceId}/datasets/${datasetId}/analysis`),

  generateChart: (workspaceId: string, datasetId: string, config: any) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/charts`, config),

  listCharts: (workspaceId: string, datasetId: string) =>
    getClient().get(`/workspaces/${workspaceId}/datasets/${datasetId}/charts`)
};

// ============================================
// Dashboard Endpoints
// ============================================

export const dashboardAPI = {
  list: (workspaceId: string) =>
    getClient().get(`/workspaces/${workspaceId}/dashboards`),

  create: (workspaceId: string, data: any) =>
    getClient().post(`/workspaces/${workspaceId}/dashboards`, data),

  update: (workspaceId: string, dashboardId: string, data: any) =>
    getClient().put(`/workspaces/${workspaceId}/dashboards/${dashboardId}`, data),

  delete: (workspaceId: string, dashboardId: string) =>
    getClient().delete(`/workspaces/${workspaceId}/dashboards/${dashboardId}`)
};

// ============================================
// Query Endpoints
// ============================================

export const queryAPI = {
  execute: (workspaceId: string, datasetId: string, sql: string) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/query`, { sql }),

  list: (workspaceId: string) =>
    getClient().get(`/workspaces/${workspaceId}/queries`),

  delete: (workspaceId: string, queryId: string) =>
    getClient().delete(`/workspaces/${workspaceId}/queries/${queryId}`)
};

// ============================================
// AI / Groq Endpoints
// ============================================

export const aiAPI = {
  generateInsights: (workspaceId: string, datasetId: string) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/insights`),

  askQuestion: (workspaceId: string, datasetId: string, question: string) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/ask`, { question }),

  suggestQueries: (workspaceId: string, datasetId: string) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/suggest-queries`)
};

// ============================================
// User Endpoints
// ============================================

export const userAPI = {
  getProfile: () =>
    getClient().get('/users/me'),

  updateProfile: (data: any) =>
    getClient().put('/users/me', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    getClient().post('/users/change-password', {
      currentPassword,
      newPassword
    })
};

// ============================================
// Subscription Endpoints
// ============================================

export const subscriptionAPI = {
  getCurrent: () =>
    getClient().get('/subscriptions/current'),

  getPlans: () =>
    getClient().get('/subscriptions/plans'),

  upgrade: (planTier: string, interval: 'month' | 'year') =>
    getClient().post('/subscriptions/upgrade', { plan_tier: planTier, interval }),

  cancel: () =>
    getClient().post('/subscriptions/cancel')
};

// ============================================
// Payment Endpoints
// ============================================

export const paymentAPI = {
  // Create payment order
  createOrder: (planId: string, amount: number, interval: 'month' | 'year', currency: 'USD' | 'INR' = 'USD') =>
    getClient().post('/payments/create-order', { planId, amount, interval, currency }),

  // Get payment status
  getStatus: (orderId: string) =>
    getClient().get(`/payments/status/${orderId}`),

  initiate: (subscriptionId: string, amount: number) =>
    getClient().post('/payments/initiate', { subscription_id: subscriptionId, amount }),

  verify: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    getClient().post('/payments/verify', data),

  listTransactions: () =>
    getClient().get('/payments/transactions')
};

// ============================================
// Analytics Endpoints
// ============================================

export const analyticsAPI = {
  getUserStats: () =>
    getClient().get('/analytics/user-stats'),

  getWorkspaceStats: (workspaceId: string) =>
    getClient().get(`/analytics/workspace-stats/${workspaceId}`),

  trackEvent: (event: string, metadata: any) =>
    getClient().post('/analytics/events', { event, metadata })
};

// ============================================
// Cleaning Endpoints
// ============================================

export const cleaningAPI = {
  getHistory: (workspaceId: string, datasetId: string) =>
    getClient().get(`/workspaces/${workspaceId}/datasets/${datasetId}/cleaning-history`),

  analyzePro: (workspaceId: string, datasetId: string) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/analyze-pro`),

  applyFix: (workspaceId: string, datasetId: string, rule: any) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/apply-suggested-fix`, { rule }),

  saveCleaned: (workspaceId: string, datasetId: string, payload: any) =>
    getClient().put(`/workspaces/${workspaceId}/datasets/${datasetId}/cleaned`, payload),

  confirmClean: (workspaceId: string, datasetId: string, keepQuarantined: boolean = false) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/confirm-clean`, { keepQuarantined }),

  revertClean: (workspaceId: string, datasetId: string) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/revert-clean`),

  getScripts: (workspaceId: string, datasetId: string) =>
    getClient().get(`/workspaces/${workspaceId}/datasets/${datasetId}/scripts`),

  generateScript: (workspaceId: string, datasetId: string, description: string, targetColumn?: string) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/scripts/generate`, { description, targetColumn }),

  chat: (workspaceId: string, datasetId: string, message: string, context?: any) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/chat`, { message, context })
};

// Default export for convenience
export default {
  auth: authAPI,
  workspace: workspaceAPI,
  dataset: datasetAPI,
  validation: validationAPI,
  analysis: analysisAPI,
  dashboard: dashboardAPI,
  query: queryAPI,
  ai: aiAPI,
  user: userAPI,
  subscription: subscriptionAPI,
  payment: paymentAPI,
  analytics: analyticsAPI,
  cleaning: cleaningAPI,
  initializeAPIClient
};
