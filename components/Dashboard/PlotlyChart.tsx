import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { ChartSpec } from '../../types';

interface PlotlyChartProps {
    chart: ChartSpec;
    data?: any[];
    height?: number;
    onClick?: (data: any) => void;
}

// Professional color palette
const COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];

// Modern dark theme layout
const getLayout = (height: number, title?: string): Partial<Plotly.Layout> => ({
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'Inter, system-ui, sans-serif', color: '#94a3b8', size: 11 },
    margin: { l: 60, r: 30, t: 30, b: 60 },
    showlegend: false,
    height,
    xaxis: {
        gridcolor: 'rgba(148, 163, 184, 0.1)',
        zerolinecolor: 'rgba(148, 163, 184, 0.2)',
        tickfont: { size: 10, color: '#94a3b8' }
    },
    yaxis: {
        gridcolor: 'rgba(148, 163, 184, 0.1)',
        zerolinecolor: 'rgba(148, 163, 184, 0.2)',
        tickfont: { size: 10, color: '#94a3b8' }
    },
    hoverlabel: {
        bgcolor: '#1e293b',
        bordercolor: '#475569',
        font: { color: '#f8fafc', size: 12 }
    }
});

export const PlotlyChart: React.FC<PlotlyChartProps> = ({ chart, data, height = 300, onClick }) => {
    // Normalize data from backend to standard format
    const normalizedData = useMemo(() => {
        const sourceData = data || chart.data || [];
        if (!Array.isArray(sourceData) || sourceData.length === 0) return [];

        return sourceData.map((d: any) => ({
            name: String(d.name ?? d.label ?? d.x ?? d.category ?? 'Unknown'),
            value: Number(d.value ?? d.y ?? d.count ?? 0),
            x: d.x,
            y: d.y,
            size: d.size ?? d.z ?? 20
        })).filter(d => d.name !== 'Unknown' && d.name !== 'undefined' && !isNaN(d.value));
    }, [chart.data, data]);

    // Build Plotly traces based on chart type
    const plotData = useMemo((): Plotly.Data[] => {
        if (normalizedData.length === 0) return [];

        const labels = normalizedData.map(d => d.name);
        const values = normalizedData.map(d => d.value);

        switch (chart.type) {
            // ===== BAR CHARTS =====
            case 'bar':
                return [{
                    x: labels,
                    y: values,
                    type: 'bar',
                    marker: { color: COLORS[0], opacity: 0.9 },
                    hovertemplate: '<b>%{x}</b><br>Value: %{y:,.2f}<extra></extra>'
                }];

            case 'bar-horizontal':
            case 'bar_horizontal':
                return [{
                    x: values,
                    y: labels,
                    type: 'bar',
                    orientation: 'h',
                    marker: { color: COLORS[0], opacity: 0.9 },
                    hovertemplate: '<b>%{y}</b><br>Value: %{x:,.2f}<extra></extra>'
                }];

            // ===== LINE / AREA =====
            case 'line':
                return [{
                    x: labels,
                    y: values,
                    type: 'scatter',
                    mode: 'lines+markers',
                    line: { color: COLORS[2], width: 2, shape: 'spline' },
                    marker: { size: 6, color: COLORS[2] },
                    hovertemplate: '<b>%{x}</b><br>Value: %{y:,.2f}<extra></extra>'
                }];

            case 'area':
                return [{
                    x: labels,
                    y: values,
                    type: 'scatter',
                    mode: 'lines',
                    fill: 'tozeroy',
                    fillcolor: 'rgba(99, 102, 241, 0.3)',
                    line: { color: COLORS[0], width: 2 },
                    hovertemplate: '<b>%{x}</b><br>Value: %{y:,.2f}<extra></extra>'
                }];

            // ===== PIE / DONUT =====
            case 'pie':
                return [{
                    labels,
                    values,
                    type: 'pie',
                    hole: 0,
                    marker: { colors: COLORS },
                    textinfo: 'percent+label',
                    textposition: 'inside',
                    hovertemplate: '<b>%{label}</b><br>%{value:,.2f} (%{percent})<extra></extra>'
                }];

            case 'donut':
            case 'doughnut':
                return [{
                    labels,
                    values,
                    type: 'pie',
                    hole: 0.5,
                    marker: { colors: COLORS },
                    textinfo: 'percent',
                    textposition: 'inside',
                    hovertemplate: '<b>%{label}</b><br>%{value:,.2f} (%{percent})<extra></extra>'
                }];

            // ===== SCATTER / BUBBLE =====
            case 'scatter':
                return [{
                    x: normalizedData.map(d => d.x ?? d.value),
                    y: normalizedData.map(d => d.y ?? d.value * 0.8 + Math.random() * 100),
                    mode: 'markers',
                    type: 'scatter',
                    marker: {
                        size: 10,
                        color: COLORS[4],
                        opacity: 0.7,
                        line: { width: 1, color: 'white' }
                    },
                    text: labels,
                    hovertemplate: '<b>%{text}</b><br>X: %{x:.2f}<br>Y: %{y:.2f}<extra></extra>'
                }];

            case 'bubble':
                return [{
                    x: normalizedData.map(d => d.x ?? d.value),
                    y: normalizedData.map(d => d.y ?? d.value * 0.5 + Math.random() * 50),
                    mode: 'markers',
                    type: 'scatter',
                    marker: {
                        size: normalizedData.map(d => Math.min(Math.max(d.size, 10), 60)),
                        color: COLORS,
                        opacity: 0.7,
                        line: { width: 1, color: 'white' }
                    },
                    text: labels,
                    hovertemplate: '<b>%{text}</b><br>X: %{x:.2f}<br>Y: %{y:.2f}<br>Size: %{marker.size}<extra></extra>'
                }];

            // ===== FUNNEL =====
            case 'funnel':
                return [{
                    y: labels,
                    x: values,
                    type: 'funnel',
                    marker: { color: COLORS },
                    textinfo: 'value+percent total',
                    hovertemplate: '<b>%{y}</b><br>%{x:,.2f}<extra></extra>'
                }];

            // ===== GAUGE =====
            case 'gauge':
                const gaugeValue = values[0] || 0;
                const maxVal = Math.max(...values, 100);
                return [{
                    type: 'indicator',
                    mode: 'gauge+number+delta',
                    value: gaugeValue,
                    title: { text: labels[0] || 'Value', font: { size: 14, color: '#94a3b8' } },
                    gauge: {
                        axis: { range: [0, maxVal], tickcolor: '#475569' },
                        bar: { color: COLORS[0] },
                        bgcolor: '#1e293b',
                        borderwidth: 0,
                        steps: [
                            { range: [0, maxVal * 0.25], color: 'rgba(239, 68, 68, 0.3)' },
                            { range: [maxVal * 0.25, maxVal * 0.5], color: 'rgba(234, 179, 8, 0.3)' },
                            { range: [maxVal * 0.5, maxVal * 0.75], color: 'rgba(34, 197, 94, 0.3)' },
                            { range: [maxVal * 0.75, maxVal], color: 'rgba(99, 102, 241, 0.3)' }
                        ],
                        threshold: {
                            line: { color: '#f43f5e', width: 4 },
                            thickness: 0.75,
                            value: maxVal * 0.9
                        }
                    }
                } as any];

            // ===== RADAR =====
            case 'radar':
                return [{
                    r: values,
                    theta: labels,
                    type: 'scatterpolar',
                    fill: 'toself',
                    fillcolor: 'rgba(99, 102, 241, 0.3)',
                    line: { color: COLORS[0], width: 2 },
                    marker: { size: 6, color: COLORS[0] }
                }];

            // ===== TREEMAP =====
            case 'treemap':
                return [{
                    labels,
                    parents: labels.map(() => ''),
                    values,
                    type: 'treemap',
                    textinfo: 'label+value',
                    marker: {
                        colors: values,
                        colorscale: 'Blues'
                    }
                }];

            // ===== HEATMAP =====
            case 'heatmap':
                // Create a simple 1D heatmap from the data
                return [{
                    z: [values],
                    x: labels,
                    y: ['Value'],
                    type: 'heatmap',
                    colorscale: 'Viridis',
                    hovertemplate: '<b>%{x}</b><br>%{z:,.2f}<extra></extra>'
                }];

            // ===== WATERFALL =====
            case 'waterfall':
                return [{
                    x: labels,
                    y: values,
                    type: 'waterfall',
                    connector: { line: { color: '#475569' } },
                    increasing: { marker: { color: '#22c55e' } },
                    decreasing: { marker: { color: '#f43f5e' } },
                    totals: { marker: { color: COLORS[0] } },
                    hovertemplate: '<b>%{x}</b><br>%{y:,.2f}<extra></extra>'
                }];

            // ===== HISTOGRAM =====
            case 'histogram':
                return [{
                    x: values,
                    type: 'histogram',
                    marker: { color: COLORS[0], opacity: 0.8 },
                    nbinsx: 15
                }];

            // DEFAULT: Bar chart
            default:
                return [{
                    x: labels,
                    y: values,
                    type: 'bar',
                    marker: { color: COLORS[0], opacity: 0.9 },
                    hovertemplate: '<b>%{x}</b><br>Value: %{y:,.2f}<extra></extra>'
                }];
        }
    }, [chart.type, normalizedData]);

    // Build layout based on chart type
    const layout = useMemo((): Partial<Plotly.Layout> => {
        const base = getLayout(height);

        // Special layouts for certain chart types
        if (chart.type === 'radar') {
            return {
                ...base,
                polar: {
                    radialaxis: { visible: true, range: [0, Math.max(...normalizedData.map(d => d.value)) * 1.1] },
                    bgcolor: 'transparent'
                }
            };
        }

        if (chart.type === 'pie' || chart.type === 'donut' || chart.type === 'doughnut') {
            return { ...base, showlegend: true, legend: { font: { color: '#94a3b8' } } };
        }

        if (chart.type === 'gauge') {
            return { ...base, margin: { l: 30, r: 30, t: 30, b: 30 } };
        }

        if (chart.type === 'bar-horizontal') {
            return { ...base, yaxis: { ...base.yaxis, automargin: true } };
        }

        return base;
    }, [chart.type, height, normalizedData]);

    // Handle empty data
    if (normalizedData.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-800/20 rounded-xl border border-dashed border-slate-700">
                <p className="text-slate-500 text-sm">No data available for {chart.title}</p>
            </div>
        );
    }

    return (
        <Plot
            data={plotData}
            layout={layout}
            config={{
                displayModeBar: true,
                responsive: true,
                displaylogo: false,
                modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d']
            }}
            onClick={(event) => {
                if (onClick && event.points && event.points.length > 0) {
                    const point = event.points[0];
                    onClick({
                        activePayload: [{
                            payload: {
                                label: (point as any).x || (point as any).label || (point as any).y,
                                value: (point as any).y || (point as any).value || (point as any).x
                            }
                        }]
                    });
                }
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
        />
    );
};

export default PlotlyChart;
