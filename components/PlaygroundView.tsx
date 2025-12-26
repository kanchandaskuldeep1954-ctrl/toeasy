
import React, { useState } from 'react';
import { Dataset, DataRow, ChartSpec } from '../types';
import { GeminiService } from '../services/geminiService';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer, 
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, AreaChart, Area
} from 'recharts';

interface PlaygroundViewProps {
  dataset: Dataset;
  onAIAction?: () => void;
}

const PlaygroundView: React.FC<PlaygroundViewProps> = ({ dataset, onAIAction }) => {
  const [mode, setMode] = useState<'ask' | 'sql'>('ask');
  const [query, setQuery] = useState('');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM data LIMIT 10');
  const [results, setResults] = useState<DataRow[]>([]);
  const [chartConfig, setChartConfig] = useState<ChartSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setChartConfig(null);

    try {
      if (onAIAction) onAIAction();
      let data: DataRow[] = [];
      
      if (mode === 'ask') {
        data = await GeminiService.executeNaturalLanguageQuery(dataset, query);
      } else {
        data = await GeminiService.executeRawSQL(dataset, sqlQuery);
      }
      
      setResults(data);

      if (data.length > 0 && data.length <= 50) {
        const suggestion = await GeminiService.suggestChartForResults(data);
        if (suggestion) setChartConfig(suggestion);
      }

    } catch (err) {
      setError("Execution failed. Please refine your query.");
    } finally {
      setLoading(false);
    }
  };

  const renderChart = () => {
    if (!chartConfig || results.length === 0) return null;
    const color = '#6366f1';
    
    switch (chartConfig.type) {
        case 'bar': return (
            <BarChart data={results} margin={{top:10, right:10, bottom:0, left:-20}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey={chartConfig.xAxis} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey={chartConfig.yAxis} fill={color} radius={[4,4,0,0]} />
            </BarChart>
        );
        case 'line': return (
            <LineChart data={results} margin={{top:10, right:10, bottom:0, left:-20}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey={chartConfig.xAxis} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey={chartConfig.yAxis} stroke={color} strokeWidth={3} dot={{r:3}} />
            </LineChart>
        );
        case 'pie': return (
            <PieChart>
                <Pie data={results} dataKey={chartConfig.yAxis} nameKey={chartConfig.xAxis} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill={color}>
                     {results.map((_, idx) => <Cell key={idx} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444'][idx % 4]} />)}
                </Pie>
                <Tooltip />
            </PieChart>
        );
        default: return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
         <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Data Playground</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Query your data using plain English or SQL.</p>
         </div>
         <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button onClick={() => setMode('ask')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === 'ask' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Natural Language</button>
            <button onClick={() => setMode('sql')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === 'sql' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>SQL Editor</button>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
         <form onSubmit={execute} className="flex flex-col gap-4">
            {mode === 'ask' ? (
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    </div>
                    <input 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g., Show me top 5 regions by total revenue"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                </div>
            ) : (
                <textarea 
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    className="w-full h-32 p-4 font-mono text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
            )}
            
            <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium">Table name: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-500">data</code></span>
                <button 
                    type="submit"
                    disabled={loading || (mode === 'ask' ? !query : !sqlQuery)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
                >
                    {loading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    Run Query
                </button>
            </div>
         </form>
      </div>

      <div className="flex-1 min-h-[400px] flex flex-col lg:flex-row gap-6">
         {/* Results Table */}
         <div className={`flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col ${chartConfig ? 'lg:w-1/2' : 'w-full'}`}>
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Results ({results.length})</h3>
                <button className="text-indigo-600 text-xs font-bold uppercase hover:underline">Download CSV</button>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
                {results.length > 0 ? (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                            <tr>
                                {Object.keys(results[0]).map(h => (
                                    <th key={h} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {results.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    {Object.values(row).map((val: any, j) => (
                                        <td key={j} className="px-6 py-3 text-slate-600 dark:text-slate-400">{String(val)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10">
                        <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                        <p className="text-sm">No results to display</p>
                    </div>
                )}
            </div>
         </div>

         {/* Auto Chart */}
         {chartConfig && (
            <div className="lg:w-1/2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-6">Visual Preview</h3>
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        {renderChart() || <div />}
                    </ResponsiveContainer>
                </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default PlaygroundView;
