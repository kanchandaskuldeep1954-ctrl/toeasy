/**
 * Backend API Client
 * 
 * This client handles all communication with the Railway backend server.
 * Uses axios for HTTP requests with automatic JWT token injection.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

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
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Token expired or invalid, clear auth
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
 * Helper to extract user-friendly error message from Axios error
 */
export function getErrorMessage(error: any): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
  }
  return error instanceof Error ? error.message : String(error);
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
  list: (limit: number = 100, offset: number = 0) =>
    getClient().get('/workspaces', { params: { limit, offset } }),

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
  list: (workspaceId: string, limit: number = 50, offset: number = 0) =>
    getClient().get(`/workspaces/${workspaceId}/datasets`, { params: { limit, offset } }),

  get: (workspaceId: string, datasetId: string) =>
    getClient().get(`/workspaces/${workspaceId}/datasets/${datasetId}`),

  create: (workspaceId: string, data: { name: string; data: any[]; headers?: string[]; description?: string }) =>
    getClient().post(`/workspaces/${workspaceId}/datasets`, data),

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
  list: (workspaceId: string, limit: number = 50, offset: number = 0, datasetId?: string) =>
    getClient().get(`/workspaces/${workspaceId}/dashboards`, { params: { limit, offset, datasetId } }),

  create: (workspaceId: string, data: any) =>
    getClient().post(`/workspaces/${workspaceId}/dashboards`, data),

  update: (workspaceId: string, dashboardId: string, data: any) =>
    getClient().put(`/workspaces/${workspaceId}/dashboards/${dashboardId}`, data),

  delete: (workspaceId: string, dashboardId: string) =>
    getClient().delete(`/workspaces/${workspaceId}/dashboards/${dashboardId}`),

  get: (workspaceId: string, dashboardId: string) =>
    getClient().get(`/workspaces/${workspaceId}/dashboards/${dashboardId}`),

  getVersions: (workspaceId: string, dashboardId: string) =>
    getClient().get(`/workspaces/${workspaceId}/dashboards/${dashboardId}/versions`),

  createVersion: (workspaceId: string, dashboardId: string, data: { name: string; description?: string; config: any }) =>
    getClient().post(`/workspaces/${workspaceId}/dashboards/${dashboardId}/versions`, data)
};

// ============================================
// Metrics Library Endpoints
// ============================================

export const metricsAPI = {
  list: (workspaceId: string, params?: { category?: string; certified?: boolean; search?: string }) =>
    getClient().get(`/workspaces/${workspaceId}/metrics`, { params }),

  get: (workspaceId: string, metricId: string) =>
    getClient().get(`/workspaces/${workspaceId}/metrics/${metricId}`),

  create: (workspaceId: string, data: any) =>
    getClient().post(`/workspaces/${workspaceId}/metrics`, data),

  update: (workspaceId: string, metricId: string, data: any) =>
    getClient().put(`/workspaces/${workspaceId}/metrics/${metricId}`, data),

  delete: (workspaceId: string, metricId: string) =>
    getClient().delete(`/workspaces/${workspaceId}/metrics/${metricId}`),

  certify: (workspaceId: string, metricId: string, certified: boolean) =>
    getClient().patch(`/workspaces/${workspaceId}/metrics/${metricId}/certify`, { certified }),

  getCategories: (workspaceId: string) =>
    getClient().get(`/workspaces/${workspaceId}/metrics/categories`),

  trackUsage: (workspaceId: string, metricId: string, usage: { used_in_type: string; used_in_id: string | number }) =>
    getClient().post(`/workspaces/${workspaceId}/metrics/${metricId}/track-usage`, usage)
};


export const reportsAPI = {
  list: (workspaceId: string, datasetId?: string, limit: number = 50, offset: number = 0) =>
    getClient().get(`/workspaces/${workspaceId}/reports`, { params: { datasetId, limit, offset } }),

  get: (workspaceId: string, id: string | number) =>
    getClient().get(`/workspaces/${workspaceId}/reports/${id}`),

  create: (workspaceId: string, data: any) =>
    getClient().post(`/workspaces/${workspaceId}/reports`, data),

  update: (workspaceId: string, id: string | number, data: any) =>
    getClient().put(`/workspaces/${workspaceId}/reports/${id}`, data),

  listVersions: (workspaceId: string, id: string | number) =>
    getClient().get(`/workspaces/${workspaceId}/reports/${id}/versions`),

  saveVersion: (workspaceId: string, id: string | number, data: { change_summary: string }) =>
    getClient().post(`/workspaces/${workspaceId}/reports/${id}/versions`, data),

  restoreVersion: (workspaceId: string, id: string | number, versionId: string | number) =>
    getClient().post(`/workspaces/${workspaceId}/reports/${id}/restore/${versionId}`),

  delete: (workspaceId: string, id: string | number) =>
    getClient().delete(`/workspaces/${workspaceId}/reports/${id}`),

  modify: (dataset: any, report: any, instruction: string) =>
    getClient().post(`/modify-report`, { dataset, report, instruction })
};

// ============================================
// Studio / Decision OS Endpoints
// ============================================

export const studioAPI = {
  listProjects: (workspaceId: string) =>
    getClient().get(`/workspaces/${workspaceId}/projects`),

  createProject: (workspaceId: string, data: { name: string; description?: string; objective?: string }) =>
    getClient().post(`/workspaces/${workspaceId}/projects`, data),

  listRooms: (workspaceId: string, projectId: string) =>
    getClient().get(`/workspaces/${workspaceId}/projects/${projectId}/rooms`),

  createRoom: (workspaceId: string, projectId: string, data: { name: string; description?: string; stage?: string; runContext?: any }) =>
    getClient().post(`/workspaces/${workspaceId}/projects/${projectId}/rooms`, data),

  getRoomState: (workspaceId: string, roomId: string) =>
    getClient().get(`/workspaces/${workspaceId}/rooms/${roomId}/state`),

  run: (workspaceId: string, roomId: string, input: {
    roomId?: string | number;
    mode: 'sql' | 'nl' | 'script_js' | 'sheet_op';
    datasetVersionId?: string | number;
    payload?: any;
    persistPolicy?: 'persist' | 'none';
  }) => getClient().post(`/workspaces/${workspaceId}/rooms/${roomId}/run`, input),

  createArtifact: (workspaceId: string, roomId: string, data: {
    artifactType: 'dataset_version' | 'query_run' | 'chart' | 'pivot' | 'report_block' | 'decision_brief' | 'action_item';
    title: string;
    description?: string;
    payload?: any;
    metadata?: any;
    parentArtifactIds?: (string | number)[];
    datasetVersionId?: string | number;
    sourceDatasetId?: string | number;
  }) => getClient().post(`/workspaces/${workspaceId}/rooms/${roomId}/artifacts`, data),

  getLineage: (workspaceId: string, roomId: string, artifactId: string | number) =>
    getClient().get(`/workspaces/${workspaceId}/rooms/${roomId}/artifacts/${artifactId}/lineage`),

  generateBrief: (workspaceId: string, roomId: string, data?: { title?: string; objective?: string }) =>
    getClient().post(`/workspaces/${workspaceId}/rooms/${roomId}/briefs/generate`, data || {}),

  syncActions: (workspaceId: string, roomId: string, data?: { channel?: string; createTasks?: boolean }) =>
    getClient().post(`/workspaces/${workspaceId}/rooms/${roomId}/actions/sync`, data || {}),

  createAutomation: (workspaceId: string, data: any) =>
    getClient().post(`/workspaces/${workspaceId}/automations`, data),

  executeAutomation: (workspaceId: string, automationId: string | number, data?: any) =>
    getClient().post(`/workspaces/${workspaceId}/automations/${automationId}/execute`, data || {}),

  respondApproval: (workspaceId: string, approvalId: string | number, data: { decision: 'approved' | 'rejected'; note?: string }) =>
    getClient().post(`/workspaces/${workspaceId}/approvals/${approvalId}/respond`, data),

  connectSlack: (workspaceId: string, data: any) =>
    getClient().post(`/workspaces/${workspaceId}/integrations/slack/connect`, data),

  connectSheets: (workspaceId: string, data: any) =>
    getClient().post(`/workspaces/${workspaceId}/integrations/sheets/connect`, data),

  connectSQL: (workspaceId: string, data: any) =>
    getClient().post(`/workspaces/${workspaceId}/integrations/sql/connect`, data),

  getExecutiveDigest: (workspaceId: string) =>
    getClient().get(`/workspaces/${workspaceId}/digests/executive`)
};

// ============================================
// Query Endpoints
// ============================================

export const queryAPI = {
  execute: (workspaceId: string, datasetId: string, sql: string) =>
    getClient().post(`/workspaces/${workspaceId}/datasets/${datasetId}/query`, {
      sql,
      query_text: sql,
      queryText: sql
    }),

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

  verify: (data: { razorpay_order_id?: string; razorpay_subscription_id?: string; razorpay_payment_id: string; razorpay_signature: string }) =>
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

// ============================================
// Sharing Endpoints
// ============================================

export const sharingAPI = {
  create: (data: { resourceType: 'dashboard' | 'report', resourceId: string, title: string, snapshot: any, workspaceId: string }) =>
    getClient().post('/sharing/create', data),

  list: () =>
    getClient().get('/sharing/list'),

  revoke: (token: string) =>
    getClient().delete(`/sharing/${token}`)
};

// ============================================
// Tabs Endpoints
// ============================================

export const tabsAPI = {
  list: (workspaceId: string) =>
    getClient().get('/tabs', { params: { workspaceId } }),

  add: (data: { workspaceId: string, tabType: 'dashboard' | 'report' | 'dataset', resourceId: string, tabName: string }) =>
    getClient().post('/tabs', data),

  delete: (id: string) =>
    getClient().delete(`/tabs/${id}`),

  reorder: (workspaceId: string, tabIds: string[]) =>
    getClient().put('/tabs/reorder', { workspaceId, tabIds })
};

// ============================================
// Activity Endpoints
// ============================================

export const activityAPI = {
  list: (workspaceId: string, datasetId?: string, limit: number = 20) =>
    getClient().get('/activity', { params: { workspaceId, datasetId, limit } }),

  log: (data: { workspaceId: string, datasetId?: string, actionType: string, actionCategory: string, actionDetail: string, actionMetadata?: any, sourceComponent: string }) =>
    getClient().post('/activity', data)
};

// ============================================
// Classification Endpoints (Phase 1: Intelligent Core Loop)
// ============================================

export const classificationAPI = {
  // Classify uploaded data to determine type and suggest workflow
  classify: (headers: string[], sampleData: any[], useAI: boolean = true) =>
    getClient().post('/classify-source', { headers, sampleData, useAI }),

  // Get classification for a dataset
  get: (workspaceId: string, datasetId: string) =>
    getClient().get(`/workspaces/${workspaceId}/datasets/${datasetId}/classification`),

  // Update or override classification
  update: (workspaceId: string, datasetId: string, data: {
    sourceType?: string;
    suggestedWorkflow?: string;
    userOverride?: string;
    detectedEntities?: any[];
    keyInsights?: string[];
    classificationReasoning?: string;
    confidence?: number;
  }) =>
    getClient().put(`/workspaces/${workspaceId}/datasets/${datasetId}/classification`, data),

  // Update journey progress
  updateProgress: (workspaceId: string, datasetId: string, currentStep: string, progress: Record<string, any>) =>
    getClient().put(`/workspaces/${workspaceId}/datasets/${datasetId}/journey-progress`, { currentStep, progress })
};

// ============================================
// Alerts & Notifications Endpoints (Phase 3)
// ============================================

export const alertsAPI = {
  list: (workspaceId: string) =>
    getClient().get('/alerts', { params: { workspaceId } }),

  create: (workspaceId: string, data: any) =>
    getClient().post('/alerts', { workspace_id: workspaceId, ...data }),

  delete: (id: string | number) =>
    getClient().delete(`/alerts/${id}`),

  check: (id: string | number) =>
    getClient().post(`/alerts/${id}/check`)
};

export const notificationsAPI = {
  list: (workspaceId?: string) =>
    getClient().get('/notifications', { params: { workspaceId } }),

  markRead: (id: string | number) =>
    getClient().post(`/notifications/${id}/read`),

  markAllRead: (workspaceId?: string) =>
    getClient().post('/notifications/read-all', { workspaceId })
};

// ============================================
// Invites Endpoints
// ============================================

export const invitesAPI = {
  send: (emails: string[], workspaceId?: string) =>
    getClient().post('/invites/send', { emails, workspaceId }),

  get: (token: string) =>
    getClient().get(`/invites/${token}`)
};

// Default export for convenience
export default {
  auth: authAPI,
  workspace: workspaceAPI,
  dataset: datasetAPI,
  validation: validationAPI,
  analysis: analysisAPI,
  dashboard: dashboardAPI,
  studio: studioAPI,
  query: queryAPI,
  ai: aiAPI,
  user: userAPI,
  subscription: subscriptionAPI,
  payment: paymentAPI,
  analytics: analyticsAPI,
  cleaning: cleaningAPI,
  sharing: sharingAPI,
  tabs: tabsAPI,
  activity: activityAPI,
  classification: classificationAPI,
  alerts: alertsAPI,
  notifications: notificationsAPI,
  invites: invitesAPI,
  initializeAPIClient
};
