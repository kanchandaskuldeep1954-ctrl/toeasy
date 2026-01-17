import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import { MarkdownContent } from '../utils/markdownRenderer';

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
        <div className="space-y-8">
          
          {/* Animated Header */}
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-indigo-600 to-indigo-400 rounded-full"></div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">Analysis Results</h2>
            </div>
          </div>

          {/* Premium Summary Card */}
          <div className="group relative overflow-hidden rounded-[32px] shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-900 opacity-100"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10"></div>
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-400/20 rounded-full blur-3xl"></div>
            
            <div className="relative p-12 text-white">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="inline-block px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-100">📋 Executive Summary</p>
                  </div>
                  <h3 className="text-2xl font-black leading-tight tracking-tighter mb-4">Dataset Analysis</h3>
                </div>
                <div className="text-5xl opacity-20">📊</div>
              </div>
              <div className="text-sm leading-relaxed font-medium text-indigo-50 prose prose-invert max-w-none">
                <MarkdownContent content={analysis.summary} className="text-indigo-50" />
              </div>
            </div>
          </div>

          {/* Data Quality Metrics - Enhanced */}
          {analysis.dataQuality && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
              <div className="p-8 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📈</span>
                  <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Data Quality Metrics</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mt-2">Overall Health Assessment</p>
              </div>
              
              <div className="p-8">
                <div className="grid grid-cols-4 gap-4">
                  {Object.entries(analysis.dataQuality).map(([key, value]) => {
                    const colors: any = {
                      completeness: 'from-blue-600 to-blue-400',
                      consistency: 'from-purple-600 to-purple-400',
                      accuracy: 'from-amber-600 to-amber-400',
                      validity: 'from-emerald-600 to-emerald-400'
                    };
                    const icons: any = {
                      completeness: '✓',
                      consistency: '≡',
                      accuracy: '◯',
                      validity: '✔'
                    };
                    
                    return (
                      <div 
                        key={key} 
                        className="group relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${colors[key]} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
                        <div className="relative">
                          <div className="flex items-start justify-between mb-4">
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[key]} flex items-center justify-center text-white text-lg font-black`}>
                              {icons[key]}
                            </div>
                            <span className={`text-xs font-black bg-gradient-to-br ${colors[key]} bg-clip-text text-transparent`}>
                              {Math.round(value)}%
                            </span>
                          </div>
                          <div className="space-y-3">
                            <p className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1')}</p>
                            <div className="h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded-full overflow-hidden backdrop-blur-sm">
                              <div 
                                className={`h-full bg-gradient-to-r ${colors[key]} rounded-full transition-all duration-500 shadow-lg`}
                                style={{ width: `${value}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Three Column Enhanced Layout */}
          <div className="grid grid-cols-3 gap-6">
            
            {/* Insights - Enhanced with Markdown */}
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden hover:shadow-2xl transition-all">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔍</span>
                  <div>
                    <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Key Insights</h3>
                    <p className="text-[8px] text-slate-600 dark:text-slate-400 font-bold mt-1">Dataset Intelligence</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {analysis.insights.map((insight, i) => (
                  <div
                    key={i}
                    className="group p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-600 cursor-pointer transition-all hover:shadow-md"
                    onClick={() => setFocusedArea(focusedArea === insight ? null : insight)}
                  >
                    <div className="flex gap-3 items-start">
                      <span className="text-lg leading-none mt-0.5">💡</span>
                      <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
                        <MarkdownContent content={insight} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Patterns - Enhanced with Markdown */}
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden hover:shadow-2xl transition-all">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-b border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📊</span>
                  <div>
                    <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Patterns Detected</h3>
                    <p className="text-[8px] text-slate-600 dark:text-slate-400 font-bold mt-1">Data Trends & Relationships</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {analysis.patterns.map((pattern, i) => (
                  <div
                    key={i}
                    className="group p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer transition-all hover:shadow-md"
                    onClick={() => setFocusedArea(focusedArea === pattern ? null : pattern)}
                  >
                    <div className="flex gap-3 items-start">
                      <span className="text-lg leading-none mt-0.5">📈</span>
                      <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
                        <MarkdownContent content={pattern} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Anomalies & Recommendations Stack */}
            <div className="flex flex-col gap-6">
              {/* Anomalies */}
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden hover:shadow-2xl transition-all">
                <div className="bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30 border-b border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Anomalies</h3>
                      <p className="text-[8px] text-slate-600 dark:text-slate-400 font-bold mt-1">Issues Found</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {analysis.anomalies.map((anomaly, i) => (
                    <div 
                      key={i} 
                      className="flex gap-2 items-start p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                    >
                      <span className="text-sm leading-none mt-0.5">●</span>
                      <div className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed flex-1">
                        <MarkdownContent content={anomaly} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden hover:shadow-2xl transition-all">
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-b border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Recommendations</h3>
                      <p className="text-[8px] text-slate-600 dark:text-slate-400 font-bold mt-1">Next Steps</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {analysis.recommendations.map((rec, i) => (
                    <div 
                      key={i} 
                      className="flex gap-2 items-start p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                    >
                      <span className="text-sm leading-none mt-0.5">✓</span>
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed flex-1">
                        <MarkdownContent content={rec} />
                      </div>
                    </div>
                  ))}
                </div>
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
