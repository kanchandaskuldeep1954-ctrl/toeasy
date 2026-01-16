import { useState, useCallback } from 'react';

export interface ErrorResponse {
  message: string;
  type: 'AUTH_ERROR' | 'UPGRADE_REQUIRED' | 'RATE_LIMITED' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'SERVER_ERROR' | 'TIMEOUT_ERROR' | 'UNKNOWN_ERROR';
  status?: number;
  action?: string;
  retryAfter?: number;
  supportEmail?: string;
  details?: Record<string, string>;
}

interface ErrorState {
  error: ErrorResponse | null;
  isShowing: boolean;
}

export const useErrorHandler = () => {
  const [state, setState] = useState<ErrorState>({
    error: null,
    isShowing: false
  });

  const handleError = useCallback((error: any): ErrorResponse => {
    let errorResponse: ErrorResponse;

    if (error.type) {
      // Already formatted error
      errorResponse = error;
    } else if (error.response) {
      // Axios error
      errorResponse = {
        message: error.response.data?.message || error.message,
        type: 'UNKNOWN_ERROR',
        status: error.response.status
      };
    } else {
      // Generic error
      errorResponse = {
        message: error.message || 'An error occurred',
        type: 'UNKNOWN_ERROR'
      };
    }

    setState({
      error: errorResponse,
      isShowing: true
    });

    return errorResponse;
  }, []);

  const clearError = useCallback(() => {
    setState({
      error: null,
      isShowing: false
    });
  }, []);

  const showErrorModal = useCallback((error: ErrorResponse) => {
    setState({
      error,
      isShowing: true
    });
  }, []);

  return {
    error: state.error,
    isShowing: state.isShowing,
    handleError,
    clearError,
    showErrorModal
  };
};

export default useErrorHandler;
