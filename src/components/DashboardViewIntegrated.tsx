import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import DashboardView from '../../components/DashboardView';
import { Dataset } from '../types';

const DashboardViewIntegrated: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');
  const datasetId = searchParams.get('dataset');

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Agent State
  const [agentQuery, setAgentQuery] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (workspaceId && datasetId && token) {
      loadDataset();
    }
  }, [workspaceId, datasetId, token]);

  const loadDataset = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data;
      const rawData = data.raw_data || data.data || [];
      const headers = data.headers || Object.keys(rawData?.[0] || {});

      // Transform backend response to Dataset format
      const transformedDataset: Dataset = {
        id: data.id || datasetId,
        name: data.name || 'Dataset',
        headers: headers,
        data: rawData,
        stats: data.stats || [],
        createdAt: data.created_at || new Date().toISOString(),
        rowCount: rawData.length,
        quarantinedData: [],
        cleaningActions: [],
      };

      setDataset(transformedDataset);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dataset');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 font-bold">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center space-y-6 max-w-md">
          <div>
            <p className="text-red-400 text-lg font-bold mb-2">⚠️ Error</p>
            <p className="text-slate-300 text-sm">{error || 'Failed to load dataset'}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold"
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
    <div className="relative h-screen overflow-hidden">
      <DashboardView dataset={dataset} />

      {/* Agent Overlay - Collapsible */}
      <div className={`absolute bottom-6 right-6 transition-all duration-300 z-50 flex flex-col items-end ${isAgentOpen ? 'w-80' : 'w-auto'}`}>
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
            <div className="h-64 overflow-y-auto p-4 bg-slate-50 dark:bg-black/20 custom-scrollbar">
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
