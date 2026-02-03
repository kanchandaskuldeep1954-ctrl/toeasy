
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Responsive, WidthProvider } from 'react-grid-layout';
import {
    BarChart3,
    LineChart,
    PieChart,
    MoreVertical,
    Maximize2,
    Type,
    Download,
    Share2,
    Plus,
    Layout,
    Sparkles,
    Palette,
    Settings2,
    Hash,
    X
} from 'lucide-react';
import { Dataset, ChartSpec, KPI, DataRow, DashboardConfig, Pattern } from '../types';
import { GroqService } from '../services/groqService';
import { validateChartSpec, assessDataQuality, generateChartInsights } from '../src/utils/chartValidation';
import { SmartChart } from './Dashboard/SmartChart';
import ChartPalette, { ChartType } from './Dashboard/ChartPalette';
import FieldBindingPanel from './Dashboard/FieldBindingPanel';
import AILayoutSuggester from './Dashboard/AILayoutSuggester';
import { PremiumKPI } from './Dashboard/PremiumKPI';
import { KPICard } from './Dashboard/KPICard';
import { FilterPanel } from './Dashboard/FilterPanel';
import { InsightCard } from './Dashboard/InsightCard';
import { ChartBuilderPanel } from './Dashboard/ChartBuilderPanel';
import { DataPeekModal } from './Dashboard/DataPeekModal';
import { DataEditorModal } from './Dashboard/DataEditorModal';
import { aggregateData } from '../src/utils/dashboardHelper';
import { sharingAPI, dashboardAPI } from '../src/services/api';
import { useSearchParams } from 'react-router-dom';
import ExportModal from '../src/components/ExportHub/ExportModal';
import { ExportService } from '../src/services/exportService';
import { QnAWidget } from './Dashboard/QnAWidget';

interface DashboardViewProps {
    dataset: Dataset;
    dashboardId?: string;
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

const DashboardView: React.FC<DashboardViewProps> = ({ dataset, dashboardId: propDashboardId, onAIAction, onUpdate }) => {
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

    const [aiExplainingId, setAiExplainingId] = useState<string | null>(null);
    const [deepDiveResult, setDeepDiveResult] = useState<{ id: string, text: string } | null>(null);
    const [isForecastMode, setIsForecastMode] = useState(false);
    const [isCinematicMode, setIsCinematicMode] = useState(0);
    const [activeCinematicIndex, setActiveCinematicIndex] = useState(0);
    const [editMode, setEditMode] = useState(false);
    const [globalTheme, setGlobalTheme] = useState<'indigo' | 'emerald' | 'vibrant' | 'minimal' | 'dark' | 'light'>('indigo');

    const [dashboardPrompt, setDashboardPrompt] = useState('');
    const [isDashboardThinking, setIsDashboardThinking] = useState(false);
    const [kpiPrompt, setKpiPrompt] = useState('');
    const [isKpiThinking, setIsKpiThinking] = useState(false);

    const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});

    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace') || '';

    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    // Versioning & Persistence State
    const [dashboardId, setDashboardId] = useState<string | null>(propDashboardId || null);
    const [layout, setLayout] = useState<any[]>([]);
    const [charts, setCharts] = useState<ChartSpec[]>([]);
    const [kpis, setKpis] = useState<KPI[]>([]);

    // Tableau-level Integration State
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [isBindingOpen, setIsBindingOpen] = useState(false);
    const [isSuggesterOpen, setIsSuggesterOpen] = useState(false);
    const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
    const [chartBindings, setChartBindings] = useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [versionName, setVersionName] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [forceManual, setForceManual] = useState(false);

    // Chart/Data Editing State
    const [editingChartId, setEditingChartId] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [isEditingRawData, setIsEditingRawData] = useState(false);
    const [viewingDataChart, setViewingDataChart] = useState<ChartSpec | null>(null);

    // KPI Editing State
    const [isEditingKPI, setIsEditingKPI] = useState(false);
    const [editKPIConfig, setEditKPIConfig] = useState<KPI | null>(null);

    const [dragGhost, setDragGhost] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [draggingChartId, setDraggingChartId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleSaveChart = useCallback((newChart: ChartSpec) => {
        if (!config) return;
        const updatedCharts = (config.charts || []).map(c => c.id === newChart.id ? newChart : c);
        if (!updatedCharts.find(c => c.id === newChart.id)) updatedCharts.unshift(newChart);

        const newConfig = { ...config, charts: updatedCharts };
        setConfig(newConfig);
        if (onUpdate) onUpdate({ ...dataset, dashboardConfig: newConfig });
        setEditingChartId(null); setIsCreatingNew(false);
    }, [config, dataset, onUpdate]);

    const filteredData = useMemo(() => {
        let data = dataset.data || [];
        if (!Array.isArray(data) || Object.keys(activeFilters).length === 0) return data;

        return data.filter(row => {
            if (!row) return false;
            return Object.entries(activeFilters).every(([key, value]) => {
                if (value === null || value === '') return true;
                return String(row[key] || '') === String(value);
            });
        });
    }, [dataset.data, activeFilters]);

    const dynamicKPIs = useMemo(() => {
        if (!config?.kpis || !Array.isArray(config.kpis)) return [];

        return config.kpis.map(kpi => {
            if (!kpi.calculation || !kpi.calculation.column) return kpi;

            const col = kpi.calculation.column;
            const op = kpi.calculation.operation;
            const parseSafe = (val: any) => {
                if (typeof val === 'number') return val;
                if (!val) return NaN;
                const clean = String(val).replace(/[$,%]/g, '').trim();
                return parseFloat(clean);
            };

            const values = (filteredData || []).map(r => parseSafe(r ? r[col] : null)).filter(n => !isNaN(n));

            let newVal = 0;
            if (op === 'sum') newVal = values.reduce((a, b) => a + b, 0);
            else if (op === 'avg') newVal = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            else if (op === 'count') newVal = filteredData.length;
            else if (op === 'max') newVal = values.length ? Math.max(...values) : 0;
            else if (op === 'min') newVal = values.length ? Math.min(...values) : 0;
            else if (op === 'unique') newVal = new Set((filteredData || []).map(r => r ? r[col] : null)).size;

            let fmtVal = newVal.toLocaleString();
            if (kpi.calculation.format === 'currency') fmtVal = `$${newVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            else if (kpi.calculation.format === 'percentage') fmtVal = `${newVal.toFixed(1)}%`;
            else fmtVal = newVal.toLocaleString(undefined, { maximumFractionDigits: 1 });

            return { ...kpi, value: fmtVal };
        });
    }, [config?.kpis, filteredData]);

    const normalizedCharts = useMemo(() => {
        const rawCharts = config?.charts || [];
        const grid: Set<string> = new Set();

        // Helper to check if a rect is occupied
        const isOccupied = (x: number, y: number, w: number, h: number) => {
            for (let i = x; i < x + w; i++)
                for (let j = y; j < y + h; j++)
                    if (grid.has(`${i},${j}`)) return true;
            return false;
        };

        // Helper to mark a rect as occupied
        const occupy = (x: number, y: number, w: number, h: number) => {
            for (let i = x; i < x + w; i++)
                for (let j = y; j < y + h; j++)
                    grid.add(`${i},${j}`);
        };

        const findGap = (w: number, h: number) => {
            let ry = 0;
            while (true) {
                for (let rx = 0; rx <= 12 - w; rx++) {
                    if (!isOccupied(rx, ry, w, h)) return { x: rx, y: ry };
                }
                ry++;
                if (ry > 1000) return { x: 0, y: 0 };
            }
        };

        // Separate dragging chart from others for priority
        const activeChart = draggingChartId && dragGhost ? rawCharts.find(c => c.id === draggingChartId) : null;
        const otherCharts = rawCharts.filter(c => c.id !== draggingChartId);

        const results: any[] = [];

        // 1. Priority: Place the dragging chart exactly at its ghost position
        if (activeChart && dragGhost) {
            const { x, y, w, h } = dragGhost;
            occupy(x, y, w, h);
            results.push({ ...activeChart, layout: { ...activeChart.layout, x, y, w, h } });
        }

        // 2. Secondary: Place charts that have valid, non-colliding positions
        otherCharts.forEach(chart => {
            let w = chart.layout?.w || 6;
            let h = chart.layout?.h || 6;

            // Sync with legacy sizes if necessary
            if (!chart.layout?.w) {
                if (chart.size === 'small') w = 3;
                else if (chart.size === 'medium') w = 6;
                else if (chart.size === 'large') w = 9;
                else if (chart.size === 'full') w = 12;
            }
            w = Math.max(2, Math.min(12, w));
            h = Math.max(2, h);

            let x = chart.layout?.x;
            let y = chart.layout?.y;

            // If it fits where it is, keep it
            if (x !== undefined && y !== undefined && !isOccupied(x, y, w, h)) {
                occupy(x, y, w, h);
                results.push({ ...chart, layout: { ...chart.layout, x, y, w, h } });
            } else {
                // Otherwise find a new gap
                const gap = findGap(w, h);
                occupy(gap.x, gap.y, w, h);
                results.push({ ...chart, layout: { ...chart.layout, x: gap.x, y: gap.y, w, h } });
            }
        });

        // Ensure order matches original to prevent component unmounting
        return rawCharts.map(rc => results.find(res => res.id === rc.id) || rc);

    }, [config?.charts, draggingChartId, dragGhost]);

    const isMounted = React.useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const loadOrGenerate = async (force: boolean = false) => {
        setLoading(true);
        try {
            // PRIORITY 1: Load from backend API if dashboardId is available
            if (propDashboardId && workspaceId && !force) {
                try {
                    const res = await dashboardAPI.get(workspaceId, propDashboardId);
                    const dash = res.data?.data || res.data;
                    if (dash && dash.layout) {
                        setConfig(dash.layout);
                        setDashboardName(dash.name || cleanName + ' Dashboard');
                        setDashboardId(dash.id);
                        setLoading(false);
                        return;
                    }
                } catch (apiErr) {
                    console.warn('Could not load dashboard from API, falling back to dataset config:', apiErr);
                }
            }

            // PRIORITY 2: Load from dataset.dashboardConfig (legacy support)
            if (!force && dataset.dashboardConfig) {
                setConfig(dataset.dashboardConfig);
                if (dataset.dashboardConfig.name) setDashboardName(dataset.dashboardConfig.name);
                setLoading(false);
                return;
            }

            // PRIORITY 3: If no config and not forced, show empty draft state
            if (!force && !dataset.dashboardConfig) {
                setLoading(false);
                return;
            }

            // GENERATE NEW DASHBOARD (when force=true)
            if (onAIAction) onAIAction();
            const generatedConfig = await GroqService.suggestDashboard(dataset);
            if (!isMounted.current) return;

            if (generatedConfig.name) setDashboardName(generatedConfig.name);
            setConfig(generatedConfig);

            // Try to persist to backend as new dashboard
            if (workspaceId) {
                try {
                    const createRes = await dashboardAPI.create(workspaceId, {
                        name: generatedConfig.name || (cleanName + ' Dashboard'),
                        dataset_id: dataset.id,
                        is_primary: true,
                        layout: generatedConfig
                    });
                    const newDash = createRes.data?.data || createRes.data;
                    if (newDash?.id) setDashboardId(newDash.id);
                } catch (persistErr) {
                    console.warn('Failed to persist generated dashboard:', persistErr);
                }
            }

            // Legacy callback
            if (onUpdate) onUpdate({ ...dataset, dashboardConfig: generatedConfig });
        } catch (e) {
            console.error('Dashboard Load/Generate Error:', e);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    useEffect(() => {
        // Sync name
        if (!dataset.dashboardConfig && !propDashboardId) {
            setDashboardName(cleanName + ' Dashboard');
        } else if (dataset.dashboardConfig?.name) {
            setDashboardName(dataset.dashboardConfig.name);
        }

        // Trigger load
        loadOrGenerate(false);
    }, [dataset.id, propDashboardId]);

    useEffect(() => {
        if (!config || !dataset) return;
        const quality = assessDataQuality(dataset.data || [], dataset.headers || []);
        setDataQuality(quality);
        const validations: { [id: string]: any } = {};
        (config.charts || []).forEach((chart) => {
            if (chart) validations[chart.id] = validateChartSpec(chart, dataset.data || [], dataset.headers || []);
        });
        setChartValidations(validations);
    }, [config, dataset]);

    // Auto-save to backend when config changes
    useEffect(() => {
        if (!config || !dashboardId || loading) return;

        const timer = setTimeout(async () => {
            try {
                setIsSaving(true);
                await dashboardAPI.update(workspaceId, dashboardId, {
                    name: dashboardName,
                    layout: config
                });
                setLastSaved(new Date());
            } catch (err) {
                console.error('Auto-save failed:', err);
            } finally {
                setIsSaving(false);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [config, dashboardName, dashboardId, workspaceId, loading]);

    // Commit Version Handler
    const handleCommitVersion = async () => {
        if (!dashboardId || !versionName.trim() || !workspaceId) return;
        setIsCommitting(true);
        try {
            await dashboardAPI.createVersion(workspaceId, dashboardId, {
                name: versionName,
                config: config
            });
            setShowVersionModal(false);
            setVersionName('');
            alert('Version saved successfully!');
        } catch (err) {
            console.error('Commit failed:', err);
            alert('Failed to save version.');
        } finally {
            setIsCommitting(false);
        }
    };

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

    const handleResizeChart = (chartId: string, w: number, h: number) => {
        if (!config) return;
        const updatedCharts = (config.charts || []).map(c =>
            c.id === chartId ? { ...c, layout: { ...c.layout, w, h } } : c
        );
        setConfig({ ...config, charts: updatedCharts });
    };

    const handleDeleteChart = (chartId: string) => {
        if (!config) return;
        const updatedCharts = (config.charts || []).filter(c => c.id !== chartId);
        setConfig({ ...config, charts: updatedCharts });
    };

    const toggleTheme = (theme: any) => {
        if (!config) return;
        setGlobalTheme(theme);
        setConfig({ ...config, theme });
    };

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
        const firstCol = (dataset.headers || [])[0] || '';
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
            options: Array.from(new Set((dataset.data || []).map(r => r ? String(r[column] || '') : ''))).filter(v => v !== '').slice(0, 50)
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
                charts: (config.charts || []).map(c => {
                    if (!c) return null;
                    return {
                        type: c.type,
                        title: c.title,
                        data: getChartData(c),
                        spec: c
                    };
                }).filter(Boolean)
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

    // Show drafting screen if no config OR (empty config AND not forced manual)
    const isEmptyConfig = config && (!config.charts || config.charts.length === 0) && (!config.kpis || config.kpis.length === 0);
    const showDrafting = !config || (isEmptyConfig && !forceManual);

    if (showDrafting) {
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
                    <div className="pt-4 flex flex-col items-center gap-4">
                        <button
                            onClick={() => loadOrGenerate(true)}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-3"
                        >
                            <span>✨ Generate Dashboard</span>
                        </button>
                        <button
                            onClick={() => setForceManual(true)}
                            className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-indigo-500 transition-colors"
                        >
                            Start Manually →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const visibleCharts = normalizedCharts;

    // Tableau-style Handlers
    const handleChartTypeSelect = (chartType: ChartType) => {
        const newChart: ChartSpec = {
            id: `chart-${Date.now()}`,
            type: chartType.id as any,
            title: `New ${chartType.name}`,
            dataKeys: { x: '', y: '' }, // Waiting for binding
            i: `chart-${Date.now()}`,
            x: 0,
            y: Infinity, // Puts it at bottom
            w: 6,
            h: 4
        };

        setCharts(prev => [...prev, newChart]);
        setLayout(prev => [...prev, { i: newChart.id, x: newChart.x, y: newChart.y, w: newChart.w, h: newChart.h, minW: 3, minH: 3 }]);
        setSelectedChartId(newChart.id);
        setIsPaletteOpen(false);
        setIsBindingOpen(true); // Open binding immediately
    };

    const handleApplyLayout = (newLayout: any[]) => {
        // Convert preview layout to actual RGL layout
        // This assumes generation logic matches IDs
        setLayout(newLayout.map(l => ({ ...l, i: l.i || `item-${Math.random()}` })));
        setIsSuggesterOpen(false);
    };

    const handleBindingChange = (bindings: any) => {
        if (!selectedChartId) return;

        setCharts(prev => prev.map(c => {
            if (c.id === selectedChartId) {
                return {
                    ...c,
                    dataKeys: {
                        x: bindings.xAxis || c.dataKeys.x,
                        y: bindings.yAxis || c.dataKeys.y
                    },
                    // Store extended bindings in a separate property if ChartSpec supported it
                    // For now, we fit into existing structure
                };
            }
            return c;
        }));
    };

    const renderChart = (chart: ChartSpec) => {
        // This is a placeholder. In a real app, you'd render SmartChart here
        // with the appropriate data and props.
        return (
            <SmartChart
                chart={injectChartConfig(chart)}
                data={getChartData(chart)}
                onChartClick={(data) => handleChartClick(data, chart)}
                validation={chartValidations[chart.id]}
                onAiExplain={() => handleAiExplain(chart)}
                aiExplaining={aiExplainingId === chart.id}
                deepDiveResult={deepDiveResult?.id === chart.id ? deepDiveResult.text : null}
                dataset={dataset}
            />
        );
    };

    const ResponsiveGridLayout = WidthProvider(Responsive);


return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 transition-colors relative overflow-hidden">
        {/* Integrated Header Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm z-30 shrink-0">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                    <Layout className="w-5 h-5 text-indigo-500" />
                    {dashboardName}
                </h1>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

                {/* Quick Tools */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setIsPaletteOpen(true)}
                        className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-all tooltip"
                        title="Add Chart"
                    >
                        <BarChart3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsSuggesterOpen(true)}
                        className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-all tooltip"
                        title="AI Layout"
                    >
                        <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleAddKPI}
                        className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-all tooltip"
                        title="Add KPI"
                    >
                        <Hash className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={handleShare} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all">
                    <Share2 className="w-4 h-4" />
                    Share
                </button>
                <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all">
                    <Download className="w-4 h-4" />
                    Export
                </button>
                <button onClick={onAIAction} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95">
                    <Sparkles className="w-4 h-4" />
                    Ask Agent
                </button>
            </div>
        </div>

        {/* Main Content with Side Panels */}
        <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0 overflow-y-auto p-6 custom-scrollbar pb-32">

                {/* KPI Strip */}
                <div className="flex flex-wrap gap-4 px-2 mb-6">
                    {(config?.kpis || []).map((kpi, idx) => {
                        if (!kpi) return null;
                        const dynamicVal = dynamicKPIs.find(k => k.id === kpi.id)?.value || kpi.value;
                        return (
                            <div
                                key={kpi.id}
                                className="min-w-[200px] flex-1 animate-in slide-in-from-bottom-4 fade-in duration-700 fill-mode-both"
                                style={{ animationDelay: `${idx * 150}ms` }}
                            >
                                <PremiumKPI
                                    kpi={{ ...kpi, value: dynamicVal }}
                                    dataset={dataset}
                                    onEdit={() => { setEditKPIConfig(kpi); setIsEditingKPI(true); }}
                                />
                            </div>
                        );
                    })}
                </div>

                <ResponsiveGridLayout
                    className="layout"
                    layouts={{ lg: layout }}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                    rowHeight={100}
                    onLayoutChange={(l) => setLayout(l)}
                    isDraggable={!isBindingOpen && !isPaletteOpen}
                    isResizable={!isBindingOpen && !isPaletteOpen}
                    draggableHandle=".drag-handle"
                >
                    {charts.map(chart => (
                        <div key={chart.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col group relative z-10">
                            {/* Selection Frame */}
                            {selectedChartId === chart.id && (
                                <div className="absolute inset-0 border-2 border-indigo-500 rounded-2xl pointer-events-none z-20 animate-pulse"></div>
                            )}

                            <div className="drag-handle p-4 cursor-move border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate">{chart.title}</h3>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedChartId(chart.id); setIsBindingOpen(true); }}
                                        className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors"
                                    >
                                        <Settings2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleAiExplain(chart); }} className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors">
                                        <Sparkles className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteChart(chart.id); }} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 p-2 min-h-0 overflow-hidden relative">
                                {renderChart(chart)}
                                {/* Resize Handle Indicator */}
                                <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <Maximize2 className="w-3 h-3 text-slate-300 rotate-90" />
                                </div>
                            </div>
                        </div>
                    ))}
                </ResponsiveGridLayout>

                {layout.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <Layout className="w-16 h-16 text-slate-300 mb-4" />
                        <p className="text-slate-400 text-lg font-medium">Dashboard is empty</p>
                        <button onClick={() => setIsSuggesterOpen(true)} className="mt-4 text-indigo-500 font-bold hover:underline">
                            Auto-Generate Layout
                        </button>
                    </div>
                )}
            </div>

            {/* Tableau-style Side Panels */}
            <ChartPalette
                isOpen={isPaletteOpen}
                onClose={() => setIsPaletteOpen(false)}
                onChartSelect={handleChartTypeSelect}
            />

            <FieldBindingPanel
                isOpen={isBindingOpen}
                onClose={() => setIsBindingOpen(false)}
                columns={dataset.headers}
                currentBindings={charts.find(c => c.id === selectedChartId)?.dataKeys as any || {}}
                onBindingChange={handleBindingChange}
            />

            <AILayoutSuggester
                isOpen={isSuggesterOpen}
                onClose={() => setIsSuggesterOpen(false)}
                dataset={dataset}
                onApplyLayout={handleApplyLayout}
            />
        </div>

        {/* Modals */}
        {(editingChartId || isCreatingNew) && <ChartBuilderPanel dataset={dataset} initialChart={isCreatingNew ? undefined : (config?.charts || []).find(c => c.id === editingChartId)} onSave={handleSaveChart} onCancel={() => { setEditingChartId(null); setIsCreatingNew(false); }} onAIAction={onAIAction} />}
        {viewingDataChart && <DataPeekModal chart={viewingDataChart} data={getChartData(viewingDataChart)} onClose={() => setViewingDataChart(null)} />}
        {isEditingRawData && <DataEditorModal dataset={dataset} onSave={(newData) => { onUpdate?.({ ...dataset, data: newData }); setIsEditingRawData(false); }} onClose={() => setIsEditingRawData(false)} />}

        <ExportModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            exportType="dashboard"
            data={config}
            filename={`${dashboardName}_${new Date().toISOString().split('T')[0]}`}
            onExport={(format) => {
                if (format === 'pdf') {
                    ExportService.exportToPDF(dashboardName);
                } else if (format === 'csv') {
                    ExportService.exportToCSV(dataset, 'dashboard_data');
                }
            }}
        />

        {/* Share Modal */}
        {showShareModal && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-lg shadow-4xl border border-slate-200 dark:border-white/10 animate-in zoom-in-95">
                    <div className="flex justify-between items-start mb-6">
                        <div><h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Share Analysis</h3></div>
                        <button onClick={() => setShowShareModal(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="p-5 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center gap-3">
                        <input readOnly value={shareUrl || ''} className="flex-1 bg-transparent border-none text-sm font-bold outline-none" />
                        <button onClick={() => { navigator.clipboard.writeText(shareUrl || ''); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }} className="text-xs font-bold bg-indigo-500 text-white px-3 py-1.5 rounded-lg">{copySuccess ? 'COPIED' : 'COPY'}</button>
                    </div>
                </div>
            </div>
        )}
    </div>
);
};

export default DashboardView;
