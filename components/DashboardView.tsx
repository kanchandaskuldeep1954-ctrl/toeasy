
import React, { useState, useEffect } from 'react';
import { Dataset, ChartSpec } from '../types';
import { GeminiService } from '../services/geminiService';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer, 
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, ScatterChart, Scatter,
  AreaChart, Area, Legend
} from 'recharts';

interface DashboardViewProps {
  dataset: Dataset;
  onAIAction?: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ dataset, onAIAction }) => {
  const [charts, setCharts] = useState<ChartSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userGoal, setUserGoal] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const initDashboard = async (goal?: string) => {
    setIsRegenerating(true);
    setError(null);
    try {
      if (onAIAction) onAIAction();
      const suggestedCharts = await GeminiService.suggestDashboard(dataset, goal);
      setCharts(suggestedCharts);
    } catch (e: any) {
      console.error("Dashboard error", e);
      setError("Visualization engine failed to synthesize views. Please check connectivity.");
    } finally {
      setLoading(false);
      setIsRegenerating(false);
    }
  };

  useEffect(() => {
    initDashboard();
  }, [dataset.name]);

  const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#3b82f6'];

  const renderChart = (chart: ChartSpec, index: number) => {
    const chartData = dataset.data.slice(0, 20);
    const color = colors[index % colors.length];

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xl">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1">{label}</p>
            {payload.map((p: any, i: number) => (
              <p key={i} className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between gap-6">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                  {p.name}:
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
              </p>
            ))}
          </div>
        );
      }
      return null;
    };

    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 10, left: -20, bottom: 0 }
    };

    switch (chart.type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
            <XAxis dataKey={chart.xAxis} stroke="currentColor" className="text-slate-400" fontSize={10} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="currentColor" className="text-slate-400" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', className: 'text-slate-50 dark:text-slate-800/20' }} />
            <Bar dataKey={chart.yAxis} fill={color} radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
            <XAxis dataKey={chart.xAxis} stroke="currentColor" className="text-slate-400" fontSize={10} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="currentColor" className="text-slate-400" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey={chart.yAxis} stroke={color} strokeWidth={2.5} dot={{ fill: color, r: 4, strokeWidth: 2, stroke: 'currentColor', className: 'text-white dark:text-slate-900' }} activeDot={{ r: 6, strokeWidth: 0 }} />
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id={`grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
            <XAxis dataKey={chart.xAxis} stroke="currentColor" className="text-slate-400" fontSize={10} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="currentColor" className="text-slate-400" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey={chart.yAxis} stroke={color} strokeWidth={2.5} fillOpacity={1} fill={`url(#grad-${index})`} />
          </AreaChart>
        );
      case 'pie':
        const pieData = chartData.slice(0, 8);
        return (
          <PieChart>
            <Pie
              data={pieData}
              dataKey={chart.yAxis}
              nameKey={chart.xAxis}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={5}
              stroke="none"
            >
              {pieData.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        );
      case 'scatter':
        return (
          <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
            <XAxis dataKey={chart.xAxis} stroke="currentColor" className="text-slate-400" fontSize={10} tickLine={false} axisLine={false} dy={10} />
            <YAxis dataKey={chart.yAxis} stroke="currentColor" className="text-slate-400" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Scatter data={chartData} fill={color} />
          </ScatterChart>
        );
      default:
        return null;
    }
  };

  if (loading && !isRegenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-8">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-800 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Synthesizing Business Intelligence</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">Mapping complex relationships into strategic visual representations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <header className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Executive Dashboard</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Auto-generated strategic viewpoints from active dataset partitions.</p>
        </div>
        
        <form 
          onSubmit={(e) => { e.preventDefault(); initDashboard(userGoal); }}
          className="w-full lg:w-auto flex flex-col sm:flex-row gap-3"
        >
          <input 
            value={userGoal}
            onChange={(e) => setUserGoal(e.target.value)}
            placeholder="Focus analysis (e.g. Regional Growth)"
            className="flex-1 lg:w-80 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
          />
          <button 
            type="submit"
            disabled={isRegenerating}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-3"
          >
            {isRegenerating ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            )}
            Sync Views
          </button>
        </form>
      </header>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 p-4 rounded-2xl flex items-center gap-4 text-rose-800 dark:text-rose-400 text-sm font-medium animate-in fade-in slide-in-from-top-4">
          <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {charts.map((chart, i) => (
          <div key={chart.id || i} className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 flex flex-col h-[480px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">{chart.type} visualization</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{chart.title}</h3>
              </div>
              <button className="p-2.5 opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
              </button>
            </div>
            
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart(chart, i) || <div />}
              </ResponsiveContainer>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               <div className="flex flex-col gap-1">
                  <span>Dimension</span>
                  <span className="text-slate-900 dark:text-slate-300 font-black">{chart.xAxis}</span>
               </div>
               <div className="text-right flex flex-col gap-1">
                  <span>Metric (Primary)</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-black">{chart.yAxis}</span>
               </div>
            </div>
            
            {isRegenerating && (
              <div className="absolute inset-0 bg-white/20 dark:bg-slate-950/20 backdrop-blur-[2px] z-50 rounded-[32px]"></div>
            )}
          </div>
        ))}

        <button 
          onClick={() => initDashboard(userGoal)}
          className="bg-slate-50/50 dark:bg-slate-900/30 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center h-[480px] hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all group"
        >
           <div className="w-16 h-16 rounded-[24px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 group-hover:text-indigo-600 group-hover:scale-110 transition-all shadow-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
           </div>
           <p className="mt-6 text-sm font-bold text-slate-500 uppercase tracking-widest text-center">Synthesize Additional Strategic Perspective</p>
        </button>
      </div>
      
      <div className="flex justify-center pt-16">
         <button className="px-10 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 dark:shadow-none flex items-center gap-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4v12" /></svg>
            Export Comprehensive Insight Packet
         </button>
      </div>
    </div>
  );
};

export default DashboardView;
