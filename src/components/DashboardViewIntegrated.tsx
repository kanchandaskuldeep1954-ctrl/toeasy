import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import DashboardView from '../../components/DashboardView';
import { Dataset } from '../../types';
import datasetAPI from '../services/api';

const DashboardViewIntegrated: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace') || '';
  const datasetId = searchParams.get('dataset') || '';
  const dashboardId = searchParams.get('id') || '';

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [dashboardEntity, setDashboardEntity] = useState<any>(null);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Agent State
  const [agentQuery, setAgentQuery] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (workspaceId && (datasetId || dashboardId) && token) {
      loadAll();
    }
  }, [workspaceId, datasetId, dashboardId, token]);

  const loadAll = async () => {
    try {
      setLoading(true);

      let targetDatasetId = datasetId;
      let initialConfig = undefined;
      let entityHasConfig = false;

      // 1. If we have a dashboard ID, fetch the specific entity
      if (dashboardId) {
        const response = await axios.get(
          `${backendUrl}/workspaces/${workspaceId}/dashboards/${dashboardId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const dash = response.data;
        setDashboardEntity(dash);
        targetDatasetId = dash.layout?.dataset_id || datasetId;
        initialConfig = dash.layout?.config;
        entityHasConfig = true; // Signals we are in a specific dashboard context
      }

      if (!targetDatasetId) {
        throw new Error('No dataset linked to this analysis.');
      }

      // 2. Fetch Dataset + Siblings
      const [dsRes, siblingsRes] = await Promise.all([
        axios.get(`${backendUrl}/workspaces/${workspaceId}/datasets/${targetDatasetId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${backendUrl}/workspaces/${workspaceId}/dashboards`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const dsData = dsRes.data;
      const allDashboards = siblingsRes.data.data || [];

      const dashSiblings = allDashboards.filter((d: any) => d.layout?.dataset_id === targetDatasetId && d.layout?.type !== 'report');

      // Synthesis: Prepend the "Master" version to the switcher
      const masterVersion = {
        id: 'primary',
        name: 'Master Analysis',
        isPrimary: true
      };

      setSiblings([masterVersion, ...dashSiblings]);

      const safeParse = (val: any) => {
        if (!val) return undefined;
        if (typeof val === 'string') {
          try {
            const first = JSON.parse(val);
            return typeof first === 'string' ? JSON.parse(first) : first;
          } catch (e) { return undefined; }
        }
        return val;
      };

      const rawData = safeParse(dsData.raw_data || dsData.data) || [];
      const headers = safeParse(dsData.headers) || [];
      const finalHeaders = headers.length > 0 ? headers : Object.keys(rawData?.[0] || {});

      // Transform - Priority to entity config. If entity context active, NEVER fallback to dataset global.
      const transformedDataset: Dataset = {
        id: dsData.id || targetDatasetId,
        name: dsData.name || 'Dataset',
        sourceType: dsData.source_type || 'csv',
        headers: finalHeaders,
        data: rawData,
        stats: dsData.stats || [],
        createdAt: dsData.created_at || new Date().toISOString(),
        rowCount: rawData.length,
        quarantinedData: [],
        cleaningActions: [],
        dashboardConfig: entityHasConfig ? initialConfig : (dsData.dashboard_config ? safeParse(dsData.dashboard_config) : undefined),
        strategicReport: dsData.strategic_report ? safeParse(dsData.strategic_report) : undefined,
      };

      setDataset(transformedDataset);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updated: Dataset) => {
    if (!workspaceId) return;
    try {
      setDataset(updated);

      if (dashboardId) {
        // Persist to the specific dashboard entity
        await axios.put(`${backendUrl}/workspaces/${workspaceId}/dashboards/${dashboardId}`, {
          name: dashboardEntity?.name || updated.name + ' Analysis',
          layout: {
            dataset_id: updated.id || datasetId,
            config: updated.dashboardConfig
          }
        }, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        // Fallback to updating the dataset legacy default
        await datasetAPI.dataset.update(workspaceId, updated.id || datasetId, {
          dashboard_config: updated.dashboardConfig,
          strategic_report: updated.strategicReport
        });
      }
    } catch (err) {
      console.error('Failed to persist dashboard update:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 dark:text-slate-400 font-bold">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="text-center space-y-6 max-w-md p-6">
          <div>
            <p className="text-red-500 dark:text-red-400 text-lg font-bold mb-2">⚠️ Error</p>
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">{error || 'Failed to load dataset'}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }


  const consultAgent = async () => {
    if (!agentQuery) return;
    setIsAgentThinking(true);
    // Dynamic import to avoid circular dependency if needed, or just import GroqService
    try {
      const { GroqService } = await import('../services/groqService');
      const res = await GroqService.consultVerifiedAgent(
        { headers: dataset?.headers || [], data: dataset?.data || [] } as any,
        agentQuery
      );
      setAgentResponse(res);
    } catch (e) {
      setAgentResponse("Agent is offline.");
    } finally {
      setIsAgentThinking(false);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden flex flex-col">
      {/* Analysis Context Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between z-[110]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const path = datasetId ? `/app/dashboards?workspace=${workspaceId}&dataset=${datasetId}` : `/app/dashboards?workspace=${workspaceId}`;
              import('react-router-dom').then(m => window.location.href = path); // Simplest escape for now or use navigate
            }}
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            Library
          </button>
          <div className="h-4 w-px bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{dataset?.name} /</span>
            <div className="relative">
              <button
                onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                className="flex items-center gap-2 text-white text-xs font-black uppercase tracking-tight hover:text-indigo-400 transition-colors"
              >
                {dashboardEntity?.name || 'Default Dashboard'}
                <svg className={`w-3 h-3 transition-transform ${isSwitcherOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {isSwitcherOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
                  <p className="px-3 py-2 text-[8px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">Switch Analysis</p>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {siblings.map(sib => (
                      <button
                        key={sib.id}
                        onClick={() => {
                          if (sib.isPrimary) {
                            window.location.href = `/app/dashboard?dataset=${datasetId}&workspace=${workspaceId}`;
                          } else {
                            window.location.href = `/app/dashboard?id=${sib.id}&workspace=${workspaceId}&dataset=${datasetId}`;
                          }
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-3 ${((sib.isPrimary && !dashboardId) || (sib.id === dashboardId)) ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                      >
                        <span className="opacity-50">{sib.isPrimary ? '💎' : '📊'}</span>
                        <span className="truncate">{sib.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => window.location.href = `/app/dashboards?workspace=${workspaceId}&dataset=${datasetId}&new=true`}
                      className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-600/10 transition-all mt-2 border-t border-white/5 pt-3"
                    >
                      + New Version
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {[1, 2].map(i => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-900 bg-indigo-500 flex items-center justify-center text-[8px] font-bold text-white">AI</div>
            ))}
          </div>
          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest animate-pulse">Live Sync Active</span>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <DashboardView dataset={dataset} onUpdate={handleUpdate} />
      </div>

      {/* Agent Overlay - Responsive */}
      <div className={`fixed bottom-4 right-4 md:bottom-6 md:right-6 transition-all duration-300 z-[100] flex flex-col items-end ${isAgentOpen ? 'w-[calc(100%-2rem)] md:w-80' : 'w-auto'}`}>
        {isAgentOpen ? (
          <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200">
            {/* Header */}
            <div className="bg-indigo-600 p-3 flex justify-between items-center cursor-pointer" onClick={() => setIsAgentOpen(false)}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                <span className="text-white text-xs font-bold uppercase tracking-wider">Dashboard Agent</span>
              </div>
              <button className="text-white/70 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>

            {/* Chat Area */}
            <div className="h-64 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950/50 custom-scrollbar">
              {agentResponse ? (
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg rounded-tl-none shadow-sm text-xs text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-700">
                  {agentResponse}
                </div>
              ) : (
                <div className="text-center mt-8">
                  <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">I can explain these charts and suggest insights.</p>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                value={agentQuery}
                onChange={e => setAgentQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && consultAgent()}
                placeholder="Ask about this dashboard..."
                autoFocus
                className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              />
              <button
                onClick={consultAgent}
                disabled={isAgentThinking || !agentQuery.trim()}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isAgentThinking ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAgentOpen(true)}
            className="group flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-full shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
          >
            <span className="text-xs font-bold uppercase tracking-wider max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">Ask Agent</span>
            <div className="relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-600 rounded-full"></span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardViewIntegrated;
