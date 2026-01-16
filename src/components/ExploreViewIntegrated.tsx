import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

interface Analysis {
  summary: string;
  insights: string[];
  patterns: string[];
  anomalies: string[];
  recommendations: string[];
  dataQuality: {
    completeness: number;
    consistency: number;
    accuracy: number;
    validity: number;
  };
}

const ExploreViewIntegrated: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');
  const datasetId = searchParams.get('dataset');

  const [analysisType, setAnalysisType] = useState<'statistical' | 'patterns' | 'quality' | 'full'>('full');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedArea, setFocusedArea] = useState<string | null>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  const runAnalysis = async () => {
    if (!workspaceId || !datasetId) {
      setError('Workspace or dataset not selected');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/analyze`,
        {
          type: analysisType,
          depth: 'full'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAnalysis(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto h-full flex flex-col gap-6 p-4 overflow-auto">
      
      {/* Header */}
      <div className="shrink-0">
        <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Data Explorer</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">AI-powered analysis and insights from your dataset</p>
      </div>

      {/* Control Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl p-6 shrink-0">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Analysis Type</label>
            <div className="flex gap-2 flex-wrap">
              {(['statistical', 'patterns', 'quality', 'full'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setAnalysisType(type)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-bold uppercase transition-all ${
                    analysisType === type 
                      ? 'bg-indigo-600 text-white shadow-lg' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {type === 'statistical' ? 'Statistical' : type === 'patterns' ? 'Patterns' : type === 'quality' ? 'Quality' : 'Full Analysis'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading || !workspaceId || !datasetId}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 h-fit"
          >
            {loading ? 'Analyzing...' : 'Analyze Dataset'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-[32px] p-6">
          {error}
        </div>
      )}

      {/* Results */}
      {analysis && (
        <div className="space-y-6">
          
          {/* Summary Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-[32px] p-8 text-white shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-4">Executive Summary</h3>
            <p className="text-lg leading-relaxed font-bold">{analysis.summary}</p>
          </div>

          {/* Data Quality Metrics */}
          {analysis.dataQuality && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl p-8">
              <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">Data Quality Metrics</h3>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(analysis.dataQuality).map(([key, value]) => (
                  <div key={key} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 text-center">
                    <div className="text-3xl font-black text-indigo-600 mb-2">{Math.round(value)}%</div>
                    <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">{key}</p>
                    <div className="mt-3 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Three Column Layout */}
          <div className="grid grid-cols-3 gap-6">
            
            {/* Insights */}
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl p-8">
              <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4">🔍 Key Insights</h3>
              <ul className="space-y-3">
                {analysis.insights.map((insight, i) => (
                  <li 
                    key={i}
                    className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                    onClick={() => setFocusedArea(focusedArea === insight ? null : insight)}
                  >
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-relaxed">{insight}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Patterns */}
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl p-8">
              <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4">📈 Patterns Detected</h3>
              <ul className="space-y-3">
                {analysis.patterns.map((pattern, i) => (
                  <li 
                    key={i}
                    className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                    onClick={() => setFocusedArea(focusedArea === pattern ? null : pattern)}
                  >
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-relaxed">{pattern}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Anomalies & Recommendations */}
            <div className="flex flex-col gap-4">
              {/* Anomalies */}
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl p-6">
                <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-3">⚠️ Anomalies</h3>
                <ul className="space-y-2">
                  {analysis.anomalies.map((anomaly, i) => (
                    <li key={i} className="text-xs text-rose-600 dark:text-rose-400 font-bold p-2 bg-rose-50/50 dark:bg-rose-950/20 rounded-lg">
                      {anomaly}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl p-6">
                <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-3">💡 Recommendations</h3>
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-emerald-600 dark:text-emerald-400 font-bold p-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !analysis && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50">
          <div className="text-6xl">🔍</div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Click "Analyze Dataset" to begin</p>
        </div>
      )}
    </div>
  );
};

export default ExploreViewIntegrated;
