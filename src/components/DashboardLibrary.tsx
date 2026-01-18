import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Dashboard {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  description?: string;
  layout: any;
  created_at: string;
  updated_at: string;
  charts_count?: number;
}

export const DashboardLibrary: React.FC = () => {
  const { user, token } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace') || activeWorkspace?.id?.toString() || '';

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (workspaceId) {
      fetchDashboards();
    }
  }, [token, workspaceId]);

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/dashboards`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDashboards(response.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboards');
      console.error('Error fetching dashboards:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Dashboard name is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/dashboards`,
        { name: formData.name, description: formData.description, layout: {} },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDashboards([...dashboards, response.data]);
      setFormData({ name: '', description: '' });
      setShowNewForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDashboard = async (id: string) => {
    if (!window.confirm('Delete this dashboard?')) return;

    try {
      await axios.delete(`${backendUrl}/workspaces/${workspaceId}/dashboards/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboards(dashboards.filter(d => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dashboard');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-slate-400">Loading dashboards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dashboards</h1>
            <p className="text-slate-400">Create and manage dashboards</p>
          </div>
          {!showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              + New Dashboard
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* New Dashboard Form */}
        {showNewForm && (
          <div className="mb-8 p-6 bg-slate-900 border border-slate-800 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-4">Create New Dashboard</h2>
            <form onSubmit={handleCreateDashboard} className="space-y-4 max-w-md">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Dashboard Name*</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Sales Overview"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Dashboards Grid */}
        {dashboards.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
            <p className="text-slate-400 mb-4">No dashboards yet</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Create First Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboards && Array.isArray(dashboards) && dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors cursor-pointer group"
                onClick={() => navigate(`/app/dashboard?id=${dashboard.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center border border-indigo-500/50">
                    <svg
                      className="w-6 h-6 text-indigo-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDashboard(dashboard.id);
                    }}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
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

                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                  {dashboard.name}
                </h3>

                {dashboard.description && (
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2">{dashboard.description}</p>
                )}

                <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between">
                  <div className="text-sm">
                    <p className="text-slate-400">Charts</p>
                    <p className="text-lg font-bold text-white">{dashboard.charts_count || 0}</p>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(dashboard.created_at).toLocaleDateString()}
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
