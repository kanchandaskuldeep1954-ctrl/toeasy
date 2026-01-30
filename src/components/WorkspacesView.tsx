import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useNavigate } from 'react-router-dom';

interface Workspace {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  dataset_count?: number;
}

export const WorkspacesView: React.FC = () => {
  const { user, token } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    addWorkspace,
    removeWorkspace,
    isLoading: loading,
    error: contextError,
    setError: setContextError,
    hasMore,
    loadMoreWorkspaces
  } = useWorkspace();
  const navigate = useNavigate();
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError || contextError;

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setLocalError('Workspace name is required');
      return;
    }

    try {
      setSubmitting(true);
      setLocalError(null);
      await addWorkspace(formData);
      setFormData({ name: '', description: '' });
      setShowNewForm(false);
    } catch (err: any) {
      const { getErrorMessage } = await import('../services/api');
      setLocalError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWorkspace = async (id: number) => {
    if (!window.confirm('Are you sure? This cannot be undone.')) return;

    try {
      setLocalError(null);
      await removeWorkspace(id);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to delete workspace');
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-slate-600 dark:text-slate-400">Loading workspaces...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 transition-colors">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Workspaces</h1>
            <p className="text-slate-600 dark:text-slate-400">Organize your datasets and analyses</p>
          </div>
          {!showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              + New Workspace
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* New Workspace Form */}
        {showNewForm && (
          <div className="mb-8 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Create New Workspace</h2>
            <form onSubmit={handleCreateWorkspace} className="space-y-4 max-w-md">
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-400 mb-2 block">Workspace Name*</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Customer Analytics"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-400 mb-2 block">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Workspaces Grid */}
        {workspaces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400 mb-4">No workspaces yet</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Create First Workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces && Array.isArray(workspaces) && workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-200 dark:hover:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => {
                  setActiveWorkspace(workspace);
                  navigate(`/app/datasets`);
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-600/20 rounded-lg flex items-center justify-center border border-indigo-100 dark:border-indigo-500/50">
                    <svg
                      className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkspace(workspace.id);
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {workspace.name}
                </h3>

                {workspace.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">{workspace.description}</p>
                )}

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between">
                  <div className="text-sm">
                    <p className="text-slate-500 dark:text-slate-400">Datasets</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{workspace.dataset_count || 0}</p>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(workspace.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
