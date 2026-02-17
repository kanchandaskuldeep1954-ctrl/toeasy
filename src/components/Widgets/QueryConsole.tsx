import React, { useState, useEffect } from 'react';
import { queryAPI, aiAPI } from '../../services/api';
import { DataGridWidget } from './DataGridWidget';

export interface QueryConsoleProps {
    workspaceId: string;
    datasetId: string;
    initialQuery?: string;
    height?: number | string;
    onResults?: (results: any[]) => void;
    onQueryChange?: (query: string) => void;
}

export const QueryConsole: React.FC<QueryConsoleProps> = ({
    workspaceId,
    datasetId,
    initialQuery = '',
    height = 400,
    onResults,
    onQueryChange
}) => {
    const [query, setQuery] = useState(initialQuery);
    const [mode, setMode] = useState<'sql' | 'nl'>('sql');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any[]>([]);
    const [executedSQL, setExecutedSQL] = useState<string | null>(null);

    const handleQueryChange = (val: string) => {
        setQuery(val);
        if (onQueryChange) onQueryChange(val);
    };

    const handleExecute = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setResults([]);

        try {
            let sqlToRun = query;

            if (mode === 'nl') {
                const res = await aiAPI.askQuestion(workspaceId, datasetId, query);
                if (res.data?.sql) {
                    setExecutedSQL(res.data.sql);
                    if (res.data.results) {
                        setResults(res.data.results);
                        if (onResults) onResults(res.data.results);
                    }
                } else if (res.data?.answer) {
                    setResults([{ Answer: res.data.answer }]);
                }
            } else {
                const res = await queryAPI.execute(workspaceId, datasetId, query);
                setResults(res.data.results || []);
                setExecutedSQL(query);
                if (onResults) onResults(res.data.results || []);
            }
        } catch (err: any) {
            console.error("Query execution failed", err);
            setError(err.response?.data?.message || err.message || 'Query failed');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleExecute();
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col shadow-sm overflow-hidden" style={{ height }}>
            {/* Toolbar */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div className="flex gap-2">
                    <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-0.5">
                        <button
                            onClick={() => setMode('sql')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === 'sql'
                                ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            SQL
                        </button>
                        <button
                            onClick={() => setMode('nl')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === 'nl'
                                ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            Ask AI
                        </button>
                    </div>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500">
                    Ctrl + Enter to run
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col min-h-0">
                <textarea
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={mode === 'sql' ? "SELECT * FROM dataset WHERE..." : "Ask a question about your data..."}
                    className="flex-1 w-full p-4 font-mono text-sm resize-none focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600"
                    style={{ minHeight: '100px', maxHeight: results.length ? '150px' : '100%' }}
                />

                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                    {error ? (
                        <span className="text-sm text-red-600 dark:text-red-400 truncate mr-2">{error}</span>
                    ) : (
                        <span className="text-sm text-slate-500 dark:text-slate-400 truncate mr-2">
                            {executedSQL && mode === 'nl' ? `Generated SQL: ${executedSQL}` : ''}
                        </span>
                    )}
                    <button
                        onClick={handleExecute}
                        disabled={loading || !query.trim()}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors ${loading ? 'bg-slate-400 dark:bg-slate-600' : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'}`}
                    >
                        {loading ? 'Running...' : 'Run Query'}
                    </button>
                </div>

                {/* Results Area */}
                {results.length > 0 && (
                    <div className="flex-1 border-t border-slate-200 dark:border-slate-700 min-h-0 overflow-hidden">
                        <DataGridWidget
                            data={results}
                            height="100%"
                            title={`Results (${results.length} rows)`}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
