import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useDataset } from '../src/context/DatasetContext';
import SpreadsheetView from './SpreadsheetView';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { datasetAPI } from '../src/services/api';
import { Loader2, LayoutDashboard, Terminal, Sparkles, Brush, ChartBar, Pi, FileText, FunctionSquare } from 'lucide-react';
import { KPIWidget } from '../src/components/Widgets/KPIWidget';
import { StatsPanel } from '../src/components/Widgets/StatsPanel';
import { ChartWidget } from '../src/components/Widgets/ChartWidget';
import { QueryConsole } from '../src/components/Widgets/QueryConsole';
import { PivotWidget } from '../src/components/Widgets/PivotWidget';
import { FormulaEditor } from '../src/components/Widgets/FormulaEditor';
import { GroqService } from '../src/services/groqService';
import { KPI, ChartSpec, StrategicReport } from '../types';

const SpreadsheetViewIntegrated: React.FC = () => {
    const { activeDataset, setActiveDataset } = useDataset();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const hasHydratedRef = useRef<string | null>(null);

    const workspaceId = searchParams.get('workspace');
    const datasetId = searchParams.get('dataset');

    // Layout State
    const [showRightPanel, setShowRightPanel] = useState(false);
    const [rightPanelMode, setRightPanelMode] = useState<'stats' | 'charts'>('stats');
    const [showBottomDrawer, setShowBottomDrawer] = useState(false);
    const [pivotMode, setPivotMode] = useState(false);
    const [showFormulaEditor, setShowFormulaEditor] = useState(false);

    // Feature State
    const [isGenerating, setIsGenerating] = useState(false);
    const [showReportPreview, setShowReportPreview] = useState(false);
    const [generatedReport, setGeneratedReport] = useState<StrategicReport | null>(null);

    // Mock/Local Data for "Everything" Widgets
    const [sheetCharts, setSheetCharts] = useState<ChartSpec[]>([]);
    const [sheetKPIs, setSheetKPIs] = useState<KPI[]>([
        { id: '1', title: 'Total Revenue', value: '$1.2M', trend: { value: 12, direction: 'up' } },
        { id: '2', title: 'Active Users', value: '45.2k', trend: { value: 5, direction: 'up' } },
        { id: '3', title: 'Churn Rate', value: '2.1%', trend: { value: 0.5, direction: 'down' } }
    ]);

    useEffect(() => {
        const hydrateDataset = async () => {
            if (!workspaceId || !datasetId) return;

            // Check if already hydrated for this specific combination
            const hydrateKey = `${workspaceId}-${datasetId}`;
            if (hasHydratedRef.current === hydrateKey) return;

            // If we have activeDataset and it ALREADY has data, skip hydration
            if (activeDataset?.id === Number(datasetId) && (activeDataset.data?.length || 0) > 0) {
                hasHydratedRef.current = hydrateKey;
                return;
            }

            console.log("SpreadsheetViewIntegrated: Hydrating dataset", hydrateKey);
            setIsLoading(true);
            try {
                const res = await datasetAPI.get(workspaceId, datasetId);
                const fullData = res.data;

                // Map raw_data to data if needed
                const hydrated = {
                    ...fullData,
                    data: fullData.data || fullData.raw_data || [],
                    raw_data: fullData.raw_data || fullData.data || [],
                    headers: fullData.headers || (fullData.raw_data?.[0] ? Object.keys(fullData.raw_data[0]) : [])
                };

                setActiveDataset(hydrated);
                hasHydratedRef.current = hydrateKey;
            } catch (e) {
                console.error("Hydration failed in SpreadsheetViewIntegrated:", e);
            } finally {
                setIsLoading(false);
            }
        };

        hydrateDataset();
    }, [workspaceId, datasetId, activeDataset, setActiveDataset]);

    // Handlers
    const handleGenerateReport = async () => {
        if (!activeDataset) return;
        setIsGenerating(true);
        try {
            const report = await GroqService.generateReport(activeDataset);
            setGeneratedReport(report);
            setShowReportPreview(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateDashboard = async () => {
        if (!activeDataset) return;
        setIsGenerating(true);
        try {
            const dashboardConfig = await GroqService.suggestDashboard(activeDataset);
            if (dashboardConfig.charts) {
                const hydratedCharts = dashboardConfig.charts.map(c => ({
                    ...c,
                    id: `gen-chart-${Date.now()}-${Math.random()}`,
                    data: c.data || GroqService.transformChartData(activeDataset.data || [], c),
                    sourceModule: 'ai' as const
                }));
                // Cast to any because ChartSpec types might slighty differ in activeDataset context vs loose widget
                setSheetCharts(prev => [...prev, ...hydratedCharts as any]);
            }
            if (dashboardConfig.kpis) {
                setSheetKPIs(prev => [...prev, ...dashboardConfig.kpis]);
            }
            setShowRightPanel(true);
            setRightPanelMode('charts');
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFormulaSubmit = async (colName: string, formula: string) => {
        console.log("Formula submitted:", colName, formula);
        // Here we would implement the actual formula logic or call backend
        // For now, closing the modal
        setShowFormulaEditor(false);

        // Mock update for UX
        if (activeDataset && activeDataset.data) {
            const newData = activeDataset.data.map((row: any) => ({
                ...row,
                [colName]: "#CALC!" // Placeholder
            }));
            const newHeaders = [...(activeDataset.headers || []), colName];
            setActiveDataset({
                ...activeDataset,
                data: newData,
                headers: newHeaders
            });
        }
    };

    const displayHeaders = useMemo(() => {
        return activeDataset?.headers || (activeDataset?.data?.[0] ? Object.keys(activeDataset.data[0]) : []);
    }, [activeDataset]);


    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-900/50 backdrop-blur-sm">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">
                    Hydrating Spreadsheet...
                </p>
            </div>
        );
    }

    if (!activeDataset || (activeDataset.id !== Number(datasetId) && datasetId)) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 px-4 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-2">
                    <span className="text-3xl">📊</span>
                </div>
                <h3 className="text-lg font-black text-white">No Dataset Active</h3>
                <button
                    onClick={() => navigate('/app/datasets')}
                    className="mt-4 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
                >
                    Open Dataset Library
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* KPI Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                {sheetKPIs.slice(0, 3).map(kpi => (
                    <KPIWidget key={kpi.id} kpi={kpi} />
                ))}
            </div>

            {/* Feature Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                    {/* View Toggles */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mr-4">
                        <button
                            onClick={() => setPivotMode(false)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!pivotMode ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ChartBar className="w-3.5 h-3.5 inline mr-1.5" /> Data
                        </button>
                        <button
                            onClick={() => setPivotMode(true)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${pivotMode ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Pi className="w-3.5 h-3.5 inline mr-1.5" /> Pivot
                        </button>
                    </div>

                    {/* Actions */}
                    <button
                        onClick={() => setShowFormulaEditor(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
                    >
                        <FunctionSquare className="w-3.5 h-3.5" /> Formula
                    </button>
                    <button
                        onClick={handleGenerateReport}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                    >
                        <FileText className="w-3.5 h-3.5" /> {isGenerating ? 'Thinking...' : 'Report'}
                    </button>
                    <button
                        onClick={handleGenerateDashboard}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 rounded-lg text-xs font-bold transition-colors"
                    >
                        <LayoutDashboard className="w-3.5 h-3.5" /> {isGenerating ? 'Thinking...' : 'Dashboard'}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setShowRightPanel(!showRightPanel); setRightPanelMode('stats'); }}
                        className={`p-2 rounded-lg transition-colors ${showRightPanel && rightPanelMode === 'stats' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
                        title="Column Statistics"
                    >
                        <ChartBar className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setShowRightPanel(!showRightPanel); setRightPanelMode('charts'); }}
                        className={`p-2 rounded-lg transition-colors ${showRightPanel && rightPanelMode === 'charts' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
                        title="Charts"
                    >
                        <LayoutDashboard className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowBottomDrawer(!showBottomDrawer)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${showBottomDrawer ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}
                    >
                        <Terminal className="w-3.5 h-3.5" /> Query
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                {/* Center Content: Spreadsheet OR Pivot */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300">
                    {pivotMode ? (
                        <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-900 overflow-auto">
                            <PivotWidget
                                data={activeDataset.data || []}
                                fields={displayHeaders}
                                onUpdate={() => { }}
                            />
                        </div>
                    ) : (
                        <SpreadsheetView
                            dataset={activeDataset as any}
                            onUpdate={(updated: any) => setActiveDataset(updated)}
                        />
                    )}

                    {/* Bottom Drawer (Query Console) */}
                    {showBottomDrawer && (
                        <div className="h-64 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex flex-col animate-in slide-in-from-bottom-10 z-20">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Query Console</span>
                                <button onClick={() => setShowBottomDrawer(false)} className="text-slate-400 hover:text-slate-600">×</button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <QueryConsole
                                    datasetId={String(activeDataset.id)}
                                    initialQuery={`SELECT * FROM "${activeDataset.name}" LIMIT 10`}
                                    onRunQuery={() => { }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel (Stats / Charts) */}
                {showRightPanel && (
                    <div className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 shadow-xl z-30 animate-in slide-in-from-right-10">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                {rightPanelMode === 'stats' ? 'Column Statistics' : 'Charts & Visuals'}
                            </h3>
                            <button onClick={() => setShowRightPanel(false)} className="text-slate-400 hover:text-slate-600">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {rightPanelMode === 'stats' ? (
                                <StatsPanel
                                    dataset={activeDataset as any}
                                    columns={displayHeaders}
                                />
                            ) : (
                                <div className="space-y-6">
                                    <button className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                                        + Add New Chart
                                    </button>
                                    {sheetCharts.map((chart, i) => (
                                        <div key={chart.id || i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
                                            <ChartWidget
                                                config={chart}
                                                data={chart.data || activeDataset.data || []}
                                                onEdit={() => { }}
                                            />
                                        </div>
                                    ))}
                                    {sheetCharts.length === 0 && (
                                        <div className="text-center py-10 text-slate-400 text-xs">
                                            No charts yet. Click "Dashboard" to generate some!
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showFormulaEditor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
                        <FormulaEditor
                            columns={displayHeaders}
                            onSave={handleFormulaSubmit}
                            onCancel={() => setShowFormulaEditor(false)}
                        />
                    </div>
                </div>
            )}

            {showReportPreview && generatedReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white">{generatedReport.title}</h2>
                                {generatedReport.subtitle && <p className="text-sm text-slate-500">{generatedReport.subtitle}</p>}
                            </div>
                            <div className="flex gap-2">
                                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20">
                                    Export PDF
                                </button>
                                <button onClick={() => setShowReportPreview(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                    ×
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 prose dark:prose-invert max-w-none">
                            <div className="bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-500 p-4 mb-8 rounded-r-lg">
                                <h4 className="text-amber-800 dark:text-amber-400 font-bold m-0">Executive Summary</h4>
                                <p className="text-amber-700 dark:text-amber-300 mt-1">{generatedReport.summary}</p>
                            </div>
                            {generatedReport.sections.map((section, idx) => (
                                <div key={idx} className="mb-8">
                                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs">
                                            {idx + 1}
                                        </span>
                                        {section.heading}
                                    </h3>
                                    <div className="pl-8 text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                        {section.content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpreadsheetViewIntegrated;
