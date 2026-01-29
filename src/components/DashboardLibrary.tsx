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

  // Sync formData.datasetId with URL parameter
  useEffect(() => {
    if (filterDatasetId) {
      setFormData(prev => ({ ...prev, datasetId: filterDatasetId }));
    }
  }, [filterDatasetId]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const dRes = await axios.get(`${backendUrl}/workspaces/${workspaceId}/dashboards`, { headers: { Authorization: `Bearer ${token}` } });
      const dsRes = await axios.get(`${backendUrl}/workspaces/${workspaceId}/datasets`, { headers: { Authorization: `Bearer ${token}` } });

      const allDashboards = dRes.data.data || dRes.data || [];
      const dsList = Array.isArray(dsRes.data) ? dsRes.data : (dsRes.data.data || []);

      const safeParse = (val: any) => {
        if (!val) return undefined;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
          } catch (e) { return undefined; }
        }
        return val;
      };

      // Synthesis: Create a "Primary Analysis" entry for every dataset (The MASTER Session)
      const primaryItems = dsList.map((ds: any) => {
        const config = safeParse(ds.dashboard_config);
        return {
          id: `primary-${ds.id}`,
          dataset_id: ds.id,
          name: config?.name || ds.name + ' Master',
          description: config?.description || 'Main intelligence session for this dataset',
          isPrimary: true,
          created_at: ds.created_at,
          updated_at: ds.updated_at,
          charts_count: config?.charts?.length || 0,
          kpis_count: config?.kpis?.length || 0
        };
      });

      // Synthesis: Process saved versions (The DASHBOARDS table)
      const versionItems = allDashboards.filter((d: any) => d.layout?.type !== 'report').map((d: any) => {
        const config = d.layout?.config;
        return {
          ...d,
          name: d.name,
          charts_count: config?.charts?.length || 0,
          kpis_count: config?.kpis?.length || 0
        };
      });

      const combined = filterDatasetId
        ? [...primaryItems.filter(p => p.dataset_id === filterDatasetId), ...versionItems.filter((d: any) => d.layout?.dataset_id === filterDatasetId)]
        : [...primaryItems, ...versionItems];

      setDashboards(combined as any);
      setDatasets(dsList);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load dashboard library');
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

      const newDashboard = response.data.data || response.data;
      if (newDashboard.id) {
        navigate(`/app/dashboard?id=${newDashboard.id}&workspace=${workspaceId}`);
      } else {
        throw new Error('Dashboard created but no ID returned');
      }
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
                  disabled={!!filterDatasetId}
                >
                  <option value="">Select a Dataset...</option>
                  {datasets.map(ds => {
                    let rowCount = ds.row_count;
                    if (!rowCount && ds.raw_data) {
                      try {
                        const parsed = typeof ds.raw_data === 'string' ? JSON.parse(ds.raw_data) : ds.raw_data;
                        rowCount = Array.isArray(parsed) ? parsed.length : 0;
                      } catch (e) { rowCount = 0; }
                    }
                    return (
                      <option key={ds.id} value={ds.id}>{ds.name} ({(rowCount || 0).toLocaleString()} rows)</option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block uppercase tracking-widest font-bold text-[10px]">Dashboard Name*</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={filterDatasetId ? `${datasets.find(d => d.id === filterDatasetId)?.name} Analysis` : "e.g., Growth Analytics"}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  autoFocus
                />
              </div>

              {filterDatasetId && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-500/30 flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-indigo-500 dark:text-indigo-400">Context Active</p>
                    <p className="text-xs font-bold text-indigo-900 dark:text-indigo-100">
                      Creating analysis for: {datasets.find(d => d.id === filterDatasetId)?.name}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-slate-400 mb-2 block uppercase tracking-widest font-bold text-[10px]">Description</label>
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
                  disabled={submitting || (!filterDatasetId && !formData.datasetId)}
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
            {dashboards && Array.isArray(dashboards) && dashboards.map((dash: any, i: number) => (
              <div
                key={dash.id}
                className="group relative bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-white/5 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => {
                  const url = dash.isPrimary
                    ? `/app/dashboard?dataset=${dash.dataset_id}&workspace=${workspaceId}`
                    : `/app/dashboard?id=${dash.id}&workspace=${workspaceId}&dataset=${dash.layout?.dataset_id || filterDatasetId}`;
                  navigate(url);
                }}
              >
                <div className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition-transform group-hover:scale-110 ${dash.isPrimary ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                      {dash.isPrimary ? '💎' : '📊'}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {dash.isPrimary ? (
                        <span className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-500/20">
                          Master Session
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-full">
                          Saved Version
                        </span>
                      )}

                      <div className="flex gap-1">
                        <span className="px-2 py-0.5 bg-slate-50 dark:bg-white/5 text-[8px] font-bold text-slate-400 uppercase rounded">
                          {dash.charts_count || 0} Charts
                        </span>
                        <span className="px-2 py-0.5 bg-slate-50 dark:bg-white/5 text-[8px] font-bold text-slate-400 uppercase rounded">
                          {dash.kpis_count || 0} KPIs
                        </span>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 group-hover:text-indigo-600 transition-colors">
                    {dash.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">
                    {dash.description || 'Custom analytical perspective drafted for strategic decision support.'}
                  </p>
                </div>

                <div className="px-8 py-5 bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {new Date(dash.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    Open Analysis
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
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
