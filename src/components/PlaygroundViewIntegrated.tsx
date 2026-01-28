import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import {
  Play, Save, Database, Table, BarChart2, MessageSquare,
  ChevronLeft, ChevronRight, X, Download, Terminal,
  Sparkles, History, MoreVertical, Layout, Trash2, Search
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, AreaChart, Area, Legend
} from 'recharts';

// --- Types ---
interface QueryResult {
  id: string;
  query_text: string;
  results: any[];
  execution_time: number;
  row_count: number;
  created_at: string;
}

interface SavedQuery {
  id: string;
  name: string;
  description: string;
  sql: string;
  type: 'sql' | 'natural';
  createdAt: string;
  executionTime?: number;
  rowCount?: number;
}

// --- Components ---

const PlaygroundViewIntegrated: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');
  const datasetId = searchParams.get('dataset');
  const queryId = searchParams.get('query');

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  // --- State ---

  // Layout
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'table' | 'chart' | 'messages'>('table');
  const [editorMode, setEditorMode] = useState<'ask' | 'sql' | 'script'>('ask');

  // Query & Data
  const [query, setQuery] = useState(''); // Natural language
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM data LIMIT 10');
  const [scriptCode, setScriptCode] = useState('// Transform your data using JS\n// Available: data (Array of Objects)\n\nreturn data.filter(row => row.price > 100);');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Metadata
  const [explanation, setExplanation] = useState<string | null>(null);
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState<number>(0);

  // Library
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: '', description: '' });

  // Dataset Context
  const [datasetData, setDatasetData] = useState<any[]>([]);

  // --- Effects ---

  useEffect(() => {
    if (workspaceId && datasetId && token && workspaceId !== 'null') {
      loadSavedQueries();
      loadDatasetPreview();
    }
  }, [workspaceId, datasetId, token]);

  useEffect(() => {
    if (workspaceId && queryId && token) {
      loadSpecificQuery();
    }
  }, [workspaceId, queryId, token]);

  // --- API Functions ---

  const loadSpecificQuery = async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/queries/${queryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const q = response.data;
      setEditorMode(q.query_type === 'natural' ? 'ask' : 'sql');
      if (q.query_type === 'natural') {
        setQuery(q.query_text);
      } else {
        setSqlQuery(q.query_text);
      }
    } catch (err) {
      console.error('Failed to load specific query:', err);
    }
  };

  const loadDatasetPreview = async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/preview`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDatasetData(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load dataset preview:', err);
    }
  };

  const loadSavedQueries = async () => {
    try {
      setLoadingSaved(true);
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/queries`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const queriesData = response.data.data || response.data || [];
      const mappedQueries = (Array.isArray(queriesData) ? queriesData : []).map((q: any) => ({
        id: q.id,
        name: q.name || "Untitled Query",
        description: q.description || "",
        sql: q.query_text || q.sql || "",
        type: q.query_type || q.type || "sql",
        rowCount: q.result_count !== undefined ? q.result_count : q.rowCount || 0,
        createdAt: q.created_at || q.createdAt || new Date().toISOString()
      }));
      setSavedQueries(mappedQueries);
    } catch (err) {
      console.error('Failed to load saved queries:', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  const executeQuery = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workspaceId || !datasetId) return setError('Workspace or dataset not selected');

    setLoading(true);
    setError(null);
    setResults([]);
    setExecutionTime(null);
    setExplanation(null);

    // Auto-switch to table view on new execution
    setActiveTab('table');

    try {
      const startTime = performance.now();
      let finalSql = sqlQuery;

      if (editorMode === 'script') {
        // Client-side JS Execution
        try {
          // Safety check: ensure we have data
          if (!datasetData || datasetData.length === 0) throw new Error("No data available to script against. Please wait for preview to load.");

          const userFunction = new Function('data', scriptCode);
          const result = userFunction(datasetData);

          if (!Array.isArray(result)) throw new Error("Script must return an Array of objects.");

          setResults(result);
          setExecutionTime(Math.round(performance.now() - startTime));
          setRowCount(result.length);
          setLoading(false);
          return; // Exit early, no backend call needed
        } catch (scriptErr: any) {
          throw new Error(`Script Execution Failed: ${scriptErr.message}`);
        }
      }

      if (editorMode === 'ask') {
        try {
          const aiRes = await axios.post(
            `${backendUrl}/generate-sql`,
            {
              dataset: {
                data: datasetData.slice(0, 5),
                columns: datasetData.length > 0 ? Object.keys(datasetData[0]) : []
              },
              query
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          finalSql = aiRes.data.sql;
          setGeneratedSql(aiRes.data.sql);
          setExplanation(aiRes.data.explanation);
        } catch (aiErr) {
          throw new Error(`Failed to generate SQL: ${aiErr instanceof Error ? aiErr.message : 'Unknown error'}`);
        }
      }

      const queryResponse = await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/query`,
        {
          query_text: finalSql || sqlQuery,
          type: editorMode === 'ask' ? 'natural' : 'sql'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const endTime = performance.now();
      setResults(queryResponse.data.results || []);
      setExecutionTime(Math.round(endTime - startTime));
      setRowCount(queryResponse.data.results?.length || 0);

      // If results are available and small enough, auto-switch to chart if numbers present? 
      // For now, keep as table.

    } catch (err: any) {
      const { getErrorMessage } = await import('../services/api');
      setError(getErrorMessage(err));
      setActiveTab('messages'); // Show error tab
    } finally {
      setLoading(false);
    }
  };

  const saveQuery = async () => {
    if (!saveForm.name || !workspaceId || !datasetId) return;

    try {
      const queryToSave = editorMode === 'ask' && generatedSql ? generatedSql : sqlQuery;
      const response = await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/queries`,
        {
          name: saveForm.name,
          description: saveForm.description,
          sql: queryToSave,
          type: editorMode === 'ask' ? 'natural' : 'sql',
          resultCount: results.length
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const savedQuery: SavedQuery = {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description,
        sql: response.data.sql,
        type: response.data.type,
        rowCount: response.data.rowCount,
        createdAt: response.data.createdAt,
      };
      setSavedQueries([...savedQueries, savedQuery]);
      setShowSaveModal(false);
      setSaveForm({ name: '', description: '' });
    } catch (err) {
      setError(`Failed to save query: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const loadQuery = (q: SavedQuery) => {
    setEditorMode(q.type === 'natural' ? 'ask' : 'sql');
    if (q.type === 'natural') {
      setQuery(q.sql);
    } else {
      setSqlQuery(q.sql);
    }
    setGeneratedSql(null);
    setExplanation(null);
  };

  const deleteQuery = async (queryId: string) => {
    try {
      await axios.delete(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/queries/${queryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedQueries(savedQueries.filter(q => q.id !== queryId));
    } catch (err) {
      setError(`Failed to delete query: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const exportCSV = () => {
    if (!results.length) return;
    const headers = Object.keys(results[0]);
    const csv = [
      headers.join(','),
      ...results.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${new Date().getTime()}.csv`;
    a.click();
  };

  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionForm, setVersionForm] = useState({ name: '', description: '' });

  const handleCommitVersion = async () => {
    if (!versionForm.name || !results.length) return;

    try {
      const payload = {
        versionName: versionForm.name,
        description: versionForm.description,
        data: results,
        headers: Object.keys(results[0]),
        tool: 'playground',
        script: editorMode === 'script' ? scriptCode : (editorMode === 'ask' ? generatedSql : sqlQuery)
      };

      await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/versions`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowVersionModal(false);
      setVersionForm({ name: '', description: '' });
      alert("Version committed successfully! 🚀");
    } catch (err: any) {
      alert(`Failed to commit version: ${err.message}`);
    }
  };

  // --- Render Helpers ---

  const renderChart = () => {
    if (!results.length) return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <BarChart2 className="w-12 h-12 mb-4 opacity-20" />
        <p>Run a query to see visualization</p>
      </div>
    );

    // Auto-detect numeric columns
    const numericKeys = Object.keys(results[0]).filter(k => typeof results[0][k] === 'number');
    const labelKey = Object.keys(results[0]).find(k => typeof results[0][k] === 'string') || Object.keys(results[0])[0];

    if (numericKeys.length === 0) return <div className="p-8 text-center text-slate-500">No numeric data to visualize</div>;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={results.slice(0, 50)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={labelKey} tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <Legend />
          {numericKeys.slice(0, 3).map((key, i) => (
            <Bar key={key} dataKey={key} fill={['#6366f1', '#8b5cf6', '#ec4899'][i % 3]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">

      {/* --- Sidebar: Query Library --- */}
      <div className={`
          flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out z-20 flex flex-col
          ${isSidebarOpen ? 'w-72' : 'w-0 opacity-0 overflow-hidden'}
        `}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
            <History className="w-5 h-5" />
            <span className="truncate">Query Library</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 rounded hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              placeholder="Search queries..."
              className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          {loadingSaved ? (
            <div className="text-center py-8 text-slate-400 text-xs">Loading...</div>
          ) : savedQueries.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No saved queries found.</div>
          ) : (
            savedQueries.map(q => (
              <div key={q.id}
                onClick={() => loadQuery(q)}
                className="group p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/10 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30 cursor-pointer transition-all relative"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${q.type === 'natural' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                    {q.type === 'natural' ? 'AI' : 'SQL'}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteQuery(q.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{q.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{q.description || "No description"}</p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{q.rowCount ? `${q.rowCount} rows` : '0 rows'}</span>
                  <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>


      {/* --- Main Content --- */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-slate-50 dark:bg-slate-950 relative">

        {/* Toggle Sidebar Button (when closed) */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-30 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-lg text-slate-500 hover:text-indigo-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* --- Top Half: Editor Area --- */}
        <div className="h-[45%] flex flex-col border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative z-10">

          {/* Toolbar */}
          <div className="h-14 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-1 px-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${!isSidebarOpen ? 'ml-10' : ''}`}>
                <button
                  onClick={() => setEditorMode('ask')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${editorMode === 'ask' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Natural Language</span>
                </button>
                <button
                  onClick={() => setEditorMode('sql')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${editorMode === 'sql' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>SQL Editor</span>
                </button>
                <button
                  onClick={() => setEditorMode('script')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${editorMode === 'script' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <div className="font-mono text-[10px] font-black">{'{}'}</div>
                  <span>JS Script</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSaveModal(true)}
                disabled={!results.length}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Save Query</span>
              </button>
              <button
                onClick={executeQuery}
                disabled={loading || (editorMode === 'ask' && !query) || (editorMode === 'sql' && !sqlQuery) || (editorMode === 'script' && !scriptCode)}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
              >
                {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" /> : <Play className="w-4 h-4 fill-current" />}
                <span>Run Analysis</span>
              </button>
            </div>
          </div>

          {/* Editor Input */}
          <div className="flex-1 relative overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
            {editorMode === 'ask' ? (
              <div className="absolute inset-0 p-6">
                <div className="relative h-full">
                  <div className="absolute left-4 top-4 text-slate-400 pointer-events-none">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask anything about your data, e.g., 'Show me top products by revenue last month'..."
                    className="w-full h-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all shadow-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        executeQuery();
                      }
                    }}
                  />
                  <div className="absolute right-4 bottom-4 text-[10px] text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                    Press Enter to Run
                  </div>
                </div>
              </div>
            ) : editorMode === 'sql' ? (
              <div className="absolute inset-0 p-4">
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full h-full p-6 font-mono text-sm bg-slate-900 text-indigo-100 rounded-xl leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-slate-700 shadow-inner"
                  spellCheck="false"
                  placeholder="SELECT * FROM data..."
                />
              </div>
            ) : (
              <div className="absolute inset-0 p-4">
                <div className="absolute top-4 right-6 z-10 text-[10px] text-indigo-300 font-mono bg-indigo-900/40 px-2 py-1 rounded border border-indigo-500/30">
                  Available global: <code>data</code> (Array)
                </div>
                <textarea
                  value={scriptCode}
                  onChange={(e) => setScriptCode(e.target.value)}
                  className="w-full h-full p-6 font-mono text-sm bg-slate-950 text-emerald-300 rounded-xl leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-slate-800 shadow-inner"
                  spellCheck="false"
                  placeholder="// Write JavaScript transformation..."
                />
              </div>
            )}
          </div>
        </div>


        {/* --- Bottom Half: Results Area --- */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">

          {/* Result Tabs */}
          <div className="flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('table')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'table' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Table className="w-4 h-4" />
                Results ({rowCount})
              </button>
              <button
                onClick={() => setActiveTab('chart')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'chart' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <BarChart2 className="w-4 h-4" />
                Visualization
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'messages' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <MessageSquare className="w-4 h-4" />
                Execution Details
              </button>
            </div>

            <div className="flex items-center gap-2">
              {results.length > 0 && activeTab === 'table' && (
                <>
                  <button
                    onClick={() => setShowVersionModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                  >
                    <span>💾</span> Commit Version
                  </button>
                  <button onClick={exportCSV} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Export CSV">
                    <Download className="w-4 h-4" />
                  </button>
                </>
              )}
              <div className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                {executionTime ? `${executionTime}ms` : '0ms'}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'table' && (
              <div className="absolute inset-0 overflow-auto">
                {results.length > 0 ? (
                  <table className="w-full text-left text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50 dark:bg-slate-800 shadow-sm">
                        {Object.keys(results[0]).map((h, i) => (
                          <th key={i} className="px-6 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 whitespace-nowrap bg-slate-50 dark:bg-slate-800">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {results.map((row, i) => (
                        <tr key={i} className="hover:bg-indigo-50/10 dark:hover:bg-indigo-900/10 transition-colors">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="px-6 py-3 text-slate-600 dark:text-slate-300 border-b border-slate-50 dark:border-slate-800/50 truncate max-w-[200px]">
                              {String(val ?? '-')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Database className="w-16 h-16 mb-4 opacity-10" />
                    <p className="font-medium">No results to display</p>
                    <p className="text-sm opacity-60 mt-1">Execute a query above to see data</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'chart' && (
              <div className="absolute inset-0 p-6">
                {renderChart()}
              </div>
            )}

            {activeTab === 'messages' && (
              <div className="absolute inset-0 overflow-auto p-6 space-y-6">
                {error ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    <strong className="block mb-1 font-bold flex items-center gap-2"><X className="w-4 h-4" /> Error Executing Query</strong>
                    <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
                  </div>
                ) : !generatedSql && !explanation ? (
                  <div className="text-center text-slate-400 py-10">No messages or execution logs.</div>
                ) : null}

                {explanation && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <h4 className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold mb-2 text-sm">
                      <Sparkles className="w-4 h-4" /> AI Explanation
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{explanation}</p>
                  </div>
                )}

                {generatedSql && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Generated SQL</h4>
                    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 overflow-x-auto">
                      <code className="text-indigo-300 font-mono text-xs">{generatedSql}</code>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- Commit Version Modal --- */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Commit Dataset Version</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Version Name</label>
                <input
                  value={versionForm.name}
                  onChange={(e) => setVersionForm({ ...versionForm, name: e.target.value })}
                  placeholder="e.g. Q3 Filtered Data"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Description</label>
                <textarea
                  value={versionForm.description}
                  onChange={(e) => setVersionForm({ ...versionForm, description: e.target.value })}
                  placeholder="Describe changes..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none h-24"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowVersionModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitVersion}
                disabled={!versionForm.name}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                Commit Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Save Modal --- */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Save Query</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Query Name</label>
                <input
                  value={saveForm.name}
                  onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })}
                  placeholder="e.g. Monthly Revenue Analysis"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Description (Optional)</label>
                <textarea
                  value={saveForm.description}
                  onChange={(e) => setSaveForm({ ...saveForm, description: e.target.value })}
                  placeholder="What does this query do?"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none h-24"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveQuery}
                disabled={!saveForm.name}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                Save to Library
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PlaygroundViewIntegrated;

