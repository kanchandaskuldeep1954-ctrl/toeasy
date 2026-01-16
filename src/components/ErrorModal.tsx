import React from 'react';
import { ErrorResponse } from '../hooks/useErrorHandler';

interface ErrorModalProps {
  error: ErrorResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onUpgrade?: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ error, isOpen, onClose, onRetry, onUpgrade }) => {
  if (!isOpen || !error) return null;

  const getIcon = () => {
    switch (error.type) {
      case 'AUTH_ERROR':
        return '🔐';
      case 'UPGRADE_REQUIRED':
        return '⭐';
      case 'RATE_LIMITED':
        return '⏱️';
      case 'VALIDATION_ERROR':
        return '❌';
      case 'SERVER_ERROR':
        return '🔧';
      case 'TIMEOUT_ERROR':
        return '⏳';
      default:
        return '⚠️';
    }
  };

  const getTitle = () => {
    switch (error.type) {
      case 'AUTH_ERROR':
        return 'Session Expired';
      case 'UPGRADE_REQUIRED':
        return 'Upgrade Required';
      case 'RATE_LIMITED':
        return 'Too Many Requests';
      case 'VALIDATION_ERROR':
        return 'Invalid Input';
      case 'NOT_FOUND':
        return 'Not Found';
      case 'SERVER_ERROR':
        return 'Server Error';
      case 'TIMEOUT_ERROR':
        return 'Request Timeout';
      default:
        return 'Error';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-4">
          <h2 className="text-white text-lg font-bold flex items-center gap-3">
            <span className="text-2xl">{getIcon()}</span>
            {getTitle()}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Main Message */}
          <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">
            {error.message}
          </p>

          {/* Error Details */}
          {error.details && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 space-y-2">
              <p className="text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400">Details:</p>
              {Object.entries(error.details).map(([key, value]) => (
                <p key={key} className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-bold">{key}:</span> {value}
                </p>
              ))}
            </div>
          )}

          {/* Retry Information */}
          {error.type === 'RATE_LIMITED' && error.retryAfter && (
            <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                Please wait <strong>{error.retryAfter} seconds</strong> before trying again
              </p>
            </div>
          )}

          {/* Support Information */}
          {error.type === 'SERVER_ERROR' && error.supportEmail && (
            <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                Need help? Contact <a href={`mailto:${error.supportEmail}`} className="font-bold hover:underline">{error.supportEmail}</a>
              </p>
            </div>
          )}

          {/* Status Code */}
          {error.status && (
            <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
              Error Code: {error.status}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium text-sm transition-colors"
          >
            Close
          </button>

          {error.action === 'SHOW_UPGRADE_MODAL' && onUpgrade && (
            <button
              onClick={onUpgrade}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors"
            >
              View Plans
            </button>
          )}

          {error.type === 'TIMEOUT_ERROR' && onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
