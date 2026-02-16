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

    // Sync if initialQuery updates? Maybe not needed if we treat it as just initial.
    // But if we want to support external updates later, we could add useEffect.

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
                // Convert NL to SQL first (mocking this flow if AI API not ready for direct output, 
                // usually queryAPI might handle NL directly or we call AI first)
                // Check api.ts: aiAPI.askQuestion returns answer, maybe need a specific generateSQL endpoint
                // For now, let's assume aiAPI.askQuestion might return data or we use a specialized endpoint if available.
                // Let's use `aiAPI.askQuestion` but expect it might be just text answer in current backend. 
                // Ideally we want GROQ to return SQL. 
                // Fallback: Just assume standard SQL execution for now to be safe, or implement NL-to-SQL logic later.
                // Actually, let's treat NL as "Ask AI" which returns text/data.

                const res = await aiAPI.askQuestion(workspaceId, datasetId, query);
                // Assuming response structure, adjust as needed based on actual API return
                if (res.data?.sql) {
                    setExecutedSQL(res.data.sql);
                    // If the API executes it too:
                    if (res.data.results) {
                        setResults(res.data.results);
                        if (onResults) onResults(res.data.results);
                    }
                } else if (res.data?.answer) {
                    // It's a text answer
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
        <div className="bg-white border border-gray-200 rounded-lg flex flex-col shadow-sm" style={{ height }}>
            {/* Toolbar */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <div className="flex gap-2">
                    <div className="flex bg-gray-200 rounded p-0.5">
                        <button
                            onClick={() => setMode('sql')}
                            className={`px-3 py-1 rounded text-xs font-medium ${mode === 'sql' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            SQL
                        </button>
                        <button
                            onClick={() => setMode('nl')}
                            className={`px-3 py-1 rounded text-xs font-medium ${mode === 'nl' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Ask AI
                        </button>
                    </div>
                </div>
                <div className="text-xs text-gray-400">
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
                    className="flex-1 w-full p-4 font-mono text-sm resize-none focus:outline-none"
                    style={{ minHeight: '100px', maxHeight: results.length ? '150px' : '100%' }}
                />

                <div className="px-4 py-2 border-t border-gray-100 flex justify-between items-center bg-white">
                    {error ? (
                        <span className="text-sm text-red-600 truncate mr-2">{error}</span>
                    ) : (
                        <span className="text-sm text-gray-500 truncate mr-2">
                            {executedSQL && mode === 'nl' ? `Generated SQL: ${executedSQL}` : ''}
                        </span>
                    )}
                    <button
                        onClick={handleExecute}
                        disabled={loading || !query.trim()}
                        className={`px-4 py-1.5 rounded text-sm font-semibold text-white transition-colors ${loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        {loading ? 'Running...' : 'Run Query'}
                    </button>
                </div>

                {/* Results Area */}
                {results.length > 0 && (
                    <div className="flex-1 border-t border-gray-200 min-h-0 overflow-hidden">
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
