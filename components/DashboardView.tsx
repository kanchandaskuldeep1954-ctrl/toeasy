
import React, { useState, useEffect } from 'react';
import { Dataset, ChartSpec, KPI } from '../types';
import { GeminiService } from '../services/geminiService';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer, 
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, ScatterChart, Scatter,
  AreaChart, Area
} from 'recharts';

interface DashboardViewProps {
  dataset: Dataset;
  onAIAction?: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ dataset, onAIAction }) => {
  const [charts, setCharts] = useState<ChartSpec[]>([]);
  const [kpis, setKpis] = useState<KPI[]>(dataset.kpis || []);
  const [loading, setLoading] = useState(true);
  const [userGoal, setUserGoal] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const initDashboard = async (goal?: string) => {
    setIsRegenerating(true);
    try {
      if (onAIAction) onAIAction();
      
      // Parallel execution for speed
      const [suggestedCharts, extractedKpis] = await Promise.all([
        GeminiService.suggestDashboard(dataset, goal),
        GeminiService.extractKPIs(dataset)
      ]);

      setCharts(suggestedCharts);
      setKpis(extractedKpis);
    } catch (e) {
      console.error("Dashboard error", e);
    } finally {
      setLoading(false);
      setIsRegenerating(false);
    }
  };

  useEffect(() => {
    if (dataset.kpis && dataset.customCharts) {
        setKpis(dataset.kpis);
        setCharts(dataset.customCharts);
        setLoading(false);
    } else {
        initDashboard();
    }
  }, [dataset.name]);

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const renderChart = (chart: ChartSpec, index: number) => {
    const chartData = dataset.data.slice(0, 30); // Visualization sample
    const color = colors[index % colors.length];

    const commonProps = { data: chartData, margin: { top: 10, right: 10, left: -20, bottom: 0 } };

    switch (chart.type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={chart.xAxis} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{ fill: '#f1f5f9' }}
            />
            <Bar dataKey={chart.yAxis} fill={color} radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={chart.xAxis} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Line type="monotone" dataKey={chart.yAxis} stroke={color} strokeWidth={3} dot={{ fill: 'white', stroke: color, strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chartData.slice(0, 6)}
              dataKey={chart.yAxis}
              nameKey={chart.xAxis}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
            >
              {chartData.map((_, idx) => <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
          </PieChart>
        );
      case 'area':
        return (
            <AreaChart {...commonProps}>
                <defs>
                    <linearGradient id={`grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey={chart.xAxis} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey={chart.yAxis} stroke={color} fill={`url(#grad-${index})`} strokeWidth={3} />
            </AreaChart>
        );
      default: return null;
    }
  };

  if (loading && !isRegenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500 animate-pulse">Consulting AI Analyst...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Executive Dashboard</h2>
           <p className="text-sm text-slate-500 dark:text-slate-400">Real-time overview of {dataset.name}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <input 
                value={userGoal}
                onChange={(e) => setUserGoal(e.target.value)}
                placeholder="Focus analysis (e.g., 'Sales by Region')"
                className="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button 
                onClick={() => initDashboard(userGoal)}
                disabled={isRegenerating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-70"
            >
                {isRegenerating ? 'Syncing...' : 'Update'}
            </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                <div className="flex items-end justify-between">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.value}</h3>
                    {kpi.trend !== undefined && kpi.trend !== null && (
                        <div className={`flex items-center text-xs font-bold ${kpi.trendDirection === 'up' ? 'text-emerald-500' : kpi.trendDirection === 'down' ? 'text-rose-500' : 'text-slate-400'}`}>
                            {kpi.trendDirection === 'up' ? '↑' : kpi.trendDirection === 'down' ? '↓' : '→'} {Math.abs(kpi.trend)}%
                        </div>
                    )}
                </div>
            </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {charts.map((chart, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[400px]">
                <div className="mb-6">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{chart.title}</h3>
                    {chart.description && <p className="text-xs text-slate-500 mt-1">{chart.description}</p>}
                </div>
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        {renderChart(chart, i) || <div />}
                    </ResponsiveContainer>
                </div>
            </div>
        ))}
        
        {/* Add Chart Placeholder */}
        <button 
            onClick={() => initDashboard("Add more detail")}
            className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all h-[400px] gap-4"
        >
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            <span className="text-sm font-bold uppercase tracking-wider">Expand Analysis</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardView;
