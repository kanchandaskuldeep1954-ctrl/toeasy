import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
// import DashboardView from '../../components/DashboardView'; // REMOVED
import UniversalDashboardGrid from './Dashboard/UniversalDashboardGrid'; // NEW
import { Dataset, DashboardConfig, WidgetSpec, WidgetType } from '../../types';
import { dashboardAPI, datasetAPI } from '../services/api';
import { useDataset } from '../hooks/useDataset';
import { useWorkspaceRole } from '../hooks/useWorkspaceRole';
import { Plus, LayoutTemplate, Save, Edit3, X, FileText } from 'lucide-react';
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

  // Agent State
  const [agentQuery, setAgentQuery] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);

  useEffect(() => {
    if (workspaceId && (datasetId || initialDashboardId)) {
      loadAll();
    }
  }, [workspaceId, datasetId, initialDashboardId, selectedDataVersionId]);

  const loadAll = async () => {
    try {
      setLoading(true);

      let targetDatasetId = datasetId;
      let currentDashboard = null;

      // 1. Fetch Dashboard if ID present
      if (initialDashboardId) {
        const dRes = await dashboardAPI.get(workspaceId, initialDashboardId);
        currentDashboard = dRes.data.data || dRes.data;
        setDashboardEntity(currentDashboard);
        // Initialize config from entity
        if (currentDashboard.configuration) {
          setDashboardConfig(currentDashboard.configuration);
        } else if (dataset?.dashboardConfig) {
          // Fallback to dataset config if dashboard entity doesn't have it (legacy)
          setDashboardConfig(dataset.dashboardConfig);
        }

        // 2. Hydrate Dataset in Context if not already active
        if (!dataset || String(dataset.id) !== String(targetDatasetId)) {
          const dsRes = await datasetAPI.get(workspaceId, targetDatasetId);
          const dsData = dsRes.data;

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

          const rawData = safeParse(dsData.raw_data || dsData.data) || [];
          const headers = safeParse(dsData.headers) || (rawData && rawData[0] ? Object.keys(rawData[0]) : []);

          setActiveDataset({
            ...dsData,
            data: rawData,
            headers: headers,
          });
        }

        // 3. Fetch Siblings and Versions
        const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:3000/api';
        const [siblingsRes, versionsRes] = await Promise.all([
          dashboardAPI.list(workspaceId),
          axios.get(`${backendUrl}/workspaces/${workspaceId}/datasets/${targetDatasetId}/versions`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const allDashboards = siblingsRes?.data?.data || siblingsRes?.data || [];
        const versions = versionsRes?.data?.data || (Array.isArray(versionsRes?.data) ? versionsRes.data : []);
        setDataVersions(versions);

        const dashSiblings = allDashboards.filter((d: any) => d && String(d.dataset_id) === String(targetDatasetId));
        setSiblings(dashSiblings);

        if (!initialDashboardId && !currentDashboard) {
          const primary = dashSiblings.find((d: any) => d.is_primary);
          if (primary) setDashboardEntity(primary);
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      console.error(err);
    } finally {
      setLoading(false);
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
    try {
      await dashboardAPI.update(workspaceId, dashboardEntity.id, {
        configuration: dashboardConfig
      });
      setIsEditable(false);
      // Optional: toast success
    } catch (e) {
      console.error("Failed to save dashboard", e);
    }
  };

  const handleAddWidget = (type: WidgetType) => {
    const newWidget: WidgetSpec = {
      id: `widget-${Date.now()}`,
      type,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      layout: { w: 4, h: 4, x: 0, y: Infinity }, // Add to bottom
    } as any;

    // Type specific defaults
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
      // Also filter legacy if present in widget list (UniversalGrid handles this merger, but best to keep state clean)
      charts: (prev.charts || []).filter(c => c.id !== widgetId),
      kpis: (prev.kpis || []).filter(k => (k.id || `kpi-${prev.kpis.indexOf(k)}`) !== widgetId)
    }));
  };

  const handleWidgetUpdate = (updatedWidget: WidgetSpec) => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: (prev.widgets || []).map(w => w.id === updatedWidget.id ? updatedWidget : w)
    }));
  };

  const handleGenerateReport = async () => {
    if (!dataset || !dashboardConfig.widgets.length) return;
    setIsGeneratingReport(true);
    try {
      // Serialize widgets for context
      const widgetSummary = dashboardConfig.widgets.map(w => ({
        type: w.type,
        title: w.title,
        description: w.description,
        content: w.type === 'text' ? (w as any).content : undefined,
        kpiValue: w.type === 'kpi' ? (w as any).kpi?.value : undefined
      }));

      const report = await GroqService.generateReport(dataset, 'strategic', {
        dashboardContext: { // Pass as cleaner object
          name: dashboardConfig.name || 'Dashboard Analysis',
          widgets: widgetSummary
        } as any // Cast to any to bypass strict type check if interface not updated yet
      });

      // Save as new report
      const res = await reportsAPI.create(workspaceId, {
        name: `${dashboardEntity?.name || 'Dashboard'} Report`,
        description: `Generated from dashboard on ${new Date().toLocaleDateString()}`,
        dataset_id: dataset.id,
        content: report
      });

      const newReportId = res.data.data.id;
      navigate(`/app/report?id=${newReportId}&workspace=${workspaceId}&dataset=${dataset.id}`);

    } catch (e) {
      console.error("Report generation failed:", e);
      alert("Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 dark:text-slate-400 font-bold">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="text-center space-y-6 max-w-md p-6">
          <div>
            <p className="text-red-500 dark:text-red-400 text-lg font-bold mb-2">⚠️ Error</p>
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">{error || 'Failed to load dataset'}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Analysis Context Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between z-[110] shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/app/dashboards?workspace=${workspaceId}&dataset=${datasetId}`)}
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            Library
          </button>

          <div className="h-4 w-px bg-slate-800"></div>

          <h1 className="text-lg font-black text-white tracking-tight">{dashboardEntity?.name || 'Dashboard'}</h1>

          {isEditable && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-wider rounded border border-amber-500/30">
              Editing Mode
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
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
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                <Save className="w-4 h-4" /> Save
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditable(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all"
            >
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden overflow-y-auto">
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
              <button onClick={() => setShowAddWidgetModal(false)} className="text-slate-400 hover:text-slate-600">
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
                  className="flex flex-col items-start p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all text-left group"
                >
                  <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">{option.icon}</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{option.label}</span>
                  <span className="text-xs text-slate-500 mt-1">{option.desc}</span>
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
