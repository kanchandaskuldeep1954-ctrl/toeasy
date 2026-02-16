import React, { useState, useEffect, useCallback, useMemo } from 'react';
// @ts-ignore
import { Responsive } from 'react-grid-layout';
import WidthProvider from './WidthProvider';
import { ResponsiveContainer } from 'recharts';
import { ChartSpec, DashboardConfig, Dataset } from '@/types';
import DashboardChart from './DashboardChart';
import { aggregateData } from '@/src/utils/dashboardUtils';
import { generateChartInsights } from '@/src/utils/chartValidation';

const ResponsiveGridLayout = (WidthProvider as any)(Responsive);

interface DashboardGridProps {
    config: DashboardConfig;
    dataset: Dataset;
    perspective: string;
    onLayoutChange: (layout: any) => void;
    onEditChart: (chart: ChartSpec) => void;
    filteredData: any[];
    chartValidations: { [id: string]: any };
}

const DashboardGrid: React.FC<DashboardGridProps> = ({
    config,
    dataset,
    perspective,
    onLayoutChange,
    onEditChart,
    filteredData,
    chartValidations
}) => {
    // Current visible charts based on perspective
    const visibleCharts = useMemo(() => {
        if (!config.charts || !Array.isArray(config.charts)) return [];
        return config.charts.filter(c => {
            if (!c) return false;
            if (perspective === 'Overview') return c.priority === 'critical' || c.priority === 'high';
            if (perspective === 'Forensic') return c.category === 'Forensic' || c.category === 'Patterns';
            return c.category === perspective;
        });
    }, [config.charts, perspective]);

    // Generate layout if missing
    const generateLayout = useCallback((charts: ChartSpec[]) => {
        return charts.map((chart, i) => {
            // If chart already has layout, use it. Otherwise default.
            if (chart.layout) return { i: chart.id, ...chart.layout };

            // Default layout logic: 
            // - width 6 (half screen) for normal, 12 (full) for wide/complex charts
            const isWide = chart.size === 'large' || chart.type === 'heatmap' || i % 3 === 0;
            return {
                i: chart.id,
                x: (i * 6) % 12,
                y: Math.floor(i / 2) * 4, // 4 rows height (~400px)
                w: isWide ? 12 : 6,
                h: 4,
                minW: 3,
                minH: 3
            };
        });
    }, []);

    const [currentLayout, setCurrentLayout] = useState(generateLayout(visibleCharts));

    // Update layout when perspective or charts change
    useEffect(() => {
        setCurrentLayout(generateLayout(visibleCharts));
    }, [visibleCharts, generateLayout]);

    const handleLayoutChange = (layout: any[]) => {
        setCurrentLayout(layout);

        // Map layout back to chart objects and notify parent
        // We need to persist this change. The parent is responsible for saving 'config'.
        // We'll pass the updated layout array to parent, or updated charts.
        // Actually, best practice is to update the 'charts' specs with new layout info.

        const updatedCharts = config.charts.map(c => {
            const item = layout.find(l => l.i === c.id);
            if (item) {
                return {
                    ...c,
                    layout: {
                        x: item.x,
                        y: item.y,
                        w: item.w,
                        h: item.h
                    }
                };
            }
            return c;
        });

        const newConfig = { ...config, charts: updatedCharts };
        onLayoutChange(newConfig); // Parent expects config? Or just layout? The prop says onLayoutChange(layout: any).
        // Let's assume parent expects the full config update or we adjust the prop generic.
    };

    // Wrapper due to generic mismatch in prop definition vs implementation.
    // For RGL, onLayoutChange gives Layout[].
    const onRglLayoutChange = (layout: any) => {
        // We only trigger update on drag stop ideally, but RGL triggers often.
        // We can debounce or just pass it up.
    };

    const onDragStop = (layout: any) => {
        const updatedCharts = config.charts.map(c => {
            const item = layout.find((l: any) => l.i === c.id);
            if (item) {
                return {
                    ...c,
                    layout: {
                        x: item.x,
                        y: item.y,
                        w: item.w,
                        h: item.h
                    }
                };
            }
            return c;
        });
        // We return the full updated chart list or config to the parent
        // Let's align with the prop semantic: onLayoutChange usually means "here is the new config" for us
        onLayoutChange({ ...config, charts: updatedCharts });
    };

    return (
        <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: currentLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            onLayoutChange={onRglLayoutChange}
            onDragStop={onDragStop}
            onResizeStop={onDragStop}
            draggableCancel=".no-drag"
            margin={[24, 24]}
        >
            {visibleCharts.map((chart) => {
                const data = aggregateData(chart, filteredData, dataset.headers);
                const validation = chartValidations[chart.id];
                const hasWarnings = validation && (validation.warnings.length > 0 || !validation.valid);
                const insights = data.length > 0 ? generateChartInsights(data.map((d: any) => ({ label: d.name, value: d.value })), chart.type) : [];

                if (data.length === 0) {
                    return (
                        <div key={chart.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-8 flex items-center justify-center">
                            <p className="text-slate-400 font-bold uppercase text-xs">No Data Available</p>
                        </div>
                    );
                }

                return (
                    <div key={chart.id} className={`bg-white dark:bg-slate-900 rounded-[32px] border transition-all ${hasWarnings
                        ? 'border-yellow-200 dark:border-yellow-900/30 shadow-md'
                        : 'border-slate-200 dark:border-slate-800'
                        } shadow-sm group hover:shadow-xl flex flex-col overflow-hidden`}>

                        <div className="p-6 md:p-8 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4 cursor-move">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{chart.title}</h3>
                                        {hasWarnings && (
                                            <div className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded text-[8px] font-bold uppercase tracking-wide">
                                                ⚠️ {validation.warnings.length}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{chart.description}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEditChart(chart); }}
                                        className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-wide text-indigo-600 hover:bg-indigo-50 transition-all no-print flex items-center gap-1 no-drag"
                                        onMouseDown={(e) => e.stopPropagation()} // Prevent drag start
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        Edit
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 w-full relative min-h-0 cursor-auto no-drag">
                                <ResponsiveContainer width="100%" height="100%">
                                    <DashboardChart
                                        chart={chart}
                                        data={data}
                                        colors={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#334155']}
                                        perspective={perspective}
                                    />
                                </ResponsiveContainer>
                            </div>

                            {insights.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-2">Insights:</p>
                                    <p className="text-[9px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                                        {insights.slice(0, 2).join(' • ')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </ResponsiveGridLayout>
    );
};

export default DashboardGrid;
