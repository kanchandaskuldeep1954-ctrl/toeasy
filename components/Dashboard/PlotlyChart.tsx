import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { ChartSpec } from '../../types';

interface PlotlyChartProps {
    chart: ChartSpec;
    data?: any[];
    height?: number;
    onClick?: (data: any) => void;
}

// Modern dark theme for Plotly
const PLOTLY_LAYOUT: Partial<Plotly.Layout> = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'Inter, system-ui, sans-serif', color: '#94a3b8', size: 11 },
    margin: { l: 50, r: 20, t: 40, b: 50 },
    showlegend: true,
    legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center' },
    xaxis: {
        gridcolor: 'rgba(148, 163, 184, 0.1)',
        zerolinecolor: 'rgba(148, 163, 184, 0.2)',
        tickfont: { size: 10 }
    },
    yaxis: {
        gridcolor: 'rgba(148, 163, 184, 0.1)',
        zerolinecolor: 'rgba(148, 163, 184, 0.2)',
        tickfont: { size: 10 }
    },
    hoverlabel: {
        bgcolor: '#1e293b',
        bordercolor: '#475569',
        font: { color: '#f8fafc', size: 12 }
    }
};

// Professional color palette
const COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];

export const PlotlyChart: React.FC<PlotlyChartProps> = ({ chart, data, height = 300, onClick }) => {
    // Transform data based on chart type
    const plotData = useMemo((): Plotly.Data[] => {
        const sourceData = data || chart.data || [];
        if (!Array.isArray(sourceData) || sourceData.length === 0) return [];

        // Extract labels and values with fallbacks
        const labels = sourceData.map((d: any) =>
            String(d.name ?? d.label ?? d.x ?? d.category ?? 'Unknown')
        ).filter(l => l !== 'Unknown' && l !== 'undefined' && l !== 'null');

        const values = sourceData.map((d: any) => {
            const val = Number(d.value ?? d.y ?? d.count ?? d.size ?? 0);
            return isNaN(val) ? 0 : val;
        });

        switch (chart.type) {
            case 'bar':
            case 'histogram':
                return [{
                    x: labels,
                    y: values,
                    type: 'bar',
                    marker: {
                        color: COLORS[0],
                        line: { width: 0 },
                        opacity: 0.9
                    },
                    hovertemplate: '<b>%{x}</b><br>Value: %{y:,.0f}<extra></extra>'
                }];

            case 'line':
            case 'area':
                return [{
                    x: labels,
                    y: values,
                    type: 'scatter',
                    mode: 'lines+markers',
                    fill: chart.type === 'area' ? 'tozeroy' : undefined,
                    line: { color: COLORS[2], width: 2, shape: 'spline' },
                    marker: { size: 6, color: COLORS[2] },
                    fillcolor: chart.type === 'area' ? 'rgba(99, 102, 241, 0.2)' : undefined,
                    hovertemplate: '<b>%{x}</b><br>Value: %{y:,.0f}<extra></extra>'
                }];

            case 'pie':
            case 'doughnut':
                return [{
                    labels,
                    values,
                    type: 'pie',
                    hole: chart.type === 'doughnut' ? 0.5 : 0,
                    marker: { colors: COLORS },
                    textinfo: 'percent',
                    textposition: 'inside',
                    hovertemplate: '<b>%{label}</b><br>%{value:,.0f} (%{percent})<extra></extra>'
                }];

            case 'scatter':
            case 'bubble':
                const xVals = sourceData.map((d: any) => Number(d.x ?? 0));
                const yVals = sourceData.map((d: any) => Number(d.y ?? 0));
                const sizes = sourceData.map((d: any) => Math.max(10, Number(d.size ?? d.value ?? 15)));
                return [{
                    x: xVals,
                    y: yVals,
                    mode: 'markers',
                    type: 'scatter',
                    marker: {
                        size: sizes,
                        color: COLORS[4],
                        opacity: 0.7,
                        line: { width: 1, color: '#fff' }
                    },
                    text: labels,
                    hovertemplate: '<b>%{text}</b><br>X: %{x}<br>Y: %{y}<extra></extra>'
                }];

            case 'funnel':
                return [{
                    y: labels,
                    x: values,
                    type: 'funnel',
                    marker: { color: COLORS },
                    textinfo: 'value+percent total',
                    hovertemplate: '<b>%{y}</b><br>%{x:,.0f}<extra></extra>'
                }];

            case 'heatmap':
                // For heatmap, we need a 2D array - simplified version
                return [{
                    z: [values],
                    x: labels,
                    type: 'heatmap',
                    colorscale: 'Viridis',
                    hovertemplate: '<b>%{x}</b><br>Value: %{z}<extra></extra>'
                }];

            case 'treemap':
                return [{
                    labels,
                    parents: labels.map(() => ''),
                    values,
                    type: 'treemap',
                    textinfo: 'label+value',
                    marker: { colors: COLORS }
                }];

            case 'waterfall':
                return [{
                    x: labels,
                    y: values,
                    type: 'waterfall',
                    connector: { line: { color: '#475569' } },
                    increasing: { marker: { color: '#22c55e' } },
                    decreasing: { marker: { color: '#f43f5e' } },
                    hovertemplate: '<b>%{x}</b><br>%{y:,.0f}<extra></extra>'
                }];

            case 'radar':
                return [{
                    r: values,
                    theta: labels,
                    type: 'scatterpolar',
                    fill: 'toself',
                    fillcolor: 'rgba(99, 102, 241, 0.3)',
                    line: { color: COLORS[0] }
                }];

            // Default to bar chart
            default:
                return [{
                    x: labels,
                    y: values,
                    type: 'bar',
                    marker: { color: COLORS[0], opacity: 0.9 },
                    hovertemplate: '<b>%{x}</b><br>Value: %{y:,.0f}<extra></extra>'
                }];
        }
    }, [chart, data]);

    // Build layout with chart title
    const layout = useMemo((): Partial<Plotly.Layout> => ({
        ...PLOTLY_LAYOUT,
        height,
        title: undefined, // We handle title externally
        xaxis: {
            ...PLOTLY_LAYOUT.xaxis,
            title: chart.xAxis || undefined
        },
        yaxis: {
            ...PLOTLY_LAYOUT.yaxis,
            title: chart.yAxis || undefined
        }
    }), [chart, height]);

    // Handle empty data
    if (plotData.length === 0 || (plotData[0] as any).x?.length === 0) {
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
                                label: (point as any).x || (point as any).label,
                                value: (point as any).y || (point as any).value
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
