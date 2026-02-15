import React, { useEffect, useState, useRef } from 'react';
import { useDataset } from '../src/context/DatasetContext';
import SpreadsheetView from './SpreadsheetView';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { datasetAPI } from '../src/services/api';
import { Loader2, LayoutDashboard, Terminal, Sparkles, Brush } from 'lucide-react';

const SpreadsheetViewIntegrated: React.FC = () => {
    const { activeDataset, setActiveDataset } = useDataset();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const hasHydratedRef = useRef<string | null>(null);

    const workspaceId = searchParams.get('workspace');
    const datasetId = searchParams.get('dataset');

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

                // Map raw_data to data if needed, similar to CleanView
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

    // Build cross-module URL params
    const buildParams = () => new URLSearchParams({ workspace: workspaceId || '', dataset: datasetId || '' }).toString();

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
                <p className="text-slate-500 text-sm max-w-xs">Please select a dataset from the library or workspace to view it in the spreadsheet editor.</p>
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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Cross-Module Action Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Navigate to:</span>
                    <button
                        onClick={() => navigate(`/app/playground?${buildParams()}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                        title="Analyze this data with SQL, Python, or AI"
                    >
                        <Terminal className="w-3.5 h-3.5" /> Playground
                    </button>
                    <button
                        onClick={() => navigate(`/app/dashboard?${buildParams()}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                        title="Visualize this data on a dashboard"
                    >
                        <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                    </button>
                    <button
                        onClick={() => navigate(`/app/clean?${buildParams()}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                        title="Clean and validate this data"
                    >
                        <Brush className="w-3.5 h-3.5" /> Clean
                    </button>
                    <button
                        onClick={() => navigate(`/app/report?${buildParams()}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                        title="Generate an AI report from this data"
                    >
                        <Sparkles className="w-3.5 h-3.5" /> Report
                    </button>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                    {activeDataset?.row_count || activeDataset?.data?.length || 0} rows × {activeDataset?.column_count || activeDataset?.headers?.length || 0} cols
                </div>
            </div>

            <SpreadsheetView
                dataset={activeDataset as any}
                onUpdate={(updated: any) => setActiveDataset(updated)}
            />
        </div>
    );
};

export default SpreadsheetViewIntegrated;
