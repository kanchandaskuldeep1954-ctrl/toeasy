
import React, { useState, useEffect } from 'react';
import { Dataset, DataRow, ChartSpec } from '../types';
import { GeminiService } from '../services/geminiService';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer, 
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, ScatterChart, Scatter,
  AreaChart, Area
} from 'recharts';

interface PlaygroundViewProps {
  dataset: Dataset;
  onAIAction?: () => void;
}

const PlaygroundView: React.FC<PlaygroundViewProps> = ({ dataset, onAIAction }) => {
  const [mode, setMode] = useState<'human' | 'sql'>('human');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [query, setQuery] = useState('');
  const [sqlQuery, setSqlQuery] = useState(`SELECT region, SUM(revenue) as total_revenue \nFROM data \nGROUP BY region \nORDER BY total_revenue DESC;`);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DataRow[]>([]);
  const [chartConfig, setChartConfig] = useState<ChartSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDesigner, setShowDesigner] = useState(false);

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#06b6d4'];

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentQuery = mode === 'human' ? query : sqlQuery;
    if (!currentQuery.trim() || loading) return;

    setLoading(true);
    setError(null);
    setChartConfig(null);
    try {
      if (onAIAction) onAIAction();
      let data: DataRow[] = [];
      if (mode === 'human') {
        data = await GeminiService.executeNaturalLanguageQuery(dataset, currentQuery);
      } else {
        data = await GeminiService.executeRawSQL(dataset, currentQuery);
      }
      setResults(data);
      
      if (data.length > 0) {
        const suggestion = await GeminiService.suggestChartForResults(data);
        if (suggestion) {
          setChartConfig(suggestion);
        }
      }
    } catch (err) {
      setError(
        mode === 'human' 
        ? "AI was unable to translate that query. Try saying 'Show me all orders from New York'." 
        : "SQL execution failed. Check your syntax and table references (use 'data' as table name)."
      );
    } finally {
      setLoading(false);
    }
  };

  const headers = results.length > 0 ? Object.keys(results[0]) : [];

  const updateChartConfig = (updates: Partial<ChartSpec>) => {
    if (chartConfig) {
      setChartConfig({ ...chartConfig, ...updates });
    }
  };

  const renderChart = () => {
    if (!chartConfig || results.length === 0) return null;

    const chartData = results;
    const color = chartConfig.color || colors[0];

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-[#1e293b]/95 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-1">{label}</p>
            <p className="text-sm font-bold text-white">
              {payload[0].name}: <span className="text-indigo-400">{payload[0].value}</span>
            </p>
          </div>
        );
      }
      return null;
    };

    switch (chartConfig.type) {
      case 'bar':
        return (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={chartConfig.xAxis} stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={chartConfig.yAxis} fill={color} radius={[6, 6, 0, 0]} barSize={40} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={chartConfig.xAxis} stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey={chartConfig.yAxis} stroke={color} strokeWidth={3} dot={{ fill: color, r: 4, strokeWidth: 2, stroke: '#0b0e14' }} activeDot={{ r: 6, strokeWidth: 0 }} />
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={chartConfig.xAxis} stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey={chartConfig.yAxis} stroke={color} strokeWidth={3} fill="url(#areaGradient)" />
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey={chartConfig.yAxis}
              nameKey={chartConfig.xAxis}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={110}
              paddingAngle={5}
              stroke="none"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        );
      case 'scatter':
        return (
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={chartConfig.xAxis} stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
            <YAxis dataKey={chartConfig.yAxis} stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Scatter name={chartConfig.title} data={chartData} fill={color} />
          </ScatterChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-2">
        <div className="text-left space-y-1">
          <h2 className="text-4xl font-black text-white tracking-tighter italic">Analytical <span className="text-indigo-500">Playground</span></h2>
          <p className="text-slate-500 text-sm font-medium">Extract, transform, and visualize your data stack with AI-powered SQL.</p>
        </div>
        
        <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl">
          <button 
            onClick={() => setMode('human')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'human' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            Human Command
          </button>
          <button 
            onClick={() => setMode('sql')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'sql' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            SQL Console
          </button>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto">
        <div className="glass-morphism rounded-[40px] border border-white/10 p-2 bg-[#161a23] shadow-3xl relative group overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></div>
          
          <form onSubmit={handleFetch} className="flex flex-col gap-4 p-5 relative z-10">
            {mode === 'human' ? (
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-[20px] bg-indigo-600/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/20 shadow-inner">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask for data insights (e.g. 'Show me revenue by region as a bar chart')..."
                  className="flex-1 bg-transparent border-none text-white text-xl focus:ring-0 placeholder:text-slate-800 font-black italic tracking-tight"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>
                    Neural SQL Terminal
                  </span>
                  <div className="flex items-center gap-4">
                     <span className="text-[9px] font-mono text-slate-700 bg-white/5 px-2 py-0.5 rounded uppercase">SCHEMA: data</span>
                     <span className="text-[9px] font-mono text-slate-700 bg-white/5 px-2 py-0.5 rounded uppercase">VERSION: v4.2</span>
                  </div>
                </div>
                <textarea 
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full min-h-[180px] bg-[#0d1017] border border-white/5 rounded-[28px] p-8 text-indigo-400 font-mono text-sm focus:ring-2 focus:ring-indigo-500/10 transition-all custom-scrollbar outline-none resize-none leading-relaxed shadow-inner"
                  placeholder="SELECT * FROM data..."
                />
              </div>
            )}
            
            <div className="flex justify-between items-center mt-2 px-2">
              <div className="text-[10px] text-slate-600 font-bold italic tracking-tight uppercase">
                *Powered by Gemini 3 Ultra-Pro Synthesis
              </div>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => { mode === 'human' ? setQuery('') : setSqlQuery('') }}
                  className="px-6 py-4 text-[10px] font-black text-slate-600 hover:text-white uppercase tracking-[0.2em] transition-colors"
                >
                  Flush Buffer
                </button>
                <button 
                  type="submit" 
                  disabled={loading || (mode === 'human' ? !query.trim() : !sqlQuery.trim())}
                  className="px-12 py-4.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-3xl shadow-indigo-600/30 flex items-center gap-3 active:scale-95"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      Executing Thread
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Execute Command
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="flex-1 glass-morphism rounded-[48px] border border-white/10 bg-[#0d1017] overflow-hidden flex flex-col shadow-3xl min-h-[500px] relative">
         {results.length > 0 ? (
           <>
             <div className="px-10 py-6 border-b border-white/10 flex justify-between items-center bg-[#161a23]/80 backdrop-blur-xl z-20">
                <div className="flex gap-4 p-1 bg-white/5 border border-white/10 rounded-2xl">
                   <button 
                    onClick={() => setViewMode('table')}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                   >
                     Record View
                   </button>
                   <button 
                    onClick={() => setViewMode('chart')}
                    disabled={!chartConfig}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'chart' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'} disabled:opacity-20`}
                   >
                     Visual View
                   </button>
                </div>
                
                <div className="flex items-center gap-6">
                  {viewMode === 'chart' && (
                    <button 
                      onClick={() => setShowDesigner(!showDesigner)}
                      className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 flex items-center gap-2 ${showDesigner ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                      {showDesigner ? 'Close Designer' : 'Visual Designer'}
                    </button>
                  )}
                  <div className="h-8 w-px bg-white/10"></div>
                  <div className="text-right">
                    <span className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest">Query Result Set</span>
                    <span className="block text-[10px] font-black text-slate-600 uppercase tracking-widest">{results.length} records synthesized</span>
                  </div>
                </div>
             </div>

             <div className="flex-1 flex overflow-hidden">
                {/* Result Workspace */}
                <div className="flex-1 overflow-auto custom-scrollbar relative">
                  {viewMode === 'table' ? (
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 bg-[#161a23]/95 backdrop-blur-xl z-20 border-b border-white/10 shadow-lg">
                        <tr>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-600 uppercase border-r border-white/5 w-20 text-center tracking-widest">ID</th>
                            {headers.map(h => (
                              <th key={h} className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest border-r border-white/5 min-w-[160px]">{h}</th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {results.map((row, i) => (
                          <tr key={i} className="hover:bg-indigo-500/[0.04] group transition-colors">
                              <td className="px-8 py-4 text-[10px] font-mono font-bold text-slate-600 border-r border-white/5 text-center bg-white/[0.01]">
                                {i + 1}
                              </td>
                              {headers.map(h => (
                                <td key={h} className="px-8 py-4 text-sm text-slate-300 border-r border-white/5 font-medium group-hover:text-white transition-colors">
                                  {row[h] === null || row[h] === undefined ? <span className="text-slate-700 italic">null</span> : String(row[h])}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex flex-col p-12 bg-[#0d1017]">
                       <div className="flex-1 w-full min-h-[400px]">
                          <div className="text-center mb-10">
                             <h3 className="text-2xl font-black text-white tracking-tight italic">{chartConfig?.title}</h3>
                             <p className="text-xs text-slate-500 mt-2 font-medium tracking-wide">Dimension: <span className="text-indigo-400">{chartConfig?.xAxis}</span> • Metric: <span className="text-indigo-400">{chartConfig?.yAxis}</span></p>
                          </div>
                          <ResponsiveContainer width="100%" height="90%">
                             {renderChart() || <div />}
                          </ResponsiveContainer>
                       </div>
                    </div>
                  )}
                </div>

                {/* Designer Panel Overlay */}
                {viewMode === 'chart' && showDesigner && chartConfig && (
                  <div className="w-80 bg-[#161a23]/95 backdrop-blur-2xl border-l border-white/10 p-10 flex flex-col gap-10 animate-in slide-in-from-right-8 duration-500">
                     <div>
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-8">Visualization Config</h4>
                        <div className="space-y-8">
                           <div className="space-y-3">
                              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">Chart Type</label>
                              <div className="grid grid-cols-2 gap-2">
                                 {['bar', 'line', 'pie', 'area', 'scatter'].map(t => (
                                   <button 
                                    key={t}
                                    onClick={() => updateChartConfig({ type: t as any })}
                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${chartConfig.type === t ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'text-slate-500 border-white/5 hover:border-white/20 hover:text-white'}`}
                                   >
                                     {t}
                                   </button>
                                 ))}
                              </div>
                           </div>

                           <div className="space-y-3">
                              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">X-Axis (Dimension)</label>
                              <select 
                                value={chartConfig.xAxis}
                                onChange={(e) => updateChartConfig({ xAxis: e.target.value })}
                                className="w-full bg-[#0d1017] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 appearance-none font-bold"
                              >
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                           </div>

                           <div className="space-y-3">
                              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">Y-Axis (Metric)</label>
                              <select 
                                value={chartConfig.yAxis}
                                onChange={(e) => updateChartConfig({ yAxis: e.target.value })}
                                className="w-full bg-[#0d1017] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 appearance-none font-bold"
                              >
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                           </div>

                           <div className="space-y-3">
                              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">Visual Palette</label>
                              <div className="flex gap-3">
                                 {colors.slice(0, 5).map(c => (
                                   <button 
                                    key={c} 
                                    onClick={() => updateChartConfig({ color: c })}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${chartConfig.color === c ? 'border-white scale-125 shadow-xl' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                    style={{ backgroundColor: c }}
                                   />
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="mt-auto pt-8 border-t border-white/5">
                        <p className="text-[10px] text-slate-600 font-bold italic leading-relaxed">
                          *The analytical engine maintains a real-time bind between your SQL result set and this visual abstraction layer.
                        </p>
                     </div>
                  </div>
                )}
             </div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-center p-20 space-y-10 animate-in fade-in zoom-in duration-700">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-600/15 blur-[100px] rounded-full"></div>
                <div className="w-28 h-28 bg-[#161a23] rounded-[40px] flex items-center justify-center text-5xl border border-white/10 shadow-3xl relative z-10 text-slate-600 scale-110">
                  {mode === 'human' ? '🤖' : '💻'}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-white italic tracking-tighter">Initialized & Ready.</h3>
                <p className="text-slate-500 max-w-sm mx-auto font-medium text-lg leading-relaxed">
                  {mode === 'human' 
                    ? "Deliver a natural language instruction to synthesize a custom dataset view." 
                    : "Inject a structured SQL SELECT statement to extract precise metrics from the stack."
                  }
                </p>
              </div>
              <div className="flex gap-5">
                 <div className="px-5 py-2.5 rounded-2xl border border-white/10 bg-white/[0.03] text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] shadow-lg">
                    Index Parity: Valid
                 </div>
                 <div className="px-5 py-2.5 rounded-2xl border border-white/10 bg-white/[0.03] text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] shadow-lg">
                    Inference: Optimized
                 </div>
              </div>
           </div>
         )}
         
         <div className="p-6 bg-[#161a23] border-t border-white/10 flex justify-between items-center px-12 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-10">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Records Synthesized: <span className="text-indigo-400 font-mono text-xs">{results.length}</span></span>
               <div className="h-4 w-px bg-white/5"></div>
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Buffer Health: <span className="text-emerald-500">Optimized</span></span>
            </div>
            {error && (
              <div className="flex items-center gap-3 text-rose-500 animate-pulse bg-rose-500/5 px-6 py-2 rounded-full border border-rose-500/10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
              </div>
            )}
            <div className="flex gap-6">
               <button className="text-[10px] font-black text-slate-600 hover:text-white uppercase tracking-[0.2em] transition-colors flex items-center gap-3 active:scale-95">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4v12" /></svg>
                  Export View
               </button>
               <button className="text-[10px] font-black text-slate-600 hover:text-indigo-400 uppercase tracking-[0.2em] transition-colors flex items-center gap-3 active:scale-95">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  Push to Dashboard
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default PlaygroundView;
