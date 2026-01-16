
import React, { useState } from 'react';
import { Dataset, DataRow, ChartSpec, SavedQuery } from '../types';
import { GroqService } from '../services/groqService';
import { executeSql } from '../services/sqlExecutor';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer, 
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, AreaChart, Area
} from 'recharts';

interface PlaygroundViewProps {
  dataset: Dataset;
  onAIAction?: () => void;
  onUpdate?: (updated: Dataset) => void;
}

const PlaygroundView: React.FC<PlaygroundViewProps> = ({ dataset, onAIAction, onUpdate }) => {
  const [mode, setMode] = useState<'ask' | 'sql'>('ask');
  const [query, setQuery] = useState('');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM ? LIMIT 10');
  const [results, setResults] = useState<DataRow[]>([]);
  const [chartConfig, setChartConfig] = useState<ChartSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [generatedSql, setGeneratedSql] = useState<string | null>(null); // To show transparency

  // Save Query Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: '', description: '' });

  const execute = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setChartConfig(null);
    setExplanation(null);
    setGeneratedSql(null);

    try {
      if (onAIAction) onAIAction();
      let data: DataRow[] = [];
      let finalSql = sqlQuery;
      
      if (mode === 'ask') {
        const aiRes = await GroqService.generateSQLFromNL(dataset, query);
        finalSql = aiRes.sql;
        setGeneratedSql(aiRes.sql); // Show the user what was generated
        setExplanation(aiRes.explanation);
        
        // Execute the generated SQL
        try {
            data = executeSql(aiRes.sql, dataset.data);
        } catch (sqlErr) {
            throw new Error(`Generated SQL Error: ${sqlErr instanceof Error ? sqlErr.message : String(sqlErr)}`);
        }
      } else {
        try {
            data = executeSql(sqlQuery, dataset.data);
        } catch (sqlErr) {
             throw new Error(`SQL Syntax Error: ${sqlErr instanceof Error ? sqlErr.message : String(sqlErr)}`);
        }
      }
      
      setResults(data);
      // Note: Chart suggestion removed to reduce API calls on free tier

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Execution failed. Please check your query syntax.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuery = () => {
      if (!saveForm.name) return;
      const queryToSave = mode === 'ask' && generatedSql ? generatedSql : sqlQuery;
      
      const newQuery: SavedQuery = {
          id: Math.random().toString(36).substr(2, 9),
          name: saveForm.name,
          description: saveForm.description,
          sql: queryToSave,
          createdAt: new Date()
      };

      const updatedQueries = [...(dataset.savedQueries || []), newQuery];
      if (onUpdate) onUpdate({ ...dataset, savedQueries: updatedQueries });
      
      setShowSaveModal(false);
      setSaveForm({ name: '', description: '' });
  };

  const handleLoadQuery = (q: SavedQuery) => {
      setMode('sql');
      setSqlQuery(q.sql);
      setGeneratedSql(null); // Clear previous generated context
      setExplanation(null);
      // Optional: Auto-run on load? Let's leave it to manual run for safety
  };

  const handleDeleteQuery = (id: string) => {
      const updatedQueries = (dataset.savedQueries || []).filter(q => q.id !== id);
      if (onUpdate) onUpdate({ ...dataset, savedQueries: updatedQueries });
  };

  const renderChart = () => {
    if (!chartConfig || results.length === 0) return null;
    const color = '#6366f1';
    
    switch (chartConfig.type) {
        case 'bar': return (
            <BarChart data={results} margin={{top:10, right:10, bottom:0, left:-20}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                <XAxis dataKey={chartConfig.xAxis} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey={chartConfig.yAxis} fill={color} radius={[4,4,0,0]} />
            </BarChart>
        );
        case 'line': return (
            <LineChart data={results} margin={{top:10, right:10, bottom:0, left:-20}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                <XAxis dataKey={chartConfig.xAxis} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey={chartConfig.yAxis} stroke={color} strokeWidth={3} dot={{r:3}} />
            </LineChart>
        );
        case 'pie': return (
            <PieChart>
                <Pie data={results} dataKey={chartConfig.yAxis} nameKey={chartConfig.xAxis} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill={color}>
                     {results && Array.isArray(results) && results.map((_, idx) => <Cell key={idx} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]} />)}
                </Pie>
                <Tooltip />
            </PieChart>
        );
        default: return null;
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
                      <p className="text-[10px] text-slate-500 font-medium">Saved Logic</p>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 -mr-2 pr-2">
                  {!dataset.savedQueries || dataset.savedQueries.length === 0 ? (
                      <div className="text-center py-10 opacity-50">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Library Empty</p>
                      </div>
                  ) : (
                      dataset.savedQueries && Array.isArray(dataset.savedQueries) && dataset.savedQueries.map(q => (
                          <div key={q.id} className="group p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer relative" onClick={() => handleLoadQuery(q)}>
                              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{q.name}</h4>
                              <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{q.description || "No description"}</p>
                              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-[9px] text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</span>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteQuery(q.id); }} className="text-rose-400 hover:text-rose-600">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                              </div>
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
                <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">SQL Intelligence</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Autonomous query generation and workbench.</p>
            </div>
            <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
                <button onClick={() => setMode('ask')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'ask' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Agent Intent</button>
                <button onClick={() => setMode('sql')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'sql' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Raw Editor</button>
            </div>
        </div>

        {/* Input Area */}
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-2xl p-8 transition-all">
            <form onSubmit={execute} className="flex flex-col gap-6">
                {mode === 'ask' ? (
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                            <span className="text-2xl">🤖</span>
                        </div>
                        <input 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Analyze: 'Show me total revenue by region'..."
                            className="w-full pl-16 pr-4 py-6 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 dark:focus:border-indigo-500/20 rounded-[30px] text-lg font-bold focus:ring-[15px] focus:ring-indigo-500/5 transition-all outline-none text-slate-900 dark:text-white"
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="relative">
                            <textarea 
                                value={sqlQuery}
                                onChange={(e) => setSqlQuery(e.target.value)}
                                className="w-full h-40 p-8 font-mono text-xs bg-slate-950 text-indigo-400 rounded-[30px] focus:outline-none border border-white/5 shadow-2xl leading-relaxed resize-none no-scrollbar"
                                spellCheck={false}
                            />
                            <div className="absolute bottom-4 right-4 flex gap-2">
                                <button type="button" onClick={() => setShowSaveModal(true)} className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">Save Query</button>
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Use <code>?</code> as table source.</p>
                    </div>
                )}
                
                {/* Transparency Block: Show Generated SQL in Ask Mode */}
                {mode === 'ask' && generatedSql && (
                     <div className="p-6 bg-slate-950 rounded-[30px] border border-slate-800 animate-in slide-in-from-top-4">
                         <div className="flex justify-between items-center mb-4">
                             <div className="flex items-center gap-2">
                                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">AI Generated SQL</h4>
                             </div>
                             <div className="flex gap-2">
                                 <button type="button" onClick={() => { setMode('sql'); setSqlQuery(generatedSql); }} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold uppercase">Edit</button>
                                 <button type="button" onClick={() => setShowSaveModal(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase">Save</button>
                             </div>
                         </div>
                         <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap">{generatedSql}</pre>
                         {explanation && <p className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-400 font-medium italic">"{explanation}"</p>}
                     </div>
                )}

                {error && (
                    <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-[30px] animate-in shake">
                        {error}
                    </div>
                )}
                
                <div className="flex justify-end">
                    <button type="submit" disabled={loading} className="px-12 py-4 bg-indigo-600 text-white rounded-full font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all">
                    {loading ? 'Synthesizing...' : 'Run Intelligence'}
                    </button>
                </div>
            </form>
        </div>

        {/* Results Area */}
        <div className="flex-1 min-h-[400px] flex flex-col lg:flex-row gap-6 overflow-hidden">
            <div className={`flex-1 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col`}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Execution Grid ({results.length} rows)</h3>
                    <button className="text-indigo-600 text-[9px] font-black uppercase tracking-widest hover:underline">Download Logic Result</button>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar">
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
                                            <td key={j} className="px-6 py-4 text-slate-600 dark:text-slate-400 truncate max-w-[200px] font-medium">{String(val ?? '-')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10 opacity-30">
                            <div className="text-6xl mb-6">📊</div>
                            <p className="text-[10px] font-black uppercase tracking-widest">Buffer Empty</p>
                        </div>
                    )}
                </div>
            </div>
            {chartConfig && (
                <div className="lg:w-1/2 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-2xl p-8 flex flex-col animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Visual Output</h3>
                        <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-[9px] font-black text-indigo-600 rounded-full">{chartConfig.type}</span>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            {renderChart() || <div />}
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                  <h3 className="text-xl font-black uppercase tracking-tighter mb-6 text-slate-900 dark:text-white">Save Query Logic</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Name</label>
                          <input 
                            value={saveForm.name}
                            onChange={(e) => setSaveForm({...saveForm, name: e.target.value})}
                            className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="e.g. Monthly Revenue"
                            autoFocus
                          />
                      </div>
                      <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Description</label>
                          <textarea 
                            value={saveForm.description}
                            onChange={(e) => setSaveForm({...saveForm, description: e.target.value})}
                            className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none h-24"
                            placeholder="What does this query calculate?"
                          />
                      </div>
                      <div className="p-4 bg-slate-950 rounded-xl mt-2 overflow-hidden">
                           <code className="text-[10px] font-mono text-emerald-400 block truncate">
                               {mode === 'ask' && generatedSql ? generatedSql : sqlQuery}
                           </code>
                      </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-8">
                      <button onClick={() => setShowSaveModal(false)} className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
                      <button onClick={handleSaveQuery} disabled={!saveForm.name} className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">Save Logic</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PlaygroundView;
