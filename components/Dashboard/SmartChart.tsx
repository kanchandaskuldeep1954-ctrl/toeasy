
import React, { useMemo } from 'react';
import { ChartSpec } from '../../types';
import {
    D3BarChart,
    D3LineChart,
    D3PieChart,
    D3ScatterChart
} from '../../src/components/D3Charts';
import { DataPoint } from '../../src/components/D3Charts/chartUtils';

interface SmartChartProps {
    chart: ChartSpec;
    data?: any[]; // Allow external data injection (e.g. filtered data)
    height?: number;
    onClick?: (data: any) => void;
}

export const SmartChart: React.FC<SmartChartProps> = ({ chart, data, height = 300, onClick }) => {
    // Transform data to match D3 component requirements (name -> label)
    const normalizedData = useMemo(() => {
        const sourceData = data || chart.data;
        if (!sourceData || !Array.isArray(sourceData)) return [];

        return sourceData
            .map((d: any) => {
                const rawValue = d.value ?? d.y ?? d.count ?? 0;
                const numericValue = Number(rawValue);
                
                return {
                    label: String(d.name || d.label || d.x || d.category || 'Unknown'),
                    value: isNaN(numericValue) ? 0 : numericValue,
                    ...d
                } as DataPoint;
            })
            .filter((d: DataPoint) => d.label && d.label !== 'undefined' && d.label !== 'null');
    }, [chart.data, data]);

    // Handle empty data
    if (normalizedData.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-800/20 rounded-xl border border-dashed border-slate-700">
                <p className="text-slate-500 text-sm">No data available for {chart.title}</p>
            </div>
        );
    }

    const commonProps = {
        data: normalizedData,
        title: chart.title,
        height,
        // Default colors based on chart type if not specified
        color: chart.type === 'bar' ? '#6366f1' : // Indigo
            chart.type === 'line' ? '#10b981' : // Emerald
                chart.type === 'pie' ? undefined :  // Pie handles its own colors
                    '#f59e0b',                          // Amber default
        xLabel: chart.options?.xAxis,
        yLabel: chart.options?.yAxis,
        onBarClick: onClick ? (d: any) => onClick({ activePayload: [{ payload: d }] }) : undefined,
    };

    switch (chart.type) {
        case 'bar':
        case 'funnel': // Map funnel to horizontal bar for now
            return (
                <D3BarChart
                    {...commonProps}
                    horizontal={chart.options?.orientation === 'horizontal' || chart.type === 'funnel'}
                />
            );

        case 'line':
        case 'area': // Map area to line for now
            return <D3LineChart {...commonProps} />;

        case 'pie':
        case 'doughnut':
            return <D3PieChart {...commonProps} donut={chart.type === 'doughnut'} />;

        case 'scatter':
            return <D3ScatterChart {...commonProps} />;

        case 'treemap':
        case 'heatmap':
            // Fallback for complex types not yet implemented in D3Charts
            // We'll use a bar chart as a safe fallback
            return <D3BarChart {...commonProps} horizontal={true} />;

        default:
            return <D3BarChart {...commonProps} />;
    }
};
