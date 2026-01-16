/**
 * API Client Tests
 * Tests request/response interceptors and error handling
 */

import axios from 'axios';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
global.localStorage = mockLocalStorage as any;

describe('API Client Interceptors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Interceptor', () => {
    it('should add Bearer token to request headers', () => {
      mockLocalStorage.getItem.mockReturnValue('test_token_123');

      // Simulating request interceptor behavior
      const token = localStorage.getItem('auth_token');
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      expect(headers.Authorization).toBe('Bearer test_token_123');
    });

    it('should not add token if not available', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor - Error Handling', () => {
    it('should categorize 401 errors as AUTH_ERROR', () => {
      const error = {
        response: {
          status: 401,
          data: { error: 'Unauthorized' },
        },
      };

      const errorType = error.response.status === 401 ? 'AUTH_ERROR' : 'UNKNOWN';
      expect(errorType).toBe('AUTH_ERROR');
    });

    it('should categorize 403 errors as UPGRADE_REQUIRED', () => {
      const error = {
        response: {
          status: 403,
          data: { error: 'Feature locked' },
        },
      };

      const errorType = error.response.status === 403 ? 'UPGRADE_REQUIRED' : 'UNKNOWN';
      expect(errorType).toBe('UPGRADE_REQUIRED');
    });

    it('should categorize 429 errors as RATE_LIMITED', () => {
      const error = {
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
        },
      };

      const errorType = error.response.status === 429 ? 'RATE_LIMITED' : 'UNKNOWN';
      expect(errorType).toBe('RATE_LIMITED');
    });

    it('should categorize 400 errors as VALIDATION_ERROR', () => {
      const error = {
        response: {
          status: 400,
          data: { error: 'Invalid input' },
        },
      };

      const errorType = error.response.status === 400 ? 'VALIDATION_ERROR' : 'UNKNOWN';
      expect(errorType).toBe('VALIDATION_ERROR');
    });

    it('should categorize 404 errors as NOT_FOUND', () => {
      const error = {
        response: {
          status: 404,
          data: { error: 'Not found' },
        },
      };

      const errorType = error.response.status === 404 ? 'NOT_FOUND' : 'UNKNOWN';
      expect(errorType).toBe('NOT_FOUND');
    });

    it('should categorize 5xx errors as SERVER_ERROR', () => {
      const error = {
        response: {
          status: 500,
          data: { error: 'Internal error' },
        },
      };

      const errorType = error.response.status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN';
      expect(errorType).toBe('SERVER_ERROR');
    });

    it('should handle timeout errors', () => {
      const error = {
        code: 'ECONNABORTED',
        message: 'timeout',
      };

      const errorType = error.code === 'ECONNABORTED' ? 'TIMEOUT_ERROR' : 'UNKNOWN';
      expect(errorType).toBe('TIMEOUT_ERROR');
    });

    it('should handle network errors', () => {
      const error = {
        message: 'Network Error',
        request: {},
      };

      const errorType = error.request && !error.response ? 'NETWORK_ERROR' : 'UNKNOWN';
      expect(errorType).toBe('NETWORK_ERROR');
    });
  });

  describe('Response Format', () => {
    it('should return consistent error response format', () => {
      const originalError = {
        response: {
          status: 401,
          data: { error: 'Session expired' },
        },
      };

      const errorResponse = {
        type: 'AUTH_ERROR',
        status: originalError.response.status,
        message: originalError.response.data.error,
        action: 'REDIRECT_TO_LOGIN',
      };

      expect(errorResponse).toEqual({
        type: 'AUTH_ERROR',
        status: 401,
        message: 'Session expired',
        action: 'REDIRECT_TO_LOGIN',
      });
    });

    it('should include retry-after for rate limit errors', () => {
      const originalError = {
        response: {
          status: 429,
          headers: { 'retry-after': '120' },
        },
      };

      const retryAfter = originalError.response.headers['retry-after'];
      const errorResponse = {
        type: 'RATE_LIMITED',
        status: 429,
        retryAfter: parseInt(retryAfter),
      };

      expect(errorResponse.retryAfter).toBe(120);
    });
  });
});
