import React, { useState, useEffect, useCallback, useMemo } from 'react';
// @ts-ignore
import { Responsive } from 'react-grid-layout';
import WidthProvider from './WidthProvider';
import { WidgetSpec, DashboardConfig, Dataset, ChartSpec, KPI } from '../../../types';
import { ChartWidget } from '../Widgets/ChartWidget';
import { KPIWidget } from '../Widgets/KPIWidget';
import { DataGridWidget } from '../Widgets/DataGridWidget';
import { QueryConsole } from '../Widgets/QueryConsole';
import { PivotWidget } from '../Widgets/PivotWidget';
import { TextWidget } from '../Widgets/TextWidget';
import { aggregateData } from '../../utils/dashboardUtils';
import { generateChartInsights } from '../../utils/chartValidation';
import { MoreVertical, Trash2, Edit2, GripHorizontal } from 'lucide-react';

const ResponsiveGridLayout = (WidthProvider as any)(Responsive);

interface UniversalDashboardGridProps {
    config: DashboardConfig;
    dataset: Dataset;
    workspaceId: string;
    isEditable?: boolean;
    onLayoutChange: (widgets: WidgetSpec[]) => void;
    onEditWidget: (widget: WidgetSpec) => void;
    onRemoveWidget: (widgetId: string) => void;
    onWidgetUpdate: (widget: WidgetSpec) => void;
}

const UniversalDashboardGrid: React.FC<UniversalDashboardGridProps> = ({
    config,
    dataset,
    workspaceId,
    isEditable = false,
    onLayoutChange,
    onEditWidget,
    onRemoveWidget,
    onWidgetUpdate
}) => {
    // Merge legacy charts/kpis into unified widgets if needed
    // This logic might belong in the parent, but robust to have here too
    const allWidgets = useMemo(() => {
        let widgets = [...(config.widgets || [])];

        // Back-compat: Add legacy charts if not already in widgets
        if (config.charts && Array.isArray(config.charts)) {
            config.charts.forEach(c => {
                if (c && c.id && !widgets.find(w => w.id === c.id)) {
                    widgets.push({
                        id: c.id,
                        type: 'chart',
                        title: c.title || 'Chart',
                        description: c.description,
                        layout: c.layout || { w: 6, h: 4, x: 0, y: 0 },
                        chart: c
                    });
                }
            });
        }

        // Back-compat: KPIs
        if (config.kpis && Array.isArray(config.kpis)) {
            config.kpis.forEach((k, i) => {
                if (k) {
                    const kpiId = k.id || `kpi-${i}`;
                    if (!widgets.find(w => w.id === kpiId)) {
                        widgets.push({
                            id: kpiId,
                            type: 'kpi',
                            title: k.title || 'KPI',
                            layout: { w: 4, h: 2, x: (i * 4) % 12, y: Infinity },
                            kpi: k
                        });
                    }
                }
            });
        }
        return widgets;
    }, [config.widgets, config.charts, config.kpis]);

    const generateLayout = useCallback((widgets: WidgetSpec[]) => {
        return widgets.map((w, i) => {
            if (w.layout) return { i: w.id, ...w.layout };
            return {
                i: w.id,
                x: (i * 4) % 12,
                y: Math.floor(i / 3) * 4,
                w: 4,
                h: 4,
                minW: 2,
                minH: 2
            };
        });
    }, []);

    const [currentLayout, setCurrentLayout] = useState(generateLayout(allWidgets));

    useEffect(() => {
        setCurrentLayout(generateLayout(allWidgets));
    }, [allWidgets, generateLayout]);

    const handleLayoutChange = (layout: any[]) => {
        // setCurrentLayout(layout); // React-grid-layout manages this internal state usually, but syncing is good
        // Map back to widgets
        const updatedWidgets = allWidgets.map(w => {
            const l = layout.find((item: any) => item.i === w.id);
            if (l) {
                return {
                    ...w,
                    layout: { x: l.x, y: l.y, w: l.w, h: l.h }
                };
            }
            return w;
        });
        onLayoutChange(updatedWidgets);
    };

    const renderWidgetContent = (widget: WidgetSpec) => {
        switch (widget.type) {
            case 'chart':
                // We need to aggregate data for the chart
                // Assuming widget.chart has the spec
                if ('chart' in widget && widget.chart) {
                    const aggData = aggregateData(widget.chart, dataset.data || [], dataset.headers || []);
                    return (
                        <ChartWidget
                            chart={widget.chart}
                            data={aggData} // Pass aggregated data
                            isEditing={isEditable}
                            onUpdate={(updatedChart) => {
                                onWidgetUpdate({ ...widget, chart: updatedChart });
                            }}
                            onDelete={() => onRemoveWidget(widget.id)}
                            onPointClick={(data, index) => console.log('Drilldown', data, index)}
                            height="100%"
                        />
                    );
                }
                return <div className="p-4 text-center text-gray-500">Invalid Chart Config</div>;

            case 'kpi':
                if ('kpi' in widget && widget.kpi) {
                    return <KPIWidget kpi={widget.kpi} />;
                }
                return <div className="p-4 text-center text-gray-500">Invalid KPI Config</div>;

            case 'table':
                return (
                    <div className="h-full overflow-hidden">
                        <DataGridWidget
                            data={dataset.data || []}
                            height="100%"
                            title={widget.title}
                        />
                    </div>
                );

            case 'query':
                return (
                    <div className="h-full flex flex-col">
                        <QueryConsole
                            workspaceId={workspaceId}
                            datasetId={String(dataset.id)}
                            initialQuery={(widget as any).query || ''}
                            onQueryChange={(q) => onWidgetUpdate({ ...widget, query: q } as any)}
                            height="100%"
                        />
                    </div>
                );

            case 'pivot':
                return (
                    <div className="h-full overflow-hidden">
                        <PivotWidget
                            data={dataset.data || []}
                            fields={dataset.headers || []}
                            config={(widget as any).pivotConfig}
                            onConfigChange={(cfg) => onWidgetUpdate({ ...widget, pivotConfig: cfg } as any)}
                            height="100%"
                        />
                    </div>
                );

            case 'text':
                return (
                    <TextWidget
                        content={(widget as any).content}
                        editable={isEditable}
                        onUpdate={(newContent) => onWidgetUpdate({ ...widget, content: newContent } as any)}
                    />
                );

            default:
                return <div>Unknown Widget Type</div>;
        }
    };

    return (
        <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: currentLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            onLayoutChange={(layout: any) => handleLayoutChange(layout)}
            draggableHandle=".drag-handle"
            isDraggable={isEditable}
            isResizable={isEditable}
            margin={[16, 16]}
        >
            {allWidgets.map(widget => (
                <div key={widget.id} className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow flex flex-col overflow-hidden group ${isEditable ? 'hover:shadow-md' : ''}`}>
                    {/* Header / Drag Handle */}
                    {isEditable && (
                        <div className="h-8 bg-slate-50 dark:bg-slate-800 flex items-center justify-between px-2 border-b border-slate-100 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="drag-handle cursor-move p-1 text-slate-400 hover:text-indigo-500">
                                <GripHorizontal className="w-4 h-4" />
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => onEditWidget(widget)} className="p-1 text-slate-400 hover:text-blue-500">
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => onRemoveWidget(widget.id)} className="p-1 text-slate-400 hover:text-red-500">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-h-0 overflow-hidden relative p-1">
                        {renderWidgetContent(widget)}
                    </div>
                </div>
            ))}
        </ResponsiveGridLayout>
    );
};

export default UniversalDashboardGrid;
