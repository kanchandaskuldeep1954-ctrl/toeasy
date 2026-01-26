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
  const filterDatasetId = searchParams.get('dataset') || '';

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', datasetId: filterDatasetId });
  const [submitting, setSubmitting] = useState(false);

  const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (workspaceId) {
      loadAll();
      if (searchParams.get('new') === 'true') {
        setShowNewForm(true);
      }
    }
  }, [token, workspaceId, searchParams]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [dRes, dsRes] = await Promise.all([
        axios.get(`${backendUrl}/workspaces/${workspaceId}/dashboards`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${backendUrl}/workspaces/${workspaceId}/datasets`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const allDashboards = dRes.data.data || [];
      const dsList = dsRes.data || [];

      // Synthesis: Create a "Primary Analysis" entry for every dataset
      const primaryItems = dsList.map((ds: any) => ({
        id: `primary-${ds.id}`,
        dataset_id: ds.id,
        name: ds.name,
        description: 'Core intelligence and primary workspace',
        isPrimary: true,
        created_at: ds.created_at,
        updated_at: ds.updated_at,
        charts_count: 0 // We don't have accurate count for primary without fetching it
      }));

      const combined = filterDatasetId
        ? [...primaryItems.filter(p => p.dataset_id === filterDatasetId), ...allDashboards.filter((d: any) => d.layout?.dataset_id === filterDatasetId)]
        : [...primaryItems, ...allDashboards];

      setDashboards(combined as any);
      setDatasets(dsList);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.datasetId) {
      setError('Name and Dataset are required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/dashboards`,
        {
          name: formData.name,
          description: formData.description,
          layout: { dataset_id: formData.datasetId, config: null }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newDashboard = response.data;
      navigate(`/app/dashboard?id=${newDashboard.id}&workspace=${workspaceId}`);
    } catch (err) {
      setError('Failed to create dashboard');
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
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Loading dashboards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
              {filterDatasetId ? `${(Array.isArray(datasets) ? datasets : []).find(d => d.id === filterDatasetId)?.name || 'Dataset'} Vault` : 'Dashboards Library'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {filterDatasetId ? 'Manage analysis versions for this data source' : 'Global collection of analytics workspaces'}
            </p>
          </div>
          {!showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
            >
              + Create Analysis
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
          <div className="mb-8 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Create New Dashboard</h2>
            <form onSubmit={handleCreateDashboard} className="space-y-4 max-w-md">
              <div>
                <label className="text-sm text-slate-400 mb-2 block uppercase tracking-widest font-bold text-[10px]">Data Source*</label>
                <select
                  value={formData.datasetId}
                  onChange={(e) => setFormData({ ...formData, datasetId: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium appearance-none cursor-pointer"
                  required
                >
                  <option value="">Select a Dataset...</option>
                  {datasets.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name} ({(JSON.parse(ds.raw_data || '[]').length).toLocaleString()} rows)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block uppercase tracking-widest font-bold text-[10px]">Dashboard Name*</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Growth Analytics"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
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
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm border-dashed">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </div>
            <p className="text-slate-900 dark:text-white font-bold text-lg mb-2">No dashboards yet</p>
            <p className="text-slate-500 max-w-sm mx-auto mb-6">Create your first dashboard to start visualizing your data and uncovering insights.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Create First Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboards && Array.isArray(dashboards) && dashboards.map((dashboard: any) => (
              <div
                key={dashboard.id}
                className={`group relative p-6 bg-white dark:bg-slate-900 border ${dashboard.isPrimary ? 'border-indigo-500/30 shadow-indigo-500/5' : 'border-slate-200 dark:border-slate-800'} rounded-3xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden`}
                onClick={() => {
                  const path = dashboard.isPrimary
                    ? `/app/dashboard?dataset=${dashboard.dataset_id}&workspace=${workspaceId}`
                    : `/app/dashboard?id=${dashboard.id}&workspace=${workspaceId}`;
                  navigate(path);
                }}
              >
                {dashboard.isPrimary && (
                  <div className="absolute top-0 left-0 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-br-xl z-20">
                    Core Session
                  </div>
                )}

                {!dashboard.isPrimary && (
                  <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDashboard(dashboard.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-full hover:shadow-lg transition-all"
                      title="Delete Dashboard"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}

                <div className="flex items-start justify-between mb-6">
                  <div className={`w-14 h-14 ${dashboard.isPrimary ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'} rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20 group-hover:scale-110 transition-transform duration-300`}>
                    {dashboard.isPrimary ? <span className="text-2xl font-black">M</span> : (
                      <svg
                        className="w-7 h-7"
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
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {dashboard.name}
                </h3>

                {dashboard.description && (
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2">{dashboard.description}</p>
                )}

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-6 flex items-center justify-between">
                  <div className="text-sm">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Type</p>
                    <p className={`text-xs font-black uppercase ${dashboard.isPrimary ? 'text-indigo-600' : 'text-slate-500'}`}>{dashboard.isPrimary ? 'Master' : 'Version'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Created</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {new Date(dashboard.created_at).toLocaleDateString()}
                    </p>
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
