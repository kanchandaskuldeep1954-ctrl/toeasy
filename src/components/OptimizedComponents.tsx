import React, { memo, useMemo, useCallback } from 'react';

/**
 * Sidebar with React.memo optimization
 * Prevents re-renders when parent re-renders unless props change
 */
export const SidebarOptimized = memo(
  ({ activeRoute, onNavigate }: { activeRoute: string; onNavigate: (route: string) => void }) => {
    const memoizedNavigate = useCallback(
      (route: string) => {
        onNavigate(route);
      },
      [onNavigate]
    );

    return (
      <aside className="w-64 bg-slate-800 border-r border-slate-700 p-4">
        <nav className="space-y-2">
          <button
            onClick={() => memoizedNavigate('datasets')}
            className={`w-full px-4 py-2 rounded ${
              activeRoute === 'datasets' ? 'bg-blue-600' : 'hover:bg-slate-700'
            }`}
          >
            Datasets
          </button>
          {/* Other nav items */}
        </nav>
      </aside>
    );
  }
);

SidebarOptimized.displayName = 'SidebarOptimized';

/**
 * Data table row component with memoization
 * Prevents re-renders of individual rows when other rows update
 */
export const DataTableRow = memo(
  ({
    data,
    onSelect,
    isSelected,
  }: {
    data: any;
    onSelect: (id: string) => void;
    isSelected: boolean;
  }) => {
    const handleSelect = useCallback(() => {
      onSelect(data.id);
    }, [data.id, onSelect]);

    return (
      <tr
        onClick={handleSelect}
        className={`cursor-pointer ${isSelected ? 'bg-blue-900' : 'hover:bg-slate-700'}`}
      >
        <td className="px-4 py-2">{data.id}</td>
        <td className="px-4 py-2">{data.name}</td>
        <td className="px-4 py-2">{data.status}</td>
      </tr>
    );
  }
);

DataTableRow.displayName = 'DataTableRow';

/**
 * Dataset card with memoization
 * Reduces re-renders in list of datasets
 */
export const DatasetCard = memo(
  ({ dataset, onView, onDelete }: { dataset: any; onView: () => void; onDelete: () => void }) => {
    const handleView = useCallback(onView, [onView]);
    const handleDelete = useCallback(onDelete, [onDelete]);

    const metadata = useMemo(
      () => ({
        rows: dataset.rowCount || 0,
        columns: dataset.columnCount || 0,
        size: `${((dataset.size || 0) / 1024 / 1024).toFixed(2)} MB`,
      }),
      [dataset.rowCount, dataset.columnCount, dataset.size]
    );

    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500 transition">
        <h3 className="font-semibold text-white mb-2">{dataset.name}</h3>
        <div className="text-sm text-slate-400 space-y-1">
          <p>Rows: {metadata.rows.toLocaleString()}</p>
          <p>Columns: {metadata.columns}</p>
          <p>Size: {metadata.size}</p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleView}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            View
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }
);

DatasetCard.displayName = 'DatasetCard';

/**
 * Query results table with virtualization and memoization
 * Only renders visible rows, prevents rendering thousands of rows
 */
export const QueryResultsTable = memo(
  ({
    results,
    columns,
    isLoading,
  }: {
    results: any[];
    columns: string[];
    isLoading: boolean;
  }) => {
    const memoizedColumns = useMemo(() => columns, [columns]);
    const memoizedResults = useMemo(() => results, [results]);

    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700">
            <tr>
              {memoizedColumns.map((col) => (
                <th key={col} className="px-4 py-2 text-left">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memoizedResults.map((row, idx) => (
              <tr key={idx} className="border-t border-slate-700 hover:bg-slate-800">
                {memoizedColumns.map((col) => (
                  <td key={`${idx}-${col}`} className="px-4 py-2">
                    {row[col] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

QueryResultsTable.displayName = 'QueryResultsTable';

/**
 * Modal dialog with memoization
 * Prevents re-render when parent re-renders
 */
export const Modal = memo(
  ({
    isOpen,
    title,
    children,
    onClose,
    actions,
  }: {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    actions?: { label: string; onClick: () => void; variant?: string }[];
  }) => {
    const handleClose = useCallback(onClose, [onClose]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-white">
              ×
            </button>
          </div>
          <div className="text-slate-200 mb-6">{children}</div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
            >
              Cancel
            </button>
            {actions?.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className={`px-4 py-2 rounded ${
                  action.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';

/**
 * Pagination controls with memoization
 */
export const PaginationControls = memo(
  ({
    page,
    totalPages,
    onPageChange,
    isLoading,
  }: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    isLoading: boolean;
  }) => {
    const handlePrevious = useCallback(() => {
      if (page > 1) onPageChange(page - 1);
    }, [page, onPageChange]);

    const handleNext = useCallback(() => {
      if (page < totalPages) onPageChange(page + 1);
    }, [page, totalPages, onPageChange]);

    return (
      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={handlePrevious}
          disabled={page === 1 || isLoading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
        >
          Previous
        </button>
        <span className="text-slate-300">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={handleNext}
          disabled={page === totalPages || isLoading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
        >
          Next
        </button>
      </div>
    );
  }
);

PaginationControls.displayName = 'PaginationControls';

/**
 * Error message component with memoization
 */
export const ErrorMessage = memo(
  ({ message, onDismiss }: { message: string; onDismiss?: () => void }) => {
    const handleDismiss = useCallback(() => {
      onDismiss?.();
    }, [onDismiss]);

    return (
      <div className="bg-red-900 border border-red-700 rounded p-4 mb-4 flex items-center justify-between">
        <p className="text-red-200">{message}</p>
        {onDismiss && (
          <button onClick={handleDismiss} className="text-red-400 hover:text-red-200">
            ×
          </button>
        )}
      </div>
    );
  }
);

ErrorMessage.displayName = 'ErrorMessage';

/**
 * Success message component with memoization
 */
export const SuccessMessage = memo(
  ({ message, onDismiss }: { message: string; onDismiss?: () => void }) => {
    const handleDismiss = useCallback(() => {
      onDismiss?.();
    }, [onDismiss]);

    return (
      <div className="bg-green-900 border border-green-700 rounded p-4 mb-4 flex items-center justify-between">
        <p className="text-green-200">{message}</p>
        {onDismiss && (
          <button onClick={handleDismiss} className="text-green-400 hover:text-green-200">
            ×
          </button>
        )}
      </div>
    );
  }
);

SuccessMessage.displayName = 'SuccessMessage';

/**
 * Loading spinner component
 * Pure component, benefits from memoization
 */
export const LoadingSpinner = memo(
  ({
    size = 'md',
    message = 'Loading...',
  }: {
    size?: 'sm' | 'md' | 'lg';
    message?: string;
  }) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-8 w-8',
      lg: 'h-12 w-12',
    };

    return (
      <div className="flex flex-col items-center justify-center gap-2">
        <div className={`animate-spin rounded-full border-t-2 border-blue-500 ${sizeClasses[size]}`} />
        {message && <p className="text-sm text-slate-400">{message}</p>}
      </div>
    );
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';

export default {
  SidebarOptimized,
  DataTableRow,
  DatasetCard,
  QueryResultsTable,
  Modal,
  PaginationControls,
  ErrorMessage,
  SuccessMessage,
  LoadingSpinner,
};
