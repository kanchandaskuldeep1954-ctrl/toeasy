import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import UniversalDashboardGrid from './Dashboard/UniversalDashboardGrid';
import { Dataset, DashboardConfig, WidgetSpec, WidgetType, ChartSpec } from '../../types';
import { dashboardAPI, datasetAPI } from '../services/api';
import { useDataset } from '../hooks/useDataset';
import { useWorkspaceRole } from '../hooks/useWorkspaceRole';
import { Plus, LayoutTemplate, Save, Edit3, X, FileText, Sparkles, BarChart3, PieChart, TrendingUp, Table2, RefreshCw } from 'lucide-react';
import { GroqService } from '../services/groqService';
import { reportsAPI } from '../services/api';
import { KPIWidget } from './Widgets/KPIWidget';

const DashboardViewIntegrated: React.FC = () => {
  const { token } = useAuth();
  const { isEditor } = useWorkspaceRole();
  const { activeDataset, setActiveDataset, updateDataset: updateDatasetCtx } = useDataset();
  const dataset = activeDataset as unknown as Dataset;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceId = searchParams.get('workspace') || '';
  const datasetId = searchParams.get('dataset') || '';
  const initialDashboardId = searchParams.get('id') || '';

  const [dashboardEntity, setDashboardEntity] = useState<any>(null);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>({ charts: [], kpis: [], patterns: [], widgets: [] });
  const [siblings, setSiblings] = useState<any[]>([]);

  // Version Control State
  const [dataVersions, setDataVersions] = useState<any[]>([]);
  const [selectedDataVersionId, setSelectedDataVersionId] = useState<string | null>(searchParams.get('version') || null);

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isVersionSwitcherOpen, setIsVersionSwitcherOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode State
  const [isEditable, setIsEditable] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Auto-generate state
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  useEffect(() => {
    if (workspaceId && datasetId) {
      loadAll();
    }
  }, [workspaceId, datasetId, initialDashboardId, selectedDataVersionId]);

  const loadAll = async () => {
    try {
      setLoading(true);

      let targetDatasetId = datasetId;

      const safeParse = (val: any) => {
        if (!val) return undefined;
        if (typeof val === 'string') {
          try {
            const first = JSON.parse(val);
            return typeof first === 'string' ? JSON.parse(first) : first;
          } catch (e) { return undefined; }
        }
        return val;
      };

      // 1. Always hydrate dataset first
      if (targetDatasetId && workspaceId) {
        try {
          if (!dataset || String(dataset.id) !== String(targetDatasetId)) {
            const dsRes = await datasetAPI.get(workspaceId, targetDatasetId);
            const dsData = dsRes.data?.data || dsRes.data;

            const rawData = safeParse(dsData?.raw_data || dsData?.data) || [];
            const headers = safeParse(dsData?.headers) || (rawData && rawData[0] ? Object.keys(rawData[0]) : []);

            setActiveDataset({
              ...dsData,
              data: rawData,
              headers: headers,
            });
          }
        } catch (dsErr) {
          console.error('Failed to load dataset:', dsErr);
        }
      }

      // 2. Fetch specific dashboard if ID present
      let currentDashboard: any = null;
      if (initialDashboardId) {
        try {
          const dRes = await dashboardAPI.get(workspaceId, initialDashboardId);
          currentDashboard = dRes.data?.data || dRes.data;
          setDashboardEntity(currentDashboard);
          const cfg = safeParse(currentDashboard?.configuration) || currentDashboard?.configuration;
          if (cfg) {
            setDashboardConfig({
              charts: cfg.charts || [],
              kpis: cfg.kpis || [],
              patterns: cfg.patterns || [],
              widgets: cfg.widgets || [],
              ...cfg
            });
          }
        } catch (dErr) {
          console.error('Failed to load dashboard by ID:', dErr);
        }
      }

      // 3. Fetch sibling dashboards + versions (always do this)
      try {
        const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:3000/api';
        const [siblingsRes, versionsRes] = await Promise.all([
          dashboardAPI.list(workspaceId).catch(() => ({ data: { data: [] } })),
          axios.get(`${backendUrl}/workspaces/${workspaceId}/datasets/${targetDatasetId}/versions`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: { data: [] } }))
        ]);

        const allDashboards = siblingsRes?.data?.data || siblingsRes?.data || [];
        const safeDashboards = Array.isArray(allDashboards) ? allDashboards : [];
        const versions = versionsRes?.data?.data || (Array.isArray(versionsRes?.data) ? versionsRes.data : []);
        setDataVersions(versions);

        const dashSiblings = safeDashboards.filter((d: any) => d && String(d.dataset_id) === String(targetDatasetId));
        setSiblings(dashSiblings);

        // 4. If no dashboard loaded yet, discover one for this dataset
        if (!currentDashboard && dashSiblings.length > 0) {
          const primary = dashSiblings.find((d: any) => d.is_primary) || dashSiblings[0];
          if (primary) {
            currentDashboard = primary;
            setDashboardEntity(primary);
            const cfg = safeParse(primary.configuration) || primary.configuration;
            if (cfg) {
              setDashboardConfig({
                charts: cfg.charts || [],
                kpis: cfg.kpis || [],
                patterns: cfg.patterns || [],
                widgets: cfg.widgets || [],
                ...cfg
              });
            }
          }
        }
      } catch (sibErr) {
        console.error('Failed to load siblings/versions:', sibErr);
      }

      // 5. Ensure config is always valid
      if (!currentDashboard) {
        setDashboardConfig({ charts: [], kpis: [], patterns: [], widgets: [] });
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Check if dashboard is truly empty (no widgets, no charts, no KPIs)
  const isDashboardEmpty = useMemo(() => {
    const w = dashboardConfig?.widgets || [];
    const c = dashboardConfig?.charts || [];
    const k = dashboardConfig?.kpis || [];
    return w.length === 0 && c.length === 0 && k.length === 0;
  }, [dashboardConfig]);

  // Auto-generate a dashboard from dataset
  const handleAutoGenerate = async () => {
    if (!dataset || !dataset.data || dataset.data.length === 0) return;
    setIsAutoGenerating(true);

    try {
      const dashConfig = await GroqService.suggestDashboard(dataset);

      // Hydrate the charts with real data
      const hydratedCharts: ChartSpec[] = (dashConfig.charts || []).map((c: any, i: number) => ({
        ...c,
        id: c.id || `auto-chart-${Date.now()}-${i}`,
        data: c.data || aggregateData(c, dataset.data || [], dataset.headers || []),
        sourceModule: 'ai' as const
      }));

      const hydratedKpis = (dashConfig.kpis || []).map((k: any, i: number) => ({
        ...k,
        id: k.id || `auto-kpi-${Date.now()}-${i}`,
      }));

      // Build widgets from charts and KPIs
      const chartWidgets = hydratedCharts.map((c, i) => ({
        id: c.id!,
        type: 'chart' as const,
        title: c.title || `Chart ${i + 1}`,
        layout: { w: 6, h: 4, x: (i % 2) * 6, y: Math.floor(i / 2) * 4 + 2 },
        chart: c
      })) as WidgetSpec[];

      const kpiWidgets = hydratedKpis.map((k: any, i: number) => ({
        id: k.id,
        type: 'kpi' as const,
        title: k.title || `KPI ${i + 1}`,
        layout: { w: 4, h: 2, x: (i % 3) * 4, y: 0 },
        kpi: k
      })) as WidgetSpec[];

      const newConfig: DashboardConfig = {
        charts: hydratedCharts,
        kpis: hydratedKpis,
        widgets: [...kpiWidgets, ...chartWidgets],
        patterns: [],
      };

      setDashboardConfig(newConfig);

      // Save to backend
      try {
        const res = await dashboardAPI.create(workspaceId, {
          name: `${dataset.name || 'Dataset'} Dashboard`,
          description: 'AI-generated dashboard',
          dataset_id: datasetId,
          configuration: newConfig
        });
        const saved = res.data?.data || res.data;
        if (saved) {
          setDashboardEntity(saved);
        }
      } catch (saveErr) {
        console.warn('Dashboard created locally but save failed:', saveErr);
      }

    } catch (e) {
      console.error('Auto-generate failed:', e);
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const handleLayoutChange = (newWidgets: WidgetSpec[]) => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: newWidgets
    }));
  };

  const handleSaveDashboard = async () => {
    if (!dashboardEntity) return;
    setIsSaving(true);
    try {
      await dashboardAPI.update(workspaceId, dashboardEntity.id, {
        configuration: dashboardConfig
      });
      setIsEditable(false);
    } catch (e) {
      console.error("Failed to save dashboard", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWidget = (type: WidgetType) => {
    const newWidget: WidgetSpec = {
      id: `widget-${Date.now()}`,
      type,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      layout: { w: 4, h: 4, x: 0, y: Infinity },
    } as any;

    if (type === 'text') (newWidget as any).content = "### New Text Block\nDouble click to edit.";
    if (type === 'query') (newWidget as any).initialQuery = "SELECT * FROM dataset LIMIT 5";
    if (type === 'kpi') (newWidget as any).kpi = { title: "New KPI", value: 0 };

    setDashboardConfig(prev => ({
      ...prev,
      widgets: [...(prev.widgets || []), newWidget]
    }));
    setShowAddWidgetModal(false);
  };

  const handleRemoveWidget = (widgetId: string) => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: (prev.widgets || []).filter(w => w.id !== widgetId),
      charts: (prev.charts || []).filter(c => c?.id !== widgetId),
      kpis: (prev.kpis || []).filter((k, i) => (k?.id || `kpi-${i}`) !== widgetId)
    }));
  };

  const handleWidgetUpdate = (updatedWidget: WidgetSpec) => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: (prev.widgets || []).map(w => w.id === updatedWidget.id ? updatedWidget : w)
    }));
  };

  const handleGenerateReport = async () => {
    const widgets = dashboardConfig?.widgets || [];
    if (!dataset || !widgets.length) return;
    setIsGeneratingReport(true);
    try {
      const widgetSummary = widgets.map(w => ({
        type: w?.type,
        title: w?.title || 'Untitled',
        description: w?.description,
        content: w?.type === 'text' ? (w as any).content : undefined,
        kpiValue: w?.type === 'kpi' ? (w as any).kpi?.value : undefined
      }));

      const report = await GroqService.generateReport(dataset, 'strategic', {
        cleaningHistory: [{
          action: 'dashboard_analysis',
          details: JSON.stringify({
            name: dashboardConfig.name || 'Dashboard Analysis',
            widgets: widgetSummary
          })
        }]
      });

      const res = await reportsAPI.create(workspaceId, {
        name: `${dashboardEntity?.name || 'Dashboard'} Report`,
        description: `Generated from dashboard on ${new Date().toLocaleDateString()}`,
        dataset_id: dataset.id,
        content: report
      });

      const newReportId = res.data?.data?.id || res.data?.id;
      if (newReportId) {
        navigate(`/app/report?id=${newReportId}&workspace=${workspaceId}&dataset=${dataset.id}`);
      }
    } catch (e) {
      console.error("Report generation failed:", e);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-slate-950 transition-colors">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/50 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  // --- Error / No Dataset State ---
  if (error || !dataset) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-slate-950 transition-colors">
        <div className="text-center space-y-6 max-w-md p-8">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-4xl mx-auto">
            ⚠️
          </div>
          <div>
            <p className="text-red-600 dark:text-red-400 text-lg font-bold mb-2">Something went wrong</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{error || 'No dataset found. Select one from the library.'}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/app/datasets')}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Dataset Library
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Empty Dashboard State (the fix for the blank page!) ---
  if (isDashboardEmpty && !isAutoGenerating) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-950 transition-colors">
        {/* Minimal Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/app/datasets?workspace=${workspaceId}`)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors flex items-center gap-2 text-xs font-bold"
            >
              ← Back
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{dataset?.name || 'Dashboard'}</h1>
          </div>
        </div>

        {/* Empty State CTA */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-lg space-y-8">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl rotate-6 opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl flex items-center justify-center text-white text-4xl">
                📊
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                No Dashboard Yet
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
                Generate a full dashboard instantly from your data using AI, or build one from scratch with widgets.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleAutoGenerate}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/30 active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </button>
              <button
                onClick={() => { setIsEditable(true); handleAddWidget('chart'); }}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                Build from Scratch
              </button>
            </div>

            {/* Quick Stats about the dataset */}
            {dataset?.data && dataset.data.length > 0 && (
              <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-center">
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{dataset.data.length.toLocaleString()}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Rows</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-violet-600 dark:text-violet-400">{(dataset.headers || []).length}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Columns</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {(dataset.headers || []).filter(h => {
                      const firstVal = dataset.data?.[0]?.[h];
                      return firstVal !== null && firstVal !== undefined && firstVal !== '';
                    }).length}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Active</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Auto-generating State ---
  if (isAutoGenerating) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-slate-950 transition-colors">
        <div className="text-center space-y-6 max-w-md">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl animate-pulse opacity-30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Generating Dashboard</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              AI is analyzing your data to create charts, KPIs, and insights...
            </p>
          </div>
          <div className="w-48 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  // --- Main Dashboard View ---
  return (
    <div className="relative h-full overflow-hidden flex flex-col bg-white dark:bg-slate-950 transition-colors">
      {/* Header Bar — theme-aware */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between z-[110] shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/app/dashboards?workspace=${workspaceId}&dataset=${datasetId}`)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            Library
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

          <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{dashboardEntity?.name || dataset?.name || 'Dashboard'}</h1>

          {isEditable && (
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded border border-amber-200 dark:border-amber-500/30">
              Editing
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Regenerate */}
          <button
            onClick={handleAutoGenerate}
            disabled={isAutoGenerating}
            className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAutoGenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </button>

          {isEditable && (
            <button
              onClick={async () => {
                if (window.confirm("This will wipe the current dashboard and recreate it from scratch. Are you sure?")) {
                  setDashboardConfig({ charts: [], kpis: [], patterns: [], widgets: [] });
                  await handleAutoGenerate();
                }
              }}
              disabled={isAutoGenerating}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              title="Wipe and recreate from scratch"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isAutoGenerating ? 'animate-spin' : ''}`} />
              Recreate
            </button>
          )}

          {!isEditable && (
            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-sm shadow-indigo-500/20"
            >
              {isGeneratingReport ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  Generate Report
                </>
              )}
            </button>
          )}
          {isEditable ? (
            <>
              <button
                onClick={() => setShowAddWidgetModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" /> Add Widget
              </button>
              <button
                onClick={handleSaveDashboard}
                disabled={isSaving}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setIsEditable(false)}
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                title="Cancel editing"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditable(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white rounded-lg text-xs font-bold transition-all"
            >
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 relative overflow-hidden overflow-y-auto p-4">
        <UniversalDashboardGrid
          config={dashboardConfig}
          dataset={dataset}
          workspaceId={workspaceId}
          isEditable={isEditable}
          onLayoutChange={handleLayoutChange}
          onEditWidget={(w) => console.log('Edit widget', w)}
          onRemoveWidget={handleRemoveWidget}
          onWidgetUpdate={handleWidgetUpdate}
        />
      </div>

      {/* Add Widget Modal */}
      {showAddWidgetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Add Widget</h3>
              <button onClick={() => setShowAddWidgetModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              {[
                { type: 'chart', label: 'Chart', icon: '📊', desc: 'Visualize data trends' },
                { type: 'kpi', label: 'KPI Card', icon: '💰', desc: 'Key performance indicators' },
                { type: 'table', label: 'Data Table', icon: '🔢', desc: 'Raw or filtered data grid' },
                { type: 'query', label: 'Query Console', icon: '💻', desc: 'SQL or Natural Language' },
                { type: 'pivot', label: 'Pivot Table', icon: '🔄', desc: 'Cross-tabulation analysis' },
                { type: 'text', label: 'Text Block', icon: '📝', desc: 'Notes, headers, annotations' },
              ].map(option => (
                <button
                  key={option.type}
                  onClick={() => handleAddWidget(option.type as WidgetType)}
                  className="flex flex-col items-start p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left group"
                >
                  <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">{option.icon}</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{option.label}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{option.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardViewIntegrated;
