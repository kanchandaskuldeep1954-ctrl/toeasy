import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import { GroqService } from '../services/groqService';
import { executeSql } from '../services/sqlExecutor';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, AreaChart, Area
} from 'recharts';

interface QueryResult {
  id: string;
  query_text: string;
  results: any[];
  execution_time: number;
  row_count: number;
  created_at: string;
  updated_at: string;
}

interface SavedQuery {
  id: string;
  name: string;
  description: string;
  sql: string;
  createdAt: string;
  executionTime?: number;
  rowCount?: number;
}

const PlaygroundViewIntegrated: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');
  const datasetId = searchParams.get('dataset');

  const [mode, setMode] = useState<'ask' | 'sql'>('ask');
  const [query, setQuery] = useState('');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM data LIMIT 10');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState<number>(0);

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: '', description: '' });

  const [datasetData, setDatasetData] = useState<any[]>([]);
  const [loadingDataset, setLoadingDataset] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  const queryId = searchParams.get('query');

  // Load saved queries on mount
  useEffect(() => {
    if (workspaceId && datasetId && token && workspaceId !== 'null' && datasetId !== 'null') {
      loadSavedQueries();
      loadDatasetPreview();
    }
  }, [workspaceId, datasetId, token]);

  useEffect(() => {
    if (workspaceId && queryId && token && workspaceId !== 'null') {
      loadSpecificQuery();
    }
  }, [workspaceId, queryId, token]);

  const loadSpecificQuery = async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/queries/${queryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const q = response.data;
      setMode(q.query_type === 'natural' ? 'ask' : 'sql');
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
      setLoadingDataset(true);
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/preview`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDatasetData(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load dataset preview:', err);
    } finally {
      setLoadingDataset(false);
    }
  };

  const loadSavedQueries = async () => {
    try {
      setLoadingSaved(true);
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/queries`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Backend returns { data: Query[], total: number } or similar
      const queriesData = response.data.data || response.data || [];
      const mappedQueries = (Array.isArray(queriesData) ? queriesData : []).map((q: any) => ({
        id: q.id,
        name: q.name || "Untitled Query",
        description: q.description || "",
        sql: q.query_text || q.sql || "",
        rowCount: q.result_count || 0,
        createdAt: q.created_at || new Date().toISOString()
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

    if (!workspaceId || !datasetId) {
      setError('Workspace or dataset not selected');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setExecutionTime(null);
    setExplanation(null);
    setGeneratedSql(null);

    try {
      const startTime = performance.now();
      let finalSql = sqlQuery;
      let explanation_ = '';

      if (mode === 'ask') {
        // Generate SQL from natural language using backend with actual dataset
        try {
          const aiRes = await axios.post(
            `${backendUrl}/generate-sql`,
            {
              dataset: {
                data: datasetData.slice(0, 5), // Send first 5 rows as sample
                columns: datasetData.length > 0 ? Object.keys(datasetData[0]) : []
              },
              query
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          finalSql = aiRes.data.sql;
          explanation_ = aiRes.data.explanation || '';
          setGeneratedSql(aiRes.data.sql);
          setExplanation(aiRes.data.explanation);
        } catch (aiErr) {
          throw new Error(`Failed to generate SQL: ${aiErr instanceof Error ? aiErr.message : 'Unknown error'}`);
        }
      }

      // Execute query on backend
      const queryResponse = await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/query`,
        {
          query_text: finalSql || sqlQuery,
          type: mode === 'ask' ? 'natural' : 'sql'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const endTime = performance.now();
      const time = Math.round(endTime - startTime);

      setResults(queryResponse.data.results || []);
      setExecutionTime(time);
      setRowCount(queryResponse.data.results?.length || 0);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query execution failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const saveQuery = async () => {
    if (!saveForm.name || !workspaceId || !datasetId) return;

    try {
      const queryToSave = mode === 'ask' && generatedSql ? generatedSql : sqlQuery;

      const response = await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/queries`,
        {
          name: saveForm.name,
          description: saveForm.description,
          sql: queryToSave,
          type: mode === 'ask' ? 'natural' : 'sql',
          resultCount: results.length
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const savedQuery: SavedQuery = {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description,
        sql: response.data.sql,
        rowCount: response.data.result_count,
        createdAt: response.data.created_at,
      };
      setSavedQueries([...savedQueries, savedQuery]);

      setShowSaveModal(false);
      setSaveForm({ name: '', description: '' });
    } catch (err) {
      setError(`Failed to save query: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const loadQuery = (q: SavedQuery) => {
    setMode('sql');
    setSqlQuery(q.sql);
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

  return (
    <div className="max-w-[1600px] mx-auto h-full flex gap-6 p-4">

      {/* Sidebar: Query Library */}
      <div className="w-80 flex flex-col gap-6 shrink-0">
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl p-6 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Query Library</h3>
              <p className="text-[10px] text-slate-500 font-medium">{savedQueries.length} Saved</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 -mr-2 pr-2">
            {loadingSaved ? (
              <div className="text-center py-10 opacity-50">
                <p className="text-[10px] text-slate-400">Loading...</p>
              </div>
            ) : savedQueries && Array.isArray(savedQueries) && savedQueries.length === 0 ? (
              <div className="text-center py-10 opacity-50">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No Saved Queries</p>
              </div>
            ) : (
              savedQueries && Array.isArray(savedQueries) && savedQueries.map(q => (
                <div key={q.id} className="group p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer relative" onClick={() => loadQuery(q)}>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{q.name}</h4>
                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{q.description || "No description"}</p>
                  {q.executionTime && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
                      <span className="text-[9px] text-slate-400">{q.executionTime}ms</span>
                      <span className="text-[9px] text-slate-400">{q.rowCount} rows</span>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteQuery(q.id); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-rose-400 hover:text-rose-600"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        {/* Header & Modes */}
        <div className="flex justify-between items-end gap-6 shrink-0">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">SQL Playground</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Execute queries against your dataset.</p>
          </div>
          <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
            <button onClick={() => setMode('ask')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'ask' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Natural Language</button>
            <button onClick={() => setMode('sql')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'sql' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>SQL Editor</button>
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-2xl p-8">
          <form onSubmit={executeQuery} className="flex flex-col gap-6">
            {mode === 'ask' ? (
              <div className="relative">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                  <span className="text-2xl">🤖</span>
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask: 'Show me top 10 products by sales...'"
                  className="w-full pl-16 pr-4 py-6 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 dark:focus:border-indigo-500/20 rounded-[30px] text-lg font-bold focus:ring-[15px] focus:ring-indigo-500/5 transition-all outline-none text-slate-900 dark:text-white"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full h-40 p-8 font-mono text-xs bg-slate-950 text-indigo-400 rounded-[30px] focus:outline-none border border-white/5 shadow-2xl leading-relaxed resize-none"
                  spellCheck={false}
                />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Write SQL to query your dataset</p>
              </div>
            )}

            {error && (
              <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-[30px]">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                disabled={results.length === 0}
                className="px-8 py-4 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-full font-black text-[10px] uppercase tracking-[0.3em] disabled:opacity-50 transition-all"
              >
                Save Query
              </button>
              <button
                type="submit"
                disabled={loading || !(query?.trim()) && !(sqlQuery?.trim())}
                className="px-12 py-4 bg-indigo-600 text-white rounded-full font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Executing...' : 'Execute'}
              </button>
            </div>
          </form>
        </div>

        {/* Results Area */}
        <div className="flex-1 min-h-[400px] bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Results</h3>
              <p className="text-[9px] text-slate-500 mt-1">{rowCount} rows • {executionTime}ms</p>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {results && Array.isArray(results) && results.length > 0 ? (
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 shadow-sm z-20">
                  <tr>
                    {results[0] && Object.keys(results[0]).map(h => (
                      <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {results && Array.isArray(results) && results.map((row, i) => (
                    <tr key={i} className="hover:bg-indigo-50/20 transition-colors">
                      {row && Object.values(row).map((val: any, j) => (
                        <td key={j} className="px-6 py-4 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{String(val ?? '-')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10 opacity-30">
                <div className="text-6xl mb-6">📊</div>
                <p className="text-[10px] font-black uppercase tracking-widest">No results yet. Execute a query to begin.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-6">Save Query</h3>
            <div className="space-y-4">
              <input
                value={saveForm.name}
                onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })}
                placeholder="Query name..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                autoFocus
              />
              <textarea
                value={saveForm.description}
                onChange={(e) => setSaveForm({ ...saveForm, description: e.target.value })}
                placeholder="Description..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none h-24"
              />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setShowSaveModal(false)} className="px-6 py-3 rounded-xl text-xs font-bold uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={saveQuery} disabled={!saveForm.name} className="px-6 py-3 rounded-xl text-xs font-bold uppercase bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaygroundViewIntegrated;
