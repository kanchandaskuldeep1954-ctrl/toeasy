import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

interface DashboardConfig {
  id: string;
  workspace_id: string;
  dataset_id: string;
  name: string;
  description: string;
  charts: any[];
  filters: Record<string, any>;
  layout: string; // 'grid' | 'flow' | 'custom'
  theme: string;
  created_at: string;
  updated_at: string;
}

const DashboardViewIntegrated: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');
  const datasetId = searchParams.get('dataset');

  const [dashboards, setDashboards] = useState<DashboardConfig[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (workspaceId && datasetId && token) {
      loadDashboards();
    }
  }, [workspaceId, datasetId, token]);

  const loadDashboards = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/dashboards`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setDashboards(response.data?.data || response.data || []);
      if (response.data?.data && response.data.data.length > 0) {
        setCurrentDashboard(response.data.data[0]);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load dashboards');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createDashboard = async () => {
    if (!createForm.name || !workspaceId || !datasetId) {
      setError('Dashboard name is required');
      return;
    }

    try {
      setIsSaving(true);
      const response = await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/dashboards`,
        {
          name: createForm.name,
          description: createForm.description,
          charts: [],
          filters: {},
          layout: 'grid',
          theme: 'dark'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setDashboards([...dashboards, response.data]);
      setCurrentDashboard(response.data);
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '' });
      setError(null);
    } catch (err) {
      setError('Failed to create dashboard');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const saveDashboard = async () => {
    if (!currentDashboard || !workspaceId) return;

    try {
      setIsSaving(true);
      await axios.put(
        `${backendUrl}/workspaces/${workspaceId}/dashboards/${currentDashboard.id}`,
        currentDashboard,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setError(null);
      // Show success toast would go here
    } catch (err) {
      setError('Failed to save dashboard');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDashboard = async (dashboardId: string) => {
    if (!window.confirm('Delete this dashboard?')) return;

    try {
      await axios.delete(
        `${backendUrl}/workspaces/${workspaceId}/dashboards/${dashboardId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updated = dashboards.filter(d => d.id !== dashboardId);
      setDashboards(updated);
      
      if (currentDashboard?.id === dashboardId) {
        setCurrentDashboard(updated[0] || null);
      }
    } catch (err) {
      setError('Failed to delete dashboard');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Loading dashboards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Dashboards</h1>
            <p className="text-slate-400">Create and manage custom data visualizations</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors"
          >
            + New Dashboard
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-900/20 border border-rose-800 rounded-lg text-rose-200">
            {error}
          </div>
        )}

        {/* Dashboard Selector */}
        {dashboards.length > 0 && (
          <div className="mb-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-white font-bold mb-4">Available Dashboards</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboards.map(dashboard => (
                <div
                  key={dashboard.id}
                  onClick={() => setCurrentDashboard(dashboard)}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    currentDashboard?.id === dashboard.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800'
                  }`}
                >
                  <h4 className="text-white font-bold mb-1">{dashboard.name}</h4>
                  <p className="text-xs text-slate-400 mb-3">{dashboard.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-500">
                      {new Date(dashboard.updated_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDashboard(dashboard.id);
                      }}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Dashboard View */}
        {currentDashboard ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{currentDashboard.name}</h2>
                <p className="text-slate-400 text-sm">{currentDashboard.description}</p>
              </div>
              <button
                onClick={saveDashboard}
                disabled={isSaving}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {/* Placeholder for Dashboard Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1 */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-white font-bold mb-4">Chart 1</h3>
                <div className="h-64 bg-slate-700/30 rounded flex items-center justify-center text-slate-500">
                  Add charts to your dashboard
                </div>
              </div>

              {/* Chart 2 */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-white font-bold mb-4">Chart 2</h3>
                <div className="h-64 bg-slate-700/30 rounded flex items-center justify-center text-slate-500">
                  Add charts to your dashboard
                </div>
              </div>

              {/* Chart 3 */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-white font-bold mb-4">Chart 3</h3>
                <div className="h-64 bg-slate-700/30 rounded flex items-center justify-center text-slate-500">
                  Add charts to your dashboard
                </div>
              </div>

              {/* Chart 4 */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-white font-bold mb-4">Chart 4</h3>
                <div className="h-64 bg-slate-700/30 rounded flex items-center justify-center text-slate-500">
                  Add charts to your dashboard
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
            <p className="text-slate-400 mb-4">No dashboards yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors"
            >
              Create First Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Create New Dashboard</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Dashboard name"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Description (optional)"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none h-24"
              />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-3 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createDashboard}
                disabled={isSaving || !createForm.name}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardViewIntegrated;
