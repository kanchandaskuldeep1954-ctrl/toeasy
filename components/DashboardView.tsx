
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dataset, ChartSpec, KPI, DataRow, DashboardConfig, Pattern } from '../types';
import { GroqService } from '../services/groqService';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer, 
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, AreaChart, Area, 
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap, ComposedChart, ZAxis, ReferenceLine, RadialBarChart, RadialBar, FunnelChart, Funnel,
  LabelList, Legend
} from 'recharts';

interface DashboardViewProps {
  dataset: Dataset;
  onAIAction?: () => void;
  onUpdate?: (updated: Dataset) => void;
}

type DashboardPerspective = 'Overview' | 'Financials' | 'Operational' | 'Forensic' | 'Quality' | 'Patterns';
type ExportFormat = 'pdf' | 'html' | 'powerbi' | 'tableau' | 'json';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const value = typeof data.value === 'number' ? data.value.toLocaleString() : data.value;
    const name = data.name || label || data.payload?.name || 'Record';
    
    return (
      <div className="bg-slate-900/95 border border-slate-700/50 p-4 rounded-xl shadow-2xl backdrop-blur-md animate-in zoom-in-95 z-[100] min-w-[150px]">
        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em] border-b border-slate-700 pb-2">{name}</p>
        <div className="space-y-1">
            {payload.map((p: any, idx: number) => (
                <p key={idx} className="text-sm font-bold text-white flex justify-between gap-4">
                    <span style={{ color: p.color }}>{p.name || 'Value'}:</span>
                    <span className="font-mono">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
                </p>
            ))}
        </div>
        {data.payload?.z !== undefined && (
            <p className="text-[10px] font-medium text-slate-500 mt-2 pt-2 border-t border-slate-800">
                Metric (Z): {typeof data.payload.z === 'number' ? Math.round(data.payload.z).toLocaleString() : data.payload.z}
            </p>
        )}
      </div>
    );
  }
  return null;
};

const DashboardView: React.FC<DashboardViewProps> = ({ dataset, onAIAction, onUpdate }) => {
  const [perspective, setPerspective] = useState<DashboardPerspective>('Overview');
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Edit Mode States
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [editedChart, setEditedChart] = useState<ChartSpec | null>(null);
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [isAiEditing, setIsAiEditing] = useState(false);
  const [dashboardPrompt, setDashboardPrompt] = useState(''); // Global dashboard prompt
  const [isDashboardThinking, setIsDashboardThinking] = useState(false);

  // PowerBI-style Slicers
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [slicers, setSlicers] = useState<string[]>([]); // Columns valid for slicing

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#334155'];

  // Identify Slicers (Low cardinality string columns)
  useEffect(() => {
      const candidates = dataset.stats
          .filter(s => s.type === 'categorical' && s.uniqueValues > 1 && s.uniqueValues < 12)
          .map(s => s.column)
          .slice(0, 4); // Limit to 4 slicers
      setSlicers(candidates);
  }, [dataset]);

  const getPerspectiveData = useCallback(() => {
    if (perspective === 'Forensic') return dataset.quarantinedData || [];
    return dataset.data;
  }, [perspective, dataset]);

  // CORE ENGINE: Global Cross-Filtering
  const filteredData = useMemo(() => {
      let data = getPerspectiveData();
      if (Object.keys(activeFilters).length === 0) return data;

      return data.filter(row => {
          return Object.entries(activeFilters).every(([key, value]) => {
              if (value === null) return true;
              return String(row[key]) === String(value);
          });
      });
  }, [getPerspectiveData, activeFilters]);

  // Dynamic KPI Calculation (Reacts to filters)
  const dynamicKPIs = useMemo(() => {
      if (!config?.kpis) return [];
      
      return config.kpis.map(kpi => {
          if (!kpi.calculation || !kpi.calculation.column) return kpi;
          
          const col = kpi.calculation.column;
          const op = kpi.calculation.operation;
          const values = filteredData.map(r => Number(r[col])).filter(n => !isNaN(n));
          
          let newVal = 0;
          if (op === 'sum') newVal = values.reduce((a, b) => a + b, 0);
          else if (op === 'avg') newVal = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          else if (op === 'count') newVal = filteredData.length;
          else if (op === 'max') newVal = Math.max(...values, 0);
          else if (op === 'min') newVal = Math.min(...values, 0);
          else if (op === 'unique') newVal = new Set(filteredData.map(r => r[col])).size;

          let fmtVal = newVal.toLocaleString();
          if (kpi.calculation.format === 'currency') fmtVal = `$${newVal.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
          else if (kpi.calculation.format === 'percentage') fmtVal = `${newVal.toFixed(1)}%`;
          else fmtVal = newVal.toLocaleString(undefined, {maximumFractionDigits: 1});

          return { ...kpi, value: fmtVal }; 
      });
  }, [config, filteredData]);

  const initAnalysis = async () => {
    setLoading(true);
    try {
      if (dataset.dashboardConfig) {
          setConfig(dataset.dashboardConfig);
          setLoading(false);
          return;
      }

      if (onAIAction) onAIAction();
      const generatedConfig = await GroqService.suggestDashboard(dataset);
      setConfig(generatedConfig);
      
      if (onUpdate) {
        onUpdate({ ...dataset, dashboardConfig: generatedConfig });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { initAnalysis(); }, [dataset.name]);

  const handleChartClick = (data: any, chart: ChartSpec) => {
      if (!data || !data.activePayload) return;
      const payload = data.activePayload[0].payload;
      const key = chart.xAxis; 
      // Safe check for payload structure varies by chart type
      const value = payload.name !== undefined ? payload.name : payload.x;
      
      if (value === undefined) return;

      setActiveFilters(prev => {
          if (prev[key] === value) {
              const { [key]: _, ...rest } = prev;
              return rest;
          }
          return { ...prev, [key]: value };
      });
  };

  const aggregateData = useCallback((chart: ChartSpec) => {
    if (!filteredData || filteredData.length === 0) return [];

    const xAxis = chart.xAxis;
    const yAxis = chart.yAxis;
    const zAxis = chart.zAxis;

    // --- Histogram Logic ---
    if (chart.type === 'histogram') {
        const values = filteredData.map(d => Number(d[xAxis])).filter(n => !isNaN(n));
        if (values.length === 0) return [];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = 10;
        const binSize = (max - min) / binCount;
        const bins = Array.from({ length: binCount }, (_, i) => ({
            range: `${(min + i * binSize).toFixed(1)} - ${(min + (i + 1) * binSize).toFixed(1)}`,
            min: min + i * binSize,
            max: min + (i + 1) * binSize,
            count: 0
        }));
        
        values.forEach(v => {
            const binIndex = Math.min(Math.floor((v - min) / binSize), binCount - 1);
            if (bins[binIndex]) bins[binIndex].count++;
        });
        
        return bins.map(b => ({ name: b.range, value: b.count }));
    }

    // --- Scatter / Bubble / Heatmap Logic ---
    if (chart.type === 'scatter' || chart.type === 'bubble' || chart.type === 'heatmap') {
         if (chart.type === 'heatmap') {
             // For heatmap, we treat X and Y as categorical buckets
             const map = new Map<string, { x: string, y: string, z: number }>();
             filteredData.forEach(row => {
                 const xVal = String(row[xAxis] || 'Unknown');
                 const yVal = String(row[yAxis] || 'Unknown');
                 const key = `${xVal}::${yVal}`;
                 const zVal = zAxis ? (Number(row[zAxis]) || 1) : 1; // Count or Sum Z
                 
                 if (map.has(key)) {
                     map.get(key)!.z += zVal;
                 } else {
                     map.set(key, { x: xVal, y: yVal, z: zVal });
                 }
             });
             return Array.from(map.values());
         }

         // Scatter / Bubble
         return filteredData.map(row => ({
             x: Number(row[xAxis]) || 0,
             y: Number(row[yAxis]) || 0,
             z: zAxis ? (Number(row[zAxis]) || 100) : 100, // Z determines bubble size
             name: row[dataset.headers[0]]
         })).slice(0, 500); // Limit points for performance
    }

    // --- Treemap Logic ---
    if (chart.type === 'treemap') {
        const map = new Map<string, number>();
        filteredData.forEach(row => {
            const key = String(row[xAxis] || 'Unknown');
            const val = chart.aggregation === 'count' ? 1 : (parseFloat(String(row[yAxis])) || 0);
            map.set(key, (map.get(key) || 0) + val);
        });
        return Array.from(map.entries())
            .map(([name, size]) => ({ name, size }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 20);
    }

    // --- Standard Aggregation (Bar, Line, Area, Pie, Radar, Funnel, Gauge) ---
    const map = new Map<string, number>();
    filteredData.forEach(row => {
        const key = String(row[xAxis] || 'Unknown').trim();
        if (key === 'Unknown' || key === 'undefined') return;
        const val = chart.aggregation === 'count' ? 1 : (parseFloat(String(row[yAxis])) || 0);
        map.set(key, (map.get(key) || 0) + val);
    });
    
    let result = Array.from(map.entries())
        .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 18) + '...' : name, value: Number(value.toFixed(2)) }));
    
    // Sorting typically helps standard charts
    result.sort((a, b) => b.value - a.value);
    
    // Slice for readability unless it's a line chart (usually time series needs order)
    if (chart.type !== 'line' && chart.type !== 'area') {
        return result.slice(0, 30);
    } else {
        // For time-series like data, we might want to sort by name if it's a date?
        // Simple heuristic: if name looks like a year/date, sort by name
        if (result.length > 0 && !isNaN(Date.parse(result[0].name))) {
             result.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
        }
        return result.slice(0, 50); 
    }
  }, [filteredData, dataset.headers]);

  // --- Rendering Logic ---
  const renderChartContent = (chart: ChartSpec, data: any[], isPreview = false) => {
      const color = isPreview ? '#6366f1' : (perspective === 'Forensic' ? '#f43f5e' : '#6366f1');
      // Helper for gradients
      const gradientId = `grad-${chart.id}`;
      
      const CommonGrid = () => <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />;
      const CommonX = () => <XAxis dataKey={chart.type === 'scatter' || chart.type === 'bubble' ? 'x' : 'name'} fontSize={10} axisLine={false} tickLine={false} tick={{dy: 10, fill: '#94a3b8'}} type={chart.type === 'scatter' || chart.type === 'bubble' ? 'number' : 'category'} hide={chart.type === 'heatmap'} />;
      const CommonY = () => <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} type={chart.type === 'scatter' || chart.type === 'bubble' ? 'number' : 'number'} hide={chart.type === 'heatmap'} />;
      
      switch (chart.type) {
          case 'bar_horizontal':
              return (
                  <BarChart layout="vertical" data={data} margin={{left: 20}}>
                      <CommonGrid />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                      <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
              );
          
          case 'scatter':
          case 'bubble':
              return (
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CommonGrid />
                      <XAxis type="number" dataKey="x" name={chart.xAxis} fontSize={10} domain={['auto', 'auto']} />
                      <YAxis type="number" dataKey="y" name={chart.yAxis} fontSize={10} domain={['auto', 'auto']} />
                      {chart.type === 'bubble' && <ZAxis type="number" dataKey="z" range={[50, 1000]} name={chart.zAxis} />}
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                      <Scatter name={chart.title} data={data} fill={color} fillOpacity={0.6} />
                  </ScatterChart>
              );

          case 'heatmap':
              // Simulated Heatmap using Scatter with custom shape
              return (
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 60 }}>
                      <XAxis type="category" dataKey="x" name={chart.xAxis} fontSize={10} />
                      <YAxis type="category" dataKey="y" name={chart.yAxis} fontSize={10} />
                      <ZAxis type="number" dataKey="z" range={[0, 500]} name={chart.zAxis} /> // Z maps to opacity/size conceptually
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                      <Scatter data={data} shape={(props: any) => {
                          const { cx, cy, payload } = props;
                          // Simple intensity scaling based on Z value relative to max Z in data would be better
                          // For now, random opacity or fixed size
                          const opacity = Math.min(1, Math.max(0.2, (payload.z / (Math.max(...data.map(d=>d.z)) || 1))));
                          return <rect x={cx-15} y={cy-15} width={30} height={30} fill={color} fillOpacity={opacity} rx={4} />;
                      }} />
                  </ScatterChart>
              );

          case 'pie':
          case 'donut':
              return (
                  <PieChart>
                      <Pie 
                          data={data} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={chart.type === 'donut' ? '60%' : '0%'} 
                          outerRadius="80%" 
                          paddingAngle={2}
                          stroke="none"
                      >
                          {data.map((_, idx) => <Cell key={idx} fill={colors[idx % colors.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{fontSize: '10px'}} />
                  </PieChart>
              );
          
          case 'radar':
              return (
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                      <PolarGrid strokeOpacity={0.1} />
                      <PolarAngleAxis dataKey="name" fontSize={10} />
                      <PolarRadiusAxis angle={30} domain={[0, 'auto']} opacity={0} />
                      <Radar name={chart.yAxis} dataKey="value" stroke={color} fill={color} fillOpacity={0.4} />
                      <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
              );
          
          case 'funnel':
              return (
                  <FunnelChart>
                      <Tooltip content={<CustomTooltip />} />
                      <Funnel data={data} dataKey="value" nameKey="name" fill={color}>
                          <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                      </Funnel>
                  </FunnelChart>
              );

          case 'gauge':
              return (
                  <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" barSize={20} data={data.slice(0, 1)} startAngle={180} endAngle={0}>
                      <RadialBar label={{ position: 'insideStart', fill: '#fff' }} background dataKey="value" fill={color} cornerRadius={10} />
                      <Legend iconSize={10} layout="vertical" verticalAlign="middle" wrapperStyle={{top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}} />
                      <Tooltip content={<CustomTooltip />} />
                  </RadialBarChart>
              );

          case 'treemap':
              return (
                  <ResponsiveContainer>
                      <Treemap data={data} dataKey="size" aspectRatio={4/3} stroke="#fff" fill={color} animationDuration={800}>
                           <Tooltip content={<CustomTooltip />} />
                      </Treemap>
                  </ResponsiveContainer>
              );

          case 'line':
              return (
                  <LineChart data={data}>
                      <CommonGrid />
                      <CommonX />
                      <CommonY />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={{r: 3, fill: '#fff', strokeWidth: 2}} activeDot={{r: 6}} />
                  </LineChart>
              );

          case 'area':
              return (
                  <AreaChart data={data}>
                      <defs>
                          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={color} stopOpacity={0}/>
                          </linearGradient>
                      </defs>
                      <CommonGrid />
                      <CommonX />
                      <CommonY />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="value" stroke={color} fill={`url(#${gradientId})`} strokeWidth={3} />
                  </AreaChart>
              );

          case 'composed':
              return (
                  <ComposedChart data={data}>
                      <CommonGrid />
                      <CommonX />
                      <CommonY />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.6} />
                      <Line type="monotone" dataKey="value" stroke={colors[1]} strokeWidth={3} dot={{r: 4, fill: '#fff'}} />
                  </ComposedChart>
              );

          case 'bar':
          case 'histogram':
          default:
              return (
                  <BarChart data={data} barCategoryGap={chart.type === 'histogram' ? 1 : '10%'}>
                      <CommonGrid />
                      <CommonX />
                      <CommonY />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
                      {chart.type !== 'histogram' && <ReferenceLine y={data.reduce((a,b) => a + b.value, 0) / (data.length || 1)} stroke="orange" strokeDasharray="3 3" opacity={0.5} label={{ value: 'AVG', position: 'insideTopRight', fill: 'orange', fontSize: 9 }} />}
                  </BarChart>
              );
      }
  };

  // --- Editing Functions ---

  const openEditor = (chart: ChartSpec) => {
      setEditingChartId(chart.id);
      setEditedChart(JSON.parse(JSON.stringify(chart))); // Deep copy
      setAiEditPrompt('');
  };

  const saveEditedChart = () => {
      if (!config || !editedChart) return;
      const updatedCharts = config.charts.map(c => c.id === editedChart.id ? editedChart : c);
      const newConfig = { ...config, charts: updatedCharts };
      setConfig(newConfig);
      if (onUpdate) onUpdate({ ...dataset, dashboardConfig: newConfig });
      setEditingChartId(null);
      setEditedChart(null);
  };

  const handleAiEditChart = async () => {
      if (!editedChart || !aiEditPrompt) return;
      setIsAiEditing(true);
      try {
          if (onAIAction) onAIAction();
          const newSpec = await GroqService.modifyChartWithAI(dataset, editedChart, aiEditPrompt);
          // Preserve ID to ensure it replaces the correct chart
          setEditedChart({ ...newSpec, id: editedChart.id });
          setAiEditPrompt('');
      } catch (e) {
          console.error(e);
          alert('AI modification failed. Please try again.');
      } finally {
          setIsAiEditing(false);
      }
  };

  const handleGlobalDashboardPrompt = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!dashboardPrompt || !config) return;
      setIsDashboardThinking(true);
      try {
          if (onAIAction) onAIAction();
          // Generate a NEW chart based on the prompt
          const newChart = await GroqService.generateChartFromPrompt(dataset, dashboardPrompt);
          
          // Add to current perspective
          newChart.category = perspective;
          newChart.priority = 'high';
          
          const updatedConfig = { ...config, charts: [newChart, ...config.charts] };
          setConfig(updatedConfig);
          if (onUpdate) onUpdate({ ...dataset, dashboardConfig: updatedConfig });
          setDashboardPrompt('');
          // Optional: Scroll to top or highlight new chart
      } catch(e) {
          console.error(e);
          alert("Could not generate chart from prompt.");
      } finally {
          setIsDashboardThinking(false);
      }
  };

  // --- Export Logic ---

  const generateRichHTMLDashboard = () => {
      // 1. Prepare KPI Data
      const kpiData = dynamicKPIs;
      
      // 2. Prepare Chart Data (Pre-aggregated for offline use)
      const chartDataMap: Record<string, any> = {};
      const visibleCharts = config?.charts || [];
      
      visibleCharts.forEach(chart => {
          const rawData = aggregateData(chart);
          // Format for Chart.js
          chartDataMap[chart.id] = {
              type: chart.type === 'bar' ? 'bar' : chart.type === 'line' ? 'line' : chart.type === 'pie' ? 'doughnut' : 'line',
              labels: rawData.map(d => d.name),
              datasets: [{
                  label: chart.title,
                  data: rawData.map(d => d.value || d.size || d.y),
                  backgroundColor: rawData.map((_, i) => colors[i % colors.length] + 'CC'),
                  borderColor: rawData.map((_, i) => colors[i % colors.length]),
                  borderWidth: 1,
                  tension: 0.4,
                  fill: chart.type === 'area'
              }]
          };
      });

      return `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${dataset.name} - Interactive Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
            colors: {
               slate: { 850: '#151e2e', 900: '#0f172a', 950: '#020617' },
               indigo: { 500: '#6366f1', 600: '#4f46e5' }
            }
          }
        }
      }
    </script>
    <style>
        body { background-color: #020617; color: #f8fafc; }
        .glass { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.05); }
        .card-hover:hover { border-color: rgba(99, 102, 241, 0.3); transform: translateY(-2px); }
    </style>
</head>
<body class="p-8 min-h-screen">
    <div class="max-w-[1600px] mx-auto space-y-10">
        <!-- Header -->
        <div class="flex justify-between items-end border-b border-white/5 pb-8">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-xl font-black">T</div>
                    <h1 class="text-3xl font-black uppercase tracking-tight">Analytics OS</h1>
                </div>
                <p class="text-slate-400 font-medium">Portable Intelligence • ${dataset.name}</p>
            </div>
            <div class="text-right">
                <p class="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Generated On</p>
                <p class="text-sm font-mono text-indigo-400">${new Date().toLocaleString()}</p>
            </div>
        </div>

        <!-- KPI Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            ${kpiData.map(k => `
            <div class="glass p-6 rounded-3xl transition-all duration-300 card-hover">
                <p class="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-3">${k.label}</p>
                <h3 class="text-4xl font-black tracking-tighter text-white">${k.value}</h3>
            </div>
            `).join('')}
        </div>

        <!-- Charts Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            ${visibleCharts.map((c, i) => `
            <div class="glass p-8 rounded-[40px] flex flex-col h-[400px] card-hover transition-all duration-300 ${i % 3 === 0 ? 'md:col-span-2' : ''}">
                <div class="mb-6">
                    <h3 class="text-lg font-bold text-white">${c.title}</h3>
                    <p class="text-[11px] text-slate-400 mt-1">${c.description}</p>
                </div>
                <div class="flex-1 relative w-full min-h-0">
                    <canvas id="chart-${c.id}"></canvas>
                </div>
            </div>
            `).join('')}
        </div>
        
        <footer class="text-center pt-12 pb-6 text-slate-600 text-xs font-bold uppercase tracking-widest opacity-50">
            Powered by Toeasy AI • Offline Mode
        </footer>
    </div>

    <script>
        // Embedded Data
        const chartData = ${JSON.stringify(chartDataMap)};
        
        // Render Charts
        Object.keys(chartData).forEach(id => {
            const ctx = document.getElementById('chart-' + id);
            if(ctx) {
                new Chart(ctx, {
                    type: chartData[id].type,
                    data: chartData[id],
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { 
                                backgroundColor: '#1e293b', 
                                titleColor: '#94a3b8',
                                bodyColor: '#f8fafc',
                                padding: 12,
                                cornerRadius: 8,
                                displayColors: true
                            }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
                            y: { grid: { color: '#33415522' }, ticks: { color: '#64748b', font: { size: 10 } }, display: chartData[id].type !== 'doughnut' }
                        },
                        elements: {
                           bar: { borderRadius: 4 },
                           point: { radius: 0, hitRadius: 20 }
                        }
                    }
                });
            }
        });
    </script>
</body>
</html>
      `;
  };

  const handleExport = (format: ExportFormat) => {
      if (format === 'pdf') {
          window.print();
          return;
      }

      let content = '';
      let mime = 'text/plain';
      let ext = 'txt';

      if (format === 'html') {
          content = generateRichHTMLDashboard();
          mime = 'text/html';
          ext = 'html';
      } else if (format === 'powerbi' || format === 'tableau') {
          // Both consume CSV best
          const headers = dataset.headers.join(',');
          const rows = dataset.data.map(r => dataset.headers.map(h => 
            `"${String(r[h] ?? '').replace(/"/g, '""')}"`
          ).join(',')).join('\n');
          content = `${headers}\n${rows}`;
          mime = 'text/csv';
          ext = 'csv';
      } else if (format === 'json') {
          content = JSON.stringify(dataset, null, 2);
          mime = 'application/json';
          ext = 'json';
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${dataset.name}_${format === 'html' ? 'Visual_Dashboard' : 'Export'}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
  };

  if (loading || !config) return (
    <div className="h-full flex flex-col items-center justify-center space-y-12 animate-pulse bg-slate-50 dark:bg-slate-950">
        <div className="w-24 h-24 border-[8px] border-indigo-500/10 border-t-indigo-600 rounded-full animate-spin" />
        <div className="space-y-4 text-center">
            <h3 className="text-xl font-black uppercase tracking-[0.5em] text-indigo-500">Constructing BI Matrix</h3>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Processing {dataset.data.length.toLocaleString()} entities...</p>
        </div>
    </div>
  );

  const visibleCharts = config.charts.filter(c => {
     if (perspective === 'Overview') return c.priority === 'critical' || c.priority === 'high';
     if (perspective === 'Forensic') return c.category === 'Forensic' || c.category === 'Patterns';
     return c.category === perspective;
  });

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 pb-40 relative">
      
      {/* Top Bar: Slicers & Context */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-8 py-4 flex flex-col xl:flex-row justify-between gap-6 shadow-sm no-print">
          <div className="flex items-center gap-6">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white hidden md:block">Analytics OS</h2>
              
              {/* Slicers (Global Filters) */}
              <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mr-2">Slicers:</span>
                  {slicers.map(slicer => {
                      // Get unique values for this slicer from FULL dataset
                      const unique = Array.from(new Set(dataset.data.map(r => String(r[slicer])))).sort();
                      const isActive = !!activeFilters[slicer];
                      
                      return (
                          <div key={slicer} className="relative group">
                              <select 
                                value={activeFilters[slicer] || ''}
                                onChange={(e) => setActiveFilters(prev => {
                                    const val = e.target.value;
                                    if (!val) { const { [slicer]: _, ...rest } = prev; return rest; }
                                    return { ...prev, [slicer]: val };
                                })}
                                className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border cursor-pointer transition-all outline-none ${
                                    isActive 
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                }`}
                              >
                                  <option value="">{slicer} (All)</option>
                                  {unique.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                  <svg className={`w-3 h-3 ${isActive ? 'text-white' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </div>
                          </div>
                      )
                  })}
                  {Object.keys(activeFilters).length > 0 && (
                      <button onClick={() => setActiveFilters({})} className="ml-2 p-1.5 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors" title="Clear All">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  )}
              </div>
          </div>

          <div className="flex items-center gap-4">
              {/* Perspective Tabs */}
              <div className="flex gap-1 overflow-x-auto no-scrollbar bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['Overview', 'Financials', 'Operational', 'Forensic', 'Patterns'] as DashboardPerspective[]).map(p => (
                    <button
                        key={p}
                        onClick={() => setPerspective(p)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                        perspective === p 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm scale-100' 
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        {p}
                    </button>
                ))}
              </div>

              {/* Export Button */}
              <button 
                  onClick={() => setShowExportModal(true)}
                  className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 shadow-lg flex items-center gap-2"
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4h14" /></svg>
                  Export
              </button>
          </div>
      </div>

      <div className="p-8 space-y-12">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {dynamicKPIs.slice(0, 5).map((kpi, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-16 h-16 text-indigo-600 transform translate-x-4 -translate-y-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 truncate">{kpi.label}</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter truncate">{kpi.value}</h3>
                    
                    {/* Simulated Mini Sparkline */}
                    <div className="h-8 mt-4 w-full opacity-50">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[
                                {v: Math.random() * 10}, {v: Math.random() * 20}, {v: Math.random() * 15}, 
                                {v: Math.random() * 30}, {v: Math.random() * 25}, {v: Math.random() * 40}
                            ]}>
                                <Line type="monotone" dataKey="v" stroke={colors[idx % colors.length]} strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            ))}
        </div>

        {/* Charts Masonry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
            {visibleCharts.map((chart, i) => {
                const data = aggregateData(chart);
                if (data.length === 0) return null;
                const isWide = i % 3 === 0; // Every 3rd chart spans 2 cols on large screens

                return (
                    <div key={i} className={`bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[400px] hover:shadow-xl transition-shadow ${isWide ? 'md:col-span-2' : ''} group relative`}>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{chart.title}</h3>
                                <p className="text-[10px] text-slate-500 mt-1">{chart.description}</p>
                            </div>
                            <button 
                                onClick={() => openEditor(chart)}
                                className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-wide text-indigo-600 hover:bg-indigo-50 transition-all no-print flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                Edit
                            </button>
                        </div>

                        <div className="flex-1 w-full relative min-h-0 cursor-crosshair">
                            <ResponsiveContainer width="100%" height="100%">
                                {renderChartContent(chart, data)}
                            </ResponsiveContainer>
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Patterns/Insights Section */}
        {perspective === 'Patterns' && config.patterns.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-10">
                {config.patterns.map((pat, i) => (
                    <div key={i} className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-8 rounded-[32px] shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-20 text-6xl">
                            {pat.type === 'anomaly' ? '⚡' : '🔍'}
                        </div>
                        <h4 className="font-black uppercase tracking-widest text-xs mb-2 opacity-70">{pat.type} Detected</h4>
                        <p className="font-bold text-lg mb-4 leading-tight">{pat.description}</p>
                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                            <p className="text-[10px] uppercase font-bold opacity-60 mb-1">AI Recommendation</p>
                            <p className="text-sm font-medium">{pat.recommendation}</p>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Global Dashboard AI Copilot (Bottom Bar) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-[90] no-print">
          <div className="glass p-2 rounded-full shadow-2xl border border-indigo-500/20 flex gap-2 items-center relative">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                  {isDashboardThinking ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span className="text-lg">✨</span>}
              </div>
              <form onSubmit={handleGlobalDashboardPrompt} className="flex-1">
                  <input 
                    value={dashboardPrompt}
                    onChange={(e) => setDashboardPrompt(e.target.value)}
                    placeholder="Ask Copilot: 'Add a chart showing Sales by City' or 'Change layout'..."
                    className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 h-10"
                  />
              </form>
              <button onClick={handleGlobalDashboardPrompt} disabled={!dashboardPrompt || isDashboardThinking} className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity">
                  Go
              </button>
          </div>
      </div>

      {/* Visual Studio (Chart Editor Modal) */}
      {editingChartId && editedChart && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-[48px] w-full max-w-6xl h-[85vh] shadow-2xl flex overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                  
                  {/* Left: Preview Area */}
                  <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-12 flex flex-col justify-center relative border-r border-slate-200 dark:border-slate-800">
                      <div className="absolute top-8 left-8">
                          <span className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em]">Live Preview</span>
                      </div>
                      <div className="h-[500px] w-full bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-inner">
                          {(() => {
                              const previewData = aggregateData(editedChart);
                              if (previewData.length === 0) return <div className="flex items-center justify-center h-full text-slate-400 font-medium">Invalid Configuration or Empty Data</div>;
                              return (
                                  <ResponsiveContainer width="100%" height="100%">
                                      {renderChartContent(editedChart, previewData, true)}
                                  </ResponsiveContainer>
                              );
                          })()}
                      </div>
                  </div>

                  {/* Right: Controls Panel */}
                  <div className="w-[400px] bg-white dark:bg-slate-900 p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                      <div className="flex justify-between items-center">
                          <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Visual Studio</h3>
                          <button onClick={() => setEditingChartId(null)} className="text-slate-400 hover:text-rose-500 transition-colors">✕</button>
                      </div>

                      {/* AI Magic Edit */}
                      <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-[32px] border border-indigo-100 dark:border-indigo-900/30">
                          <label className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest mb-3 block flex items-center gap-2">
                              <span className="text-lg">✨</span> Magic Edit
                          </label>
                          <div className="relative">
                              <textarea 
                                value={aiEditPrompt} 
                                onChange={(e) => setAiEditPrompt(e.target.value)}
                                placeholder="e.g., 'Change to area chart showing trend'" 
                                className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-4 text-xs font-bold min-h-[80px] resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                              <button 
                                onClick={handleAiEditChart}
                                disabled={!aiEditPrompt || isAiEditing}
                                className="absolute bottom-3 right-3 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                              >
                                  {isAiEditing ? '...' : 'Apply'}
                              </button>
                          </div>
                      </div>

                      <div className="h-px bg-slate-100 dark:bg-slate-800 w-full"></div>

                      {/* Manual Controls */}
                      <div className="space-y-6">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Chart Type</label>
                              <div className="grid grid-cols-4 gap-2">
                                  {['bar', 'bar_horizontal', 'line', 'area', 'pie', 'donut', 'scatter', 'bubble', 'heatmap', 'radar', 'treemap', 'funnel', 'gauge', 'histogram', 'composed'].map(t => (
                                      <button 
                                        key={t}
                                        onClick={() => setEditedChart({...editedChart, type: t})}
                                        className={`px-1 py-2 rounded-lg text-[8px] font-bold uppercase border transition-all truncate ${editedChart.type === t ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                        title={t}
                                      >
                                          {t.replace('_', ' ')}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Title</label>
                              <input 
                                value={editedChart.title}
                                onChange={(e) => setEditedChart({...editedChart, title: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                              />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">X-Axis (Category)</label>
                                  <select 
                                    value={editedChart.xAxis}
                                    onChange={(e) => setEditedChart({...editedChart, xAxis: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                                  >
                                      {dataset.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Y-Axis (Value)</label>
                                  <select 
                                    value={editedChart.yAxis}
                                    onChange={(e) => setEditedChart({...editedChart, yAxis: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                                  >
                                      {dataset.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Z-Axis (Size/Metric)</label>
                                  <select 
                                    value={editedChart.zAxis || ''}
                                    onChange={(e) => setEditedChart({...editedChart, zAxis: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                                  >
                                      <option value="">None</option>
                                      {dataset.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Aggregation</label>
                                  <select 
                                    value={editedChart.aggregation || 'sum'}
                                    onChange={(e) => setEditedChart({...editedChart, aggregation: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                                  >
                                      <option value="sum">Sum</option>
                                      <option value="avg">Average</option>
                                      <option value="count">Count</option>
                                      <option value="max">Max</option>
                                      <option value="min">Min</option>
                                  </select>
                              </div>
                          </div>
                      </div>

                      <div className="mt-auto pt-6">
                          <button onClick={saveEditedChart} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-emerald-200 dark:shadow-none transition-all">
                              Save Changes
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default DashboardView;
