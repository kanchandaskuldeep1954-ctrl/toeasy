
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dataset, ChartSpec, KPI, DataRow, DashboardConfig, Pattern } from '../types';
import { GroqService } from '../services/groqService';
import { validateChartSpec, assessDataQuality, generateChartInsights } from '../src/utils/chartValidation';
import { PlotlyChart } from './Dashboard/PlotlyChart';
import { KPICard } from './Dashboard/KPICard';
import { FilterPanel } from './Dashboard/FilterPanel';
import { InsightCard } from './Dashboard/InsightCard';
import { ChartBuilderPanel } from './Dashboard/ChartBuilderPanel';
import { DataPeekModal } from './Dashboard/DataPeekModal';
import { aggregateData } from '../src/utils/dashboardHelper';

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
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-2xl backdrop-blur-md animate-in zoom-in-95 z-[100] min-w-[150px]">
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-2 tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-2">{name}</p>
                <div className="space-y-1">
                    {payload.map((p: any, idx: number) => (
                        <p key={idx} className="text-sm font-bold text-slate-900 dark:text-white flex justify-between gap-4">
                            <span style={{ color: p.color }}>{p.name || 'Value'}:</span>
                            <span className="font-mono">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
                        </p>
                    ))}
                </div>
                {data.payload?.z !== undefined && (
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
    const [dashboardName, setDashboardName] = useState(dataset.name + ' Dashboard');
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    // Chart Validation & Quality Warnings
    const [chartValidations, setChartValidations] = useState<{ [id: string]: any }>({});
    const [dataQuality, setDataQuality] = useState<any>(null);
    const [showQualityWarnings, setShowQualityWarnings] = useState(false);

    // Edit Mode States
    const [editingChartId, setEditingChartId] = useState<string | null>(null);
    // const [editedChart, setEditedChart] = useState<ChartSpec | null>(null); // REMOVED: Handled by BuilderPanel
    // const [aiEditPrompt, setAiEditPrompt] = useState(''); // REMOVED: Handled by BuilderPanel
    // const [isAiEditing, setIsAiEditing] = useState(false); // REMOVED: Handled by BuilderPanel
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    // Data Transparency
    const [viewingDataChart, setViewingDataChart] = useState<ChartSpec | null>(null);

    const [dashboardPrompt, setDashboardPrompt] = useState(''); // Global dashboard prompt
    const [isDashboardThinking, setIsDashboardThinking] = useState(false);
    const [kpiPrompt, setKpiPrompt] = useState('');
    const [isKpiThinking, setIsKpiThinking] = useState(false);

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
            if (kpi.calculation.format === 'currency') fmtVal = `$${newVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            else if (kpi.calculation.format === 'percentage') fmtVal = `${newVal.toFixed(1)}%`;
            else fmtVal = newVal.toLocaleString(undefined, { maximumFractionDigits: 1 });

            return { ...kpi, value: fmtVal };
        });
    }, [config, filteredData]);

    const isMounted = React.useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const initAnalysis = async () => {
        if (config) return; // Already loaded

        setLoading(true);
        try {
            if (dataset.dashboardConfig) {
                setConfig(dataset.dashboardConfig);
                setLoading(false);
                return;
            }

            if (onAIAction) onAIAction();
            const generatedConfig = await GroqService.suggestDashboard(dataset);

            if (!isMounted.current) return;

            setConfig(generatedConfig);

            if (onUpdate) {
                onUpdate({ ...dataset, dashboardConfig: generatedConfig });
            }
        } catch (e) { console.error(e); }
        finally { if (isMounted.current) setLoading(false); }
    };

    useEffect(() => { initAnalysis(); }, [dataset.name]);

    // Validate charts and assess data quality
    useEffect(() => {
        if (!config || !dataset) return;

        // Assess overall data quality
        const quality = assessDataQuality(dataset.data || [], dataset.headers || []);
        setDataQuality(quality);

        // Validate each chart against data
        const validations: { [id: string]: any } = {};
        config.charts?.forEach((chart) => {
            validations[chart.id] = validateChartSpec(
                chart,
                dataset.data || [],
                dataset.headers || []
            );
        });
        setChartValidations(validations);
    }, [config, dataset]);



    const getChartData = useCallback((chart: ChartSpec) => {
        return aggregateData(chart, dataset, filteredData);
    }, [filteredData, dataset]);

    // --- Interaction Logic ---
    const handleChartClick = (data: any, chart: ChartSpec) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const payload = data.activePayload[0].payload;
            const val = payload.label || payload.name;
            const key = chart.xAxis || chart.groupBy;

            if (key && val) {
                setActiveFilters(prev => {
                    if (String(prev[key]) === String(val)) {
                        const { [key]: _, ...rest } = prev;
                        return rest;
                    }
                    return { ...prev, [key]: val };
                });
            }
        }
    };

    // --- Editing Functions ---

    const handleSaveChart = (newChart: ChartSpec) => {
        if (!config) return;

        // Check if updating existing or adding new
        const exists = config.charts.find(c => c.id === newChart.id);
        let updatedCharts;

        if (exists) {
            updatedCharts = config.charts.map(c => c.id === newChart.id ? newChart : c);
        } else {
            updatedCharts = [newChart, ...config.charts];
        }

        const newConfig = { ...config, charts: updatedCharts };
        setConfig(newConfig);
        if (onUpdate) onUpdate({ ...dataset, dashboardConfig: newConfig });

        // Close modals
        setEditingChartId(null);
        setIsCreatingNew(false);
    };

    const handleUpdateKPI = (updatedKpi: KPI) => {
        if (!config || !config.kpis) return;
        const updatedKPIs = config.kpis.map(k => k.id === updatedKpi.id ? updatedKpi : k);
        const newConfig = { ...config, kpis: updatedKPIs };
        setConfig(newConfig);
        if (onUpdate) onUpdate({ ...dataset, dashboardConfig: newConfig });
    };

    const handleRemoveKPI = (id: string) => {
        if (!config || !config.kpis) return;
        const updatedKPIs = config.kpis.filter(k => k.id !== id);
        const newConfig = { ...config, kpis: updatedKPIs };
        setConfig(newConfig);
        if (onUpdate) onUpdate({ ...dataset, dashboardConfig: newConfig });
    };

    const handleAddKPI = () => {
        if (!config) return;
        const firstCol = dataset.headers[0];
        const newKpi: KPI = {
            id: 'kpi-' + Date.now(),
            label: 'New KPI Metric',
            value: '-',
            calculation: {
                column: firstCol,
                operation: 'count',
                format: 'number'
            }
        };
        const updatedKPIs = [...(config.kpis || []), newKpi];
        const newConfig = { ...config, kpis: updatedKPIs };
        setConfig(newConfig);
        if (onUpdate) onUpdate({ ...dataset, dashboardConfig: newConfig });
    };

    const handleAiAddKPI = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!kpiPrompt || !config) return;
        setIsKpiThinking(true);
        try {
            const newKpi = await GroqService.generateKPIFromPrompt(dataset, kpiPrompt);
            const updatedKPIs = [...(config.kpis || []), newKpi];
            const newConfig = { ...config, kpis: updatedKPIs };
            setConfig(newConfig);
            if (onUpdate) onUpdate({ ...dataset, dashboardConfig: newConfig });
            setKpiPrompt('');
        } catch (e) {
            console.error(e);
            alert("AI could not generate this metric.");
        } finally {
            setIsKpiThinking(false);
        }
    };

    const handleClearFilter = (key: string) => {
        setActiveFilters(prev => {
            const { [key]: _, ...rest } = prev;
            return rest;
        });
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
        } catch (e) {
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
            const rawData = getChartData(chart);
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
        <div className="h-full flex flex-col items-center justify-center space-y-12 bg-slate-50 dark:bg-[#0b1120]">
            <div className="relative">
                <div className="w-24 h-24 border-[3px] border-slate-200 dark:border-slate-800 rounded-full animate-pulse" />
                <div className="absolute inset-0 border-[3px] border-t-indigo-500 rounded-full animate-spin" />
            </div>
            <div className="space-y-4 text-center">
                <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Initializing Intelligence</h3>
                <p className="text-slate-400 font-medium text-[10px] uppercase tracking-widest">Scaling {dataset.data.length.toLocaleString()} data points...</p>
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
            <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 flex flex-col xl:flex-row justify-between gap-4 shadow-sm no-print">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full xl:w-auto">
                    {isEditingTitle ? (
                        <div className="flex items-center gap-2 group">
                            <input
                                autoFocus
                                value={dashboardName}
                                onChange={(e) => setDashboardName(e.target.value)}
                                onBlur={() => setIsEditingTitle(false)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') setIsEditingTitle(false);
                                    if (e.key === 'Escape') setIsEditingTitle(false);
                                }}
                                className="text-2xl font-black uppercase tracking-tighter bg-slate-100 dark:bg-slate-800 border-b-2 border-indigo-500 rounded-t-lg px-2 py-1 outline-none ring-0 w-[400px]"
                            />
                            <button onClick={() => setIsEditingTitle(false)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20">Save</button>
                        </div>
                    ) : (
                        <h2
                            onClick={() => setIsEditingTitle(true)}
                            className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 transition-all flex items-center gap-3 group px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"
                        >
                            {dashboardName}
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </div>
                        </h2>
                    )}

                    {/* Dynamic Filter Panel */}
                    <div className="w-full md:w-auto md:pl-6 md:border-l border-slate-200 dark:border-slate-800">
                        <FilterPanel
                            filters={config?.filters || []}
                            activeFilters={activeFilters}
                            onFilterChange={(col, val) => setActiveFilters(prev => {
                                if (!val) { const { [col]: _, ...rest } = prev; return rest; }
                                return { ...prev, [col]: val };
                            })}
                            onClearAll={() => setActiveFilters({})}
                        />
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto overflow-x-auto no-scrollbar">
                    {/* Perspective Tabs */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto shadow-inner">
                        {(['Overview', 'Financials', 'Operational', 'Forensic', 'Patterns'] as DashboardPerspective[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setPerspective(p)}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${perspective === p
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm scale-100'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="hidden md:flex px-4 py-2.5 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 shadow-lg items-center gap-2 shrink-0 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4h14" /></svg>
                        Export
                    </button>
                </div>
            </div>

            {/* Filter Area (Breadcrumbs) - Enhanced with Glassmorphism */}
            {Object.keys(activeFilters).length > 0 && (
                <div className="px-8 pt-6 pb-2 flex flex-wrap gap-3 items-center animate-in slide-in-from-top-4 duration-700 ease-out no-print">
                    <div className="flex items-center gap-2.5 mr-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shadow-inner">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        </div>
                        <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.25em]">Filter Stack</span>
                    </div>
                    {Object.entries(activeFilters).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2.5 bg-white/70 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 pl-3.5 pr-1.5 py-1.5 rounded-2xl shadow-sm hover:shadow-indigo-500/10 hover:border-indigo-500/30 transition-all group animate-in zoom-in-95 duration-300">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{key}</span>
                            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{String(val)}</span>
                            <button
                                onClick={() => handleClearFilter(key)}
                                className="ml-1 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-rose-500 transition-all duration-300 active:scale-90"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={() => setActiveFilters({})}
                        className="ml-2 px-5 py-2 rounded-2xl text-[9px] font-black uppercase text-slate-500 hover:text-rose-500 hover:bg-rose-500/5 tracking-[0.2em] transition-all duration-300 flex items-center gap-2 hover:translate-x-1"
                    >
                        Reset All
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800/50 mx-3" />
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 italic opacity-80">
                        {filteredData.length.toLocaleString()} matching records
                    </div>
                </div>
            )}

            <div className="p-4 md:p-8 space-y-6 md:space-y-12">
                {/* KPI Grid */}
                {/* KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {dynamicKPIs.map((kpi) => (
                        <KPICard
                            key={kpi.id}
                            kpi={kpi}
                            dataset={dataset}
                            columns={dataset.headers}
                            onUpdate={handleUpdateKPI}
                            onDelete={handleRemoveKPI}
                        />
                    ))}
                    {/* Add New KPI Card with AI */}
                    <div className="flex flex-col gap-2 min-h-[160px]">
                        <button
                            onClick={handleAddKPI}
                            className="flex-1 group relative overflow-hidden rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-4 flex flex-col items-center justify-center gap-2 transition-all hover:border-indigo-500 hover:bg-slate-100 dark:hover:bg-indigo-500/5"
                        >
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-500 transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-all">Manual Metric</span>
                        </button>

                        <form onSubmit={handleAiAddKPI} className="group relative overflow-hidden rounded-xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 p-4 flex flex-col gap-2 transition-all hover:bg-indigo-100/50 dark:hover:bg-indigo-500/10 h-[100px]">
                            <div className="flex items-center gap-2">
                                <svg className={`w-3 h-3 text-indigo-500 dark:text-indigo-400 ${isKpiThinking ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-400">AI Metric Draft</span>
                            </div>
                            <input
                                value={kpiPrompt}
                                onChange={e => setKpiPrompt(e.target.value)}
                                placeholder="Describe metric..."
                                className="bg-transparent border-b border-indigo-500/20 text-[10px] text-slate-900 dark:text-white outline-none py-1 placeholder:text-indigo-400/50 focus:border-indigo-400 transition-all"
                            />
                            <button
                                type="submit"
                                disabled={isKpiThinking || !kpiPrompt}
                                className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 disabled:opacity-50 text-right mt-auto"
                            >
                                {isKpiThinking ? 'Thinking...' : 'Generate →'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Data Quality Report - Compact & Pro */}
                {dataQuality && (dataQuality.warnings.length > 0 || dataQuality.overallScore < 80) && (
                    <div className="bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-[32px] p-8 shadow-sm">
                        <div className="flex items-center justify-between gap-3 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-xl shadow-inner">
                                    <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                                <div>
                                    <h3 className="font-black uppercase tracking-[0.2em] text-slate-800 dark:text-slate-100 text-sm">Forensic Quality Scan</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">
                                            {dataQuality.overallScore}% integrity rating
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="hidden md:flex flex-col items-end">
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Status</span>
                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${dataQuality.overallScore > 90 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                    {dataQuality.overallScore > 90 ? 'Verified' : 'Review Required'}
                                </span>
                            </div>
                        </div>

                        {/* Quality Score Bar */}
                        <div className="mb-6">
                            <div className="w-full bg-white/50 dark:bg-slate-900/50 rounded-full h-2 overflow-hidden border border-yellow-200 dark:border-yellow-900/50">
                                <div
                                    className={`h-full transition-all ${dataQuality.overallScore >= 80
                                        ? 'bg-green-500'
                                        : dataQuality.overallScore >= 60
                                            ? 'bg-yellow-500'
                                            : 'bg-red-500'
                                        }`}
                                    style={{ width: `${dataQuality.overallScore}%` }}
                                />
                            </div>
                        </div>

                        {/* Warnings List */}
                        {dataQuality.warnings.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase text-yellow-900 dark:text-yellow-300 tracking-widest">Issues Found:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
                                    {dataQuality.warnings.slice(0, 8).map((warning: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className={`p-3 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${warning.level === 'error'
                                                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300'
                                                : warning.level === 'warning'
                                                    ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                                    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30 text-blue-700 dark:text-blue-300'
                                                }`}
                                        >
                                            <p className="font-black mb-1">
                                                {warning.level === 'error' ? '❌' : warning.level === 'warning' ? '⚠️' : 'ℹ️'} {warning.affectedField}
                                            </p>
                                            <p className="font-medium opacity-90 mb-2">{warning.message}</p>
                                            {warning.recommendation && (
                                                <p className="text-[9px] italic opacity-75">💡 {warning.recommendation}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {dataQuality.warnings.length > 8 && (
                                    <p className="text-[9px] font-bold text-yellow-600 dark:text-yellow-400 text-center pt-2">
                                        +{dataQuality.warnings.length - 8} more issues...
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Cardinalities Info */}
                        {Object.keys(dataQuality.cardinalities).length > 0 && (
                            <div className="mt-6 pt-6 border-t border-yellow-200 dark:border-yellow-900/30">
                                <p className="text-[10px] font-black uppercase text-yellow-900 dark:text-yellow-300 tracking-widest mb-3">Column Cardinalities:</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                    {Object.entries(dataQuality.cardinalities).slice(0, 12).map(([col, card]: [string, any]) => (
                                        <div key={col} className="text-center">
                                            <p className="text-[9px] font-bold text-yellow-700 dark:text-yellow-300 truncate">{col}</p>
                                            <p className="text-[10px] font-black text-yellow-900 dark:text-yellow-200">{card}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Charts Masonry Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
                    {/* Add New Widget Card */}
                    <button
                        onClick={() => setIsCreatingNew(true)}
                        className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] flex flex-col items-center justify-center p-8 hover:border-indigo-500/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all group h-[400px]"
                    >
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <span className="text-3xl text-slate-400 group-hover:text-indigo-500">+</span>
                        </div>
                        <h3 className="font-bold text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">Add New Chart</h3>
                        <p className="text-xs text-slate-400 mt-2">Build from scratch</p>
                    </button>

                    {visibleCharts.map((chart, i) => {
                        const data = getChartData(chart);
                        const validation = chartValidations[chart.id];
                        // Removed: if (data.length === 0) return null; - Let PlotlyChart show diagnostic state instead
                        const isWide = i % 3 === 0; // Every 3rd chart spans 2 cols on large screens
                        const hasWarnings = validation && (validation.warnings.length > 0 || !validation.valid);
                        const insights = data.length > 0 && chart.type !== 'scatter' && chart.type !== 'bubble'
                            ? generateChartInsights(data as any, chart.type)
                            : [];

                        return (
                            <div key={i} className={`glass-card p-6 md:p-8 rounded-[24px] flex flex-col h-[420px] ${isWide ? 'md:col-span-2' : ''} group relative overflow-hidden ${hasWarnings ? 'border-amber-200/50 dark:border-amber-900/30' : ''}`}>

                                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-all duration-500 flex gap-2 translate-y-2 group-hover:translate-y-0 no-print">
                                    <button onClick={() => setViewingDataChart(chart)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 shadow-sm transition-all duration-300">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                    </button>
                                    <button onClick={() => setEditingChartId(chart.id)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 shadow-sm transition-all duration-300">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                </div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{chart.title}</h3>
                                            {chart.priority === 'high' && (
                                                <div className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-lg text-[8px] font-black uppercase tracking-widest animate-pulse shadow-sm shadow-indigo-500/10">
                                                    AI Discovery
                                                </div>
                                            )}
                                            {hasWarnings && (
                                                <div className="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                                    Integrity Check
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-relaxed uppercase tracking-wider line-clamp-1 max-w-[280px]">
                                            {chart.description || `Analyzing patterns across ${chart.xAxis} ${chart.yAxis ? '& ' + chart.yAxis : ''}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex-1 w-full relative min-h-[300px] cursor-crosshair">
                                    <PlotlyChart
                                        chart={chart}
                                        data={data}
                                        onClick={(data) => handleChartClick(data, chart)}
                                    />
                                </div>

                                {/* Chart Insights Footer */}
                                {insights.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-2">Insights:</p>
                                        <p className="text-[9px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                            {insights.slice(0, 2).join(' • ')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

            {/* Patterns/Insights Section */}
            {perspective === 'Patterns' && config.patterns?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-10">
                    {config.patterns.map((pat, i) => (
                        <InsightCard
                            key={i}
                            title={`${pat.type} Detected`}
                            content={pat.description}
                            type={pat.type === 'anomaly' ? 'anomaly' : 'info'}
                            recommendation={pat.recommendation}
                        />
                    ))}
                </div>
            )}
        </div>

    {/* Global Dashboard AI Copilot (Bottom Bar) */ }
    < div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-[90] no-print" >
        <div className="glass-card !bg-white/80 dark:!bg-slate-900/80 p-2 rounded-full shadow-2xl border border-slate-200 dark:border-white/10 flex gap-2 items-center relative backdrop-blur-2xl">
            <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center shrink-0 shadow-lg">
                {isDashboardThinking ? <div className="w-4 h-4 border-2 border-slate-400 border-t-indigo-500 rounded-full animate-spin"></div> : <span className="text-lg text-white dark:text-slate-900">✨</span>}
            </div>
            <form onSubmit={handleGlobalDashboardPrompt} className="flex-1">
                <input
                    value={dashboardPrompt}
                    onChange={(e) => setDashboardPrompt(e.target.value)}
                    placeholder="Ask ToEasy: 'Add a revenue trend' or 'Show outliers'..."
                    className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 h-10 px-2"
                />
            </form>
            <button onClick={handleGlobalDashboardPrompt} disabled={!dashboardPrompt || isDashboardThinking} className="px-6 py-2 bg-indigo-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50">
                Execute
            </button>
        </div>
    </div >

    {/* Visual Studio (Chart Editor Modal) */ }
    {/* Visual Studio (Chart Editor Modal) - REPLACED WITH ChartBuilderPanel */ }
    {
        (editingChartId || isCreatingNew) && (
            <ChartBuilderPanel
                dataset={dataset}
                initialChart={isCreatingNew ? undefined : config.charts.find(c => c.id === editingChartId)}
                onSave={handleSaveChart}
                onCancel={() => { setEditingChartId(null); setIsCreatingNew(false); }}
                onAIAction={onAIAction}
            />
        )
    }

    {/* Data Peek Modal */ }
    {
        viewingDataChart && (
            <DataPeekModal
                chart={viewingDataChart}
                data={getChartData(viewingDataChart)}
                onClose={() => setViewingDataChart(null)}
            />
        )
    }
        </div >
    );
};

export default DashboardView;
