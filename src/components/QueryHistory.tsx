import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Query {
  id: string;
  dataset_id: string;
  user_id: string;
  sql: string;
  result_preview: any;
  created_at: string;
  updated_at: string;
  title?: string;
}

export const QueryHistory: React.FC = () => {
  const { user, token } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace') || activeWorkspace?.id?.toString() || '';

  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (workspaceId && token && workspaceId !== 'null') {
      fetchQueries();
    } else if ((!workspaceId || workspaceId === 'null') && token) {
      setLoading(false); // No workspace selected, not an error but nothing to show
    }
  }, [token, workspaceId]);


  const fetchQueries = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/queries`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQueries(response.data.data || response.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch queries');
      console.error('Error fetching queries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuery = async (id: string) => {
    if (!window.confirm('Delete this query history?')) return;

    try {
      await axios.delete(
        `${backendUrl}/workspaces/${workspaceId}/queries/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQueries(queries.filter(q => q.id !== id));
      setSelectedQuery(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete query');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-slate-400">Loading query history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Query History</h1>
          <p className="text-slate-400">View and manage your saved queries</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queries List */}
          <div className="lg:col-span-2">
            {queries.length === 0 ? (
              <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-slate-400 mb-4">No query history yet</p>
                <button
                  onClick={() => navigate('/app/playground')}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Run Your First Query
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {queries.map((query) => (
                  <div
                    key={query.id}
                    onClick={() => setSelectedQuery(query)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedQuery?.id === query.id
                      ? 'bg-indigo-600/20 border-indigo-500'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold">
                          {(query as any).name || query.title || 'Untitled Query'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(query.updated_at || query.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteQuery(query.id);
                        }}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm text-slate-400 truncate font-mono bg-slate-800 px-3 py-2 rounded">
                      {(query as any).query_text || query.sql}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Query Details */}
          {selectedQuery && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-white mb-4">Query Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 uppercase">SQL</label>
                    <pre className="mt-2 p-3 bg-slate-800 rounded text-sm text-slate-300 overflow-auto max-h-32">
                      {(selectedQuery as any).query_text || selectedQuery.sql}
                    </pre>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase">Last Executed</label>
                    <p className="mt-1 text-white">
                      {new Date(selectedQuery.updated_at || selectedQuery.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Result Preview */}
              {selectedQuery.result_preview && (
                <div className="border-t border-slate-800 pt-6">
                  <h3 className="text-sm font-semibold text-white mb-3">Result Preview</h3>
                  <div className="bg-slate-800 rounded p-3 max-h-48 overflow-auto">
                    <pre className="text-xs text-slate-300">
                      {JSON.stringify(selectedQuery.result_preview, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 pt-6 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => navigate(`/app/playground?query=${selectedQuery.id}`)}
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors text-sm"
                >
                  Edit & Run
                </button>
                <button
                  onClick={() => handleDeleteQuery(selectedQuery.id)}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
