import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace, useWorkspaceNavigation } from '../hooks/useWorkspace';
import { useDataset, useDatasetNavigation } from '../hooks/useDataset';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface Dataset {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  file_name: string;
  row_count: number;
  column_count: number;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export const DatasetLibrary: React.FC = () => {
  const { user, token } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const {
    datasets,
    total,
    setActiveDataset,
    removeDataset,
    isLoading: loading,
    error: contextError,
    fetchDatasets
  } = useDataset();
  const { buildPath: buildWorkspacePath } = useWorkspaceNavigation();
  const { buildPath: buildDatasetPath } = useDatasetNavigation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Use context workspace, fall back to URL param, then redirect if neither
  const workspaceId = activeWorkspace?.id || searchParams.get('workspace');

  const [localError, setLocalError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const error = localError || contextError;

  useEffect(() => {
    if (!workspaceId) {
      navigate('/app/workspaces');
      return;
    }
    fetchDatasets(workspaceId.toString(), pageSize, (page - 1) * pageSize);
  }, [workspaceId, page, pageSize, fetchDatasets]);

  const handleDeleteDataset = async (id: number) => {
    if (!window.confirm('Delete this dataset?')) return;

    try {
      setLocalError(null);
      await removeDataset(id);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to delete dataset');
    }
  };


  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="text-slate-500 dark:text-slate-400">Loading datasets...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 transition-colors">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => navigate('/app/workspaces')}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 text-sm mb-2 flex items-center gap-1"
            >
              ← Back to Workspaces
            </button>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Datasets</h1>
            <p className="text-slate-500 dark:text-slate-400">Manage your datasets in this workspace</p>
          </div>
          <button
            onClick={() => navigate(buildWorkspacePath('/app/upload'))}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
          >
            + Upload Dataset
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Datasets Table */}
        {datasets.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <svg className="w-16 h-16 mx-auto mb-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-600 dark:text-slate-400 mb-4">No datasets uploaded yet in this workspace</p>
            <p className="text-slate-500 text-sm mb-6">Create your first dataset to get started with data exploration and analysis</p>
            <button
              onClick={() => navigate(buildWorkspacePath('/app/upload'))}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Upload First Dataset
            </button>
          </div>
        ) : (
          <>
            {/* Pagination Controls */}
            <div className="flex items-center justify-between mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <label className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  Items per page:
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value));
                      setPage(1);
                    }}
                    className="px-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </label>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} datasets
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>
                <span className="px-4 py-2 text-slate-600 dark:text-white text-sm font-medium">
                  Page {page} of {Math.ceil(total / pageSize)}
                </span>
                <button
                  onClick={() => setPage(Math.min(Math.ceil(total / pageSize), page + 1))}
                  disabled={page >= Math.ceil(total / pageSize)}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Rows</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Columns</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Size</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Created</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets && Array.isArray(datasets) && datasets.map((dataset) => (
                    <tr
                      key={dataset.id}
                      className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      onClick={() => {
                        setActiveDataset(dataset);
                        navigate(buildDatasetPath('/app/clean'));
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-600/20 rounded flex items-center justify-center border border-indigo-200 dark:border-indigo-500/50">
                            <svg
                              className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-slate-900 dark:text-white font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {dataset.name}
                            </p>
                            <p className="text-xs text-slate-500">{dataset.file_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-white">{dataset.row_count.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-white">{dataset.column_count}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatBytes(dataset.file_size)}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {new Date(dataset.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDataset(dataset.id);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
