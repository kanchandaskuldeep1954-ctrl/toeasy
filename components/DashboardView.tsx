
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
import { sharingAPI } from '../src/services/api';
import { useSearchParams } from 'react-router-dom';

interface DashboardViewProps {
    dataset: Dataset;
    onAIAction?: () => void;
    onUpdate?: (updated: Dataset) => void;
}

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
            </div>
        );
    }
    return null;
};

const DashboardView: React.FC<DashboardViewProps> = ({ dataset, onAIAction, onUpdate }) => {
    const [config, setConfig] = useState<DashboardConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [showExportModal, setShowExportModal] = useState(false);

    const cleanName = useMemo(() => {
        return dataset.name
            .replace(/[-_.]mock[-_.]data/gi, '')
            .replace(/[._]sheet\d+/gi, '')
            .replace(/[_-]+/g, ' ')
            .trim();
    }, [dataset.name]);

    const [dashboardName, setDashboardName] = useState(cleanName + ' Dashboard');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingFilters, setIsEditingFilters] = useState(false);
    const [isFilterStudioOpen, setIsFilterStudioOpen] = useState(false);

    const [chartValidations, setChartValidations] = useState<{ [id: string]: any }>({});
    const [dataQuality, setDataQuality] = useState<any>(null);

    const [editingChartId, setEditingChartId] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    const [viewingDataChart, setViewingDataChart] = useState<ChartSpec | null>(null);
    const [aiExplainingId, setAiExplainingId] = useState<string | null>(null);
    const [deepDiveResult, setDeepDiveResult] = useState<{ id: string, text: string } | null>(null);
    const [isForecastMode, setIsForecastMode] = useState(false);
    const [isCinematicMode, setIsCinematicMode] = useState(false);
    const [activeCinematicIndex, setActiveCinematicIndex] = useState(0);

    const [dashboardPrompt, setDashboardPrompt] = useState('');
    const [isDashboardThinking, setIsDashboardThinking] = useState(false);
    const [kpiPrompt, setKpiPrompt] = useState('');
    const [isKpiThinking, setIsKpiThinking] = useState(false);

    const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});

    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace') || '';

    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    const filteredData = useMemo(() => {
        let data = dataset.data;
        if (Object.keys(activeFilters).length === 0) return data;

        return data.filter(row => {
            return Object.entries(activeFilters).every(([key, value]) => {
                if (value === null || value === '') return true;
                return String(row[key]) === String(value);
            });
        });
    }, [dataset.data, activeFilters]);

    const dynamicKPIs = useMemo(() => {
        if (!config?.kpis || !Array.isArray(config.kpis)) return [];

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
            else if (op === 'min') newVal = values.length ? Math.min(...values) : 0;
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

    const loadOrGenerate = async (force: boolean = false) => {
        // If we are forcing, or if we have it in the dataset, we proceed.
        // Otherwise, we wait for user intent.
        if (!force && !dataset.dashboardConfig) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            if (!force && dataset.dashboardConfig) {
                setConfig(dataset.dashboardConfig);
                setLoading(false);
                return;
            }
            if (onAIAction) onAIAction();
            const generatedConfig = await GroqService.suggestDashboard(dataset);
            if (!isMounted.current) return;
            setConfig(generatedConfig);
            if (onUpdate) onUpdate({ ...dataset, dashboardConfig: generatedConfig });
        } catch (e) {
            console.error(e);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    useEffect(() => {
        setDashboardName(cleanName + ' Dashboard');
        // Auto-load ONLY if it already exists in the dataset.
        // No auto-generation on first visit to save tokens.
        if (dataset.dashboardConfig) {
            loadOrGenerate(false);
        } else {
            setLoading(false);
        }
    }, [dataset.name, cleanName]);

    useEffect(() => {
        if (!config || !dataset) return;
        const quality = assessDataQuality(dataset.data || [], dataset.headers || []);
        setDataQuality(quality);
        const validations: { [id: string]: any } = {};
        config.charts?.forEach((chart) => {
            validations[chart.id] = validateChartSpec(chart, dataset.data || [], dataset.headers || []);
        });
        setChartValidations(validations);
    }, [config, dataset]);

    const getChartData = useCallback((chart: ChartSpec) => {
        return aggregateData(chart, dataset, filteredData);
    }, [filteredData, dataset]);

    const injectChartConfig = useCallback((chart: ChartSpec): ChartSpec => {
        if (!isForecastMode) return chart;
        return {
            ...chart,
            chartConfig: { ...chart.chartConfig, trendline: 'ols' }
        };
    }, [isForecastMode]);

    const handleChartClick = (data: any, chart: ChartSpec) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const payload = data.activePayload[0].payload;
            const val = payload.label || payload.name;
            const key = chart.xAxis || chart.groupBy;
            if (key && val) {
                setActiveFilters(prev => (prev[key] === val ? { ...prev, [key]: null } : { ...prev, [key]: val }));
            }
        }
    };

    const handleSaveChart = (newChart: ChartSpec) => {
        if (!config) return;
        const currentCharts = Array.isArray(config.charts) ? config.charts : [];
        const exists = currentCharts.find(c => c.id === newChart.id);
        const updatedCharts = exists ? currentCharts.map(c => c.id === newChart.id ? newChart : c) : [newChart, ...currentCharts];
        const newConfig = { ...config, charts: updatedCharts };
        setConfig(newConfig);
        if (onUpdate) onUpdate({ ...dataset, dashboardConfig: newConfig });
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
            calculation: { column: firstCol, operation: 'count', format: 'number' }
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
        } finally {
            setIsKpiThinking(false);
        }
    };

    const handleAddFilter = (column: string) => {
        if (!config) return;
        const newFilter = {
            id: 'filter-' + Date.now(),
            label: column,
            column: column,
            type: 'select' as const,
            options: Array.from(new Set(dataset.data.map(r => String(r[column] || '')))).filter(v => v !== '').slice(0, 50)
        };
        const updatedFilters = [...(config.filters || []), newFilter];
        const newConfig = { ...config, filters: updatedFilters };
        setConfig(newConfig);
        if (onUpdate) onUpdate({ ...dataset, dashboardConfig: newConfig });
        setIsFilterStudioOpen(false);
    };

    const handleRemoveFilter = (filterId: string) => {
        if (!config || !config.filters) return;
        const updatedFilters = config.filters.filter(f => f.id !== filterId);
        const newConfig = { ...config, filters: updatedFilters };
        setConfig(newConfig);
        if (onUpdate) onUpdate({ ...dataset, dashboardConfig: newConfig });
    };

    const handleGlobalDashboardPrompt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dashboardPrompt || !config) return;
        setIsDashboardThinking(true);
        try {
            const newChart = await GroqService.generateChartFromPrompt(dataset, dashboardPrompt);
            const updatedConfig = { ...config, charts: [newChart, ...config.charts] };
            setConfig(updatedConfig);
            if (onUpdate) onUpdate({ ...dataset, dashboardConfig: updatedConfig });
            setDashboardPrompt('');
        } catch (e) {
            console.error(e);
        } finally {
            setIsDashboardThinking(false);
        }
    };

    const handleAiExplain = async (chart: ChartSpec) => {
        setAiExplainingId(chart.id);
        try {
            const result = await GroqService.consultVerifiedAgent(dataset, `Analyze this chart: "${chart.title}".`, { title: chart.title, type: chart.type, data: getChartData(chart).slice(0, 5) });
            setDeepDiveResult({ id: chart.id, text: result });
        } catch (e) {
            console.error(e);
        } finally {
            setAiExplainingId(null);
        }
    };

    const [showShareModal, setShowShareModal] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopyLink = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleNativeShare = async () => {
        if (!shareUrl) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: dashboardName,
                    text: `Check out this dashboard analysis from Toeasy: ${dashboardName}`,
                    url: shareUrl,
                });
            } catch (err) {
                console.error('Error sharing:', err);
            }
        } else {
            handleCopyLink();
        }
    };

    const socialShares = [
        {
            name: 'WhatsApp',
            icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.45L0 24l6.835-1.794c1.516.827 3.215 1.263 4.946 1.263h0c6.557 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.415-8.412',
            color: '#25D366',
            action: (url: string) => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out this dashboard analysis from Toeasy: ${url}`)}`, '_blank')
        },
        {
            name: 'LinkedIn',
            icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
            color: '#0077B5',
            action: (url: string) => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank')
        },
        {
            name: 'X',
            icon: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.497h2.039L6.486 3.24H4.298L17.607 20.65z',
            color: '#000000',
            action: (url: string) => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Dashboard analysis from Toeasy: ${url}`)}`, '_blank')
        }
    ];

    const handleShare = async () => {
        if (!config || isSharing) return;
        setIsSharing(true);
        try {
            // Capture frozen snapshot
            const snapshot = {
                kpis: (dynamicKPIs || []).map(k => ({ label: k.label, value: k.value, change: (k as any).change })),
                charts: (config.charts || []).map(c => ({
                    type: c.type,
                    title: c.title,
                    data: getChartData(c),
                    spec: c
                }))
            };

            const response = await sharingAPI.create({
                resourceType: 'dashboard',
                resourceId: dataset.id, // Or dashboard ID if exists
                workspaceId,
                title: dashboardName,
                snapshot
            });

            setShareUrl(response.data.publicUrl);
            setShowShareModal(true);
        } catch (err) {
            console.error('Sharing failed:', err);
            alert('Failed to generate share link');
        } finally {
            setIsSharing(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center bg-slate-950 text-white/50 animate-pulse">Establishing Neural Link...</div>;

    if (!config) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#080c14] transition-colors p-6">
                <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-indigo-600/10 border-2 border-dashed border-indigo-500/30 rounded-[32px] flex items-center justify-center mx-auto group">
                        <svg className="w-12 h-12 text-indigo-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-3">Analysis Drafting</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
                            No visual insights have been drafted for this dataset yet. Use the Toeasy AI to automatically generate a professional dashboard.
                        </p>
                    </div>
                    <div className="pt-4">
                        <button
                            onClick={() => loadOrGenerate(true)}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-3 mx-auto"
                        >
                            <span>✨ Generate Dashboard</span>
                        </button>
                        <p className="text-[10px] text-slate-400 mt-4 uppercase tracking-widest font-bold opacity-50 italic">Generated analysis will be saved forever</p>
                    </div>
                </div>
            </div>
        );
    }

    const visibleCharts = config.charts || [];

    return (
        <div className={`h-full overflow-y-auto bg-slate-50 dark:bg-[#080c14] pb-40 relative no-scrollbar ${isCinematicMode ? 'overflow-hidden' : ''}`}>

            {/* Share Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-lg shadow-4xl border border-slate-200 dark:border-white/10 animate-in zoom-in-95">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Share Analysis</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Share this dashboard with anyone</p>
                                </div>
                            </div>
                            <button onClick={() => setShowShareModal(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="space-y-8">
                            {/* Premium Social Share Row */}
                            <div className="flex justify-between gap-4">
                                {socialShares.map((social) => (
                                    <button
                                        key={social.name}
                                        onClick={() => social.action(shareUrl || '')}
                                        className="flex-1 flex flex-col items-center gap-2 group"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-lg" style={{ '--hover-color': social.color } as any}>
                                            <svg className="w-6 h-6 transition-colors group-hover:text-[var(--hover-color)]" fill="currentColor" viewBox="0 0 24 24">
                                                <path d={social.icon} />
                                            </svg>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                            {social.name}
                                        </span>
                                    </button>
                                ))}
                                {(navigator as any).share && (
                                    <button
                                        onClick={handleNativeShare}
                                        className="flex-1 flex flex-col items-center gap-2 group"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white transition-all group-hover:scale-110 group-hover:shadow-lg group-hover:bg-indigo-500">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">More</span>
                                    </button>
                                )}
                            </div>

                            <div className="p-5 bg-slate-950/5 dark:bg-white/5 rounded-[24px] border border-slate-200/50 dark:border-white/5 flex flex-col gap-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Magic Share Link</p>
                                <div className="flex items-center gap-4">
                                    <input
                                        readOnly
                                        value={shareUrl || ''}
                                        className="flex-1 bg-transparent border-none text-sm font-bold text-slate-900 dark:text-white outline-none truncate"
                                    />
                                    <button
                                        onClick={handleCopyLink}
                                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${copySuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-105 active:scale-95'}`}
                                    >
                                        {copySuccess ? '✓ COPIED' : 'COPY'}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-200/50 dark:border-amber-900/20">
                                <div className="flex gap-3">
                                    <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    <p className="text-xs text-amber-800 dark:text-amber-200/70 leading-relaxed font-medium">
                                        This is a <strong>frozen snapshot</strong>. Any changes you make to this dashboard hereafter will not be reflected in this specific link. You will need to generate a new link to share updates.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <a
                                    href={shareUrl || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-center hover:scale-[1.02] transition-all"
                                >
                                    Open Preview
                                </a>
                                <button
                                    onClick={() => setShowShareModal(false)}
                                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ULTRA-SLIM PROFESSIONAL HEADER */}
            <div className={`sticky top-0 z-[100] px-6 py-2.5 bg-white/60 dark:bg-slate-950/60 backdrop-blur-3xl border-b border-slate-200/50 dark:border-white/5 no-print transition-all`}>
                <div className="flex items-center justify-between gap-6 max-w-[1800px] mx-auto">

                    {/* Dashboard Identity */}
                    <div className="flex items-center gap-3">
                        {isEditingTitle ? (
                            <input
                                autoFocus
                                value={dashboardName}
                                onChange={e => setDashboardName(e.target.value)}
                                onBlur={() => {
                                    setIsEditingTitle(false);
                                    if (onUpdate && config) onUpdate({ ...dataset, dashboardConfig: config });
                                }}
                                onKeyDown={e => e.key === 'Enter' && setIsEditingTitle(false)}
                                className="text-sm font-black uppercase tracking-tight bg-white/20 dark:bg-slate-800/80 border-b-2 border-indigo-500 rounded px-2 outline-none w-[200px]"
                            />
                        ) : (
                            <h2 onClick={() => setIsEditingTitle(true)} className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white cursor-pointer hover:text-indigo-500 transition-all flex items-center gap-2 group">
                                {dashboardName}
                                <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </h2>
                        )}
                    </div>

                    {/* Compact Filter Stack */}
                    <div className="flex-1 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
                        <FilterPanel
                            filters={config?.filters || []}
                            activeFilters={activeFilters}
                            onFilterChange={(col, val) => setActiveFilters(prev => ({ ...prev, [col]: val }))}
                            onClearAll={() => setActiveFilters({})}
                            onAddFilter={() => setIsFilterStudioOpen(true)}
                            onRemoveFilter={handleRemoveFilter}
                            isEditMode={isEditingFilters}
                        />
                        <button onClick={() => setIsEditingFilters(!isEditingFilters)} className={`p-1 rounded-lg transition-all ${isEditingFilters ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                    </div>

                    {/* Pro Buttons */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsForecastMode(!isForecastMode)} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${isForecastMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-100 dark:bg-slate-900 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                            <span>{isForecastMode ? 'FORECAST ACTIVE' : 'PREDICTIVE'}</span>
                        </button>
                        <button
                            onClick={() => loadOrGenerate(true)}
                            disabled={loading}
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50`}
                        >
                            <span>{loading ? 'REBUILDING...' : 'REBUILD AI'}</span>
                        </button>
                        <button onClick={() => setIsCinematicMode(true)} className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all">BOARDROOM</button>
                        <button
                            onClick={handleShare}
                            disabled={isSharing}
                            className={`p-1.5 rounded-lg transition-colors ${isSharing ? 'animate-pulse bg-indigo-100 dark:bg-indigo-900/30' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                            title="Share Dashboard Link"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                        </button>
                        <button onClick={() => setShowExportModal(true)} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4h14" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT CANVAS */}
            <div className="p-6 md:p-10 max-w-[1800px] mx-auto space-y-10 animate-in fade-in duration-700">

                {/* Forensic Health Stripe */}
                {dataQuality && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                        <div className={`w-2 h-2 rounded-full ${dataQuality.overallScore >= 80 ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{dataQuality.overallScore}% Integrity Score • {filteredData.length.toLocaleString()} Operational Records • Active Filters: {Object.keys(activeFilters).length || 'None'}</span>
                    </div>
                )}

                {/* KPI Strip */}
                <div className="flex flex-wrap gap-4">
                    {dynamicKPIs.map((kpi) => (
                        <div key={kpi.id} className="min-w-[180px] flex-1">
                            <KPICard kpi={kpi} dataset={dataset} columns={dataset.headers} onUpdate={handleUpdateKPI} onDelete={handleRemoveKPI} />
                        </div>
                    ))}
                    <button onClick={handleAddKPI} className="px-6 py-4 rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:border-indigo-500 hover:text-indigo-500 transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2">+ Metric</button>
                </div>

                {/* Unified Masonry Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8 pb-32">
                    {visibleCharts.map((chart, i) => {
                        const data = getChartData(chart);
                        const isWide = i % 3 === 0;
                        return (
                            <div key={chart.id} className={`glass-card p-8 rounded-[32px] min-h-[480px] flex flex-col group relative ${isWide ? 'md:col-span-2' : ''} border border-slate-200 dark:border-white/5`}>
                                <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2">
                                    <button onClick={() => setEditingChartId(chart.id)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                </div>
                                <div className="mb-8">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">{chart.title}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{chart.description || `Relational context: ${chart.xAxis} vs ${chart.yAxis}`}</p>
                                </div>
                                <div className="flex-1 w-full relative min-h-[300px]">
                                    <PlotlyChart chart={injectChartConfig(chart)} data={data} onClick={(data) => handleChartClick(data, chart)} />
                                </div>
                            </div>
                        );
                    })}

                    <button onClick={() => setIsCreatingNew(true)} className="bg-slate-50 dark:bg-slate-950/30 border-4 border-dashed border-slate-100 dark:border-slate-800/50 rounded-[40px] flex flex-col items-center justify-center p-12 hover:border-indigo-500/50 hover:bg-white dark:hover:bg-slate-900 transition-all group min-h-[480px]">
                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform group-hover:bg-indigo-600 group-hover:text-white"><span className="text-4xl">+</span></div>
                        <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-500">Add Analysis</h3>
                    </button>
                </div>
            </div>

            {/* Global Perspective AI (Floating Input) */}
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-[200]">
                <div className="bg-slate-900 dark:bg-white p-1.5 rounded-full shadow-3xl flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-inner">
                        {isDashboardThinking ? <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" /> : <span className="text-lg text-slate-900 dark:text-white">✨</span>}
                    </div>
                    <form onSubmit={handleGlobalDashboardPrompt} className="flex-1">
                        <input value={dashboardPrompt} onChange={e => setDashboardPrompt(e.target.value)} placeholder="Describe a chart to build..." className="w-full bg-transparent border-none outline-none text-sm font-medium text-white dark:text-slate-900 placeholder-white/30 dark:placeholder-slate-400" />
                    </form>
                    <button onClick={handleGlobalDashboardPrompt} disabled={!dashboardPrompt || isDashboardThinking} className="px-6 py-2.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50">Draft</button>
                </div>
            </div>

            {/* Modal Components */}
            {(editingChartId || isCreatingNew) && <ChartBuilderPanel dataset={dataset} initialChart={isCreatingNew ? undefined : (config.charts || []).find(c => c.id === editingChartId)} onSave={handleSaveChart} onCancel={() => { setEditingChartId(null); setIsCreatingNew(false); }} onAIAction={onAIAction} />}
            {viewingDataChart && <DataPeekModal chart={viewingDataChart} data={getChartData(viewingDataChart)} onClose={() => setViewingDataChart(null)} />}

            {/* Filter Studio Overlay */}
            {isFilterStudioOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-[48px] p-12 w-full max-w-lg shadow-4xl border border-slate-200 dark:border-white/5 animate-in zoom-in-95">
                        <div className="flex justify-between items-start mb-10">
                            <div><h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Filter Studio</h3><p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">Select dimensions for slicing</p></div>
                            <button onClick={() => setIsFilterStudioOpen(false)} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all">✕</button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                            {dataset.headers.map(col => {
                                const active = config?.filters?.some(f => f.column === col);
                                return (
                                    <button key={col} disabled={active} onClick={() => handleAddFilter(col)} className={`flex items-center justify-between p-5 rounded-3xl border transition-all text-left group ${active ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-50' : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-indigo-500/10'}`}>
                                        <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[11px] font-black group-hover:bg-indigo-600 group-hover:text-white transition-all">{col.substring(0, 2).toUpperCase()}</div><span className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-300">{col}</span></div>
                                        {active ? <span className="text-[10px] font-black text-slate-400">IN USE</span> : <span className="text-[10px] font-black text-indigo-500 opacity-0 group-hover:opacity-100">ENABLE +</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Boardroom Overlay */}
            {isCinematicMode && (
                <div className="fixed inset-0 z-[400] bg-white dark:bg-[#040810] flex flex-col p-12 animate-in fade-in duration-700">
                    <div className="flex justify-between items-center mb-16">
                        <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-3xl bg-indigo-600 flex items-center justify-center text-3xl shadow-2xl">🎬</div><div><h1 className="text-3xl font-black uppercase text-slate-900 dark:text-white leading-none">The Boardroom</h1><p className="text-[10px] text-slate-500 mt-2 uppercase tracking-[0.3em] font-black">Strategic Intelligence Series</p></div></div>
                        <button onClick={() => setIsCinematicMode(false)} className="w-14 h-14 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-500 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center max-w-7xl mx-auto w-full">
                        <div className="w-full glass-card !p-16 rounded-[64px] shadow-4xl flex-1 flex flex-col bg-white/50 dark:bg-slate-900/50">
                            <h2 className="text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-12 text-center">{visibleCharts[activeCinematicIndex]?.title}</h2>
                            <div className="flex-1 min-h-[400px]"><PlotlyChart chart={injectChartConfig(visibleCharts[activeCinematicIndex])} data={getChartData(visibleCharts[activeCinematicIndex])} height={600} /></div>
                        </div>
                    </div>
                    <div className="flex justify-center gap-10 py-12">
                        <button disabled={activeCinematicIndex === 0} onClick={() => setActiveCinematicIndex(prev => prev - 1)} className="w-16 h-16 rounded-full border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:border-indigo-500 hover:text-indigo-500 transition-all disabled:opacity-20"><svg className="w-8 h-8 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M9 5l7 7-7 7" /></svg></button>
                        <div className="flex gap-4 items-center">
                            {visibleCharts.slice(0, 8).map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === activeCinematicIndex ? 'w-12 bg-indigo-600' : 'w-2 bg-slate-200 dark:bg-slate-800'}`} />)}
                        </div>
                        <button disabled={activeCinematicIndex === visibleCharts.length - 1} onClick={() => setActiveCinematicIndex(prev => prev + 1)} className="w-16 h-16 rounded-full border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:border-indigo-500 hover:text-indigo-500 transition-all disabled:opacity-20"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M9 5l7 7-7 7" /></svg></button>
                    </div>
                </div>
            )}
        </div>
    );

};

export default DashboardView;
