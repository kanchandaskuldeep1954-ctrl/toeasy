import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { ChartSpec } from '../../types';

interface PlotlyChartProps {
    chart: ChartSpec;
    data?: any[];
    height?: number;
    onClick?: (data: any) => void;
}

// Professional BI color palette - Inspired by PowerBI/Tableau
const COLORS = [
    '#2563eb', // Steel Blue
    '#64748b', // Slate
    '#0f172a', // Deep Navy
    '#3b82f6', // Bright Blue
    '#6366f1', // Indigo
    '#94a3b8', // Light Slate
    '#1e293b', // Subdued Navy
    '#475569'  // Mid Slate
];

// Modern theme-responsive professional layout
const getLayout = (height: number, isDark: boolean): Partial<Plotly.Layout> => ({
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
        family: "'Inter', system-ui, sans-serif",
        color: isDark ? '#f1f5f9' : '#1e293b',
        size: 11
    },
    autosize: true,
    margin: { l: 80, r: 30, t: 40, b: 100 }, // Increased margins for long labels
    showlegend: false,
    height,
    xaxis: {
        gridcolor: isDark ? 'rgba(241, 245, 249, 0.03)' : 'rgba(30, 41, 59, 0.03)',
        zerolinecolor: isDark ? 'rgba(241, 245, 249, 0.08)' : 'rgba(30, 41, 59, 0.08)',
        tickfont: { size: 9, color: isDark ? '#94a3b8' : '#64748b' },
        automargin: true,
        tickangle: -45 // Angle labels for better fit
    },
    yaxis: {
        gridcolor: isDark ? 'rgba(241, 245, 249, 0.03)' : 'rgba(30, 41, 59, 0.03)',
        zerolinecolor: isDark ? 'rgba(241, 245, 249, 0.08)' : 'rgba(30, 41, 59, 0.08)',
        tickfont: { size: 9, color: isDark ? '#94a3b8' : '#64748b' },
        automargin: true
    },
    hoverlabel: {
        bgcolor: isDark ? '#0f172a' : '#ffffff',
        bordercolor: isDark ? '#1e293b' : '#e2e8f0',
        font: { color: isDark ? '#f8fafc' : '#0f172a', size: 12 },
        align: 'left'
    }
});

export const PlotlyChart: React.FC<PlotlyChartProps> = ({ chart, data, height = 300, onClick }) => {
    const isDark = useMemo(() => {
        if (typeof document === 'undefined') return false;
        return document.documentElement.classList.contains('dark') ||
            document.body.classList.contains('dark') ||
            window.matchMedia('(prefers-color-scheme: dark)').matches;
    }, []);

    // Normalize data from backend to standard format
    const normalizedData = useMemo(() => {
        const sourceData = data || chart.data || [];
        if (!Array.isArray(sourceData) || sourceData.length === 0) return [];

        return sourceData.map((d: any) => ({
            name: String(d.name ?? d.label ?? d.x ?? d.category ?? 'Unknown'),
            value: Number(d.value ?? d.y ?? d.count ?? 0),
            x: d.x,
            y: d.y,
            size: d.size ?? d.z ?? 20,
            parent: d.parent
        })).filter(d => d.name !== 'Unknown' && d.name !== 'undefined' && !isNaN(d.value));
    }, [chart.data, data]);

    // Build Plotly traces based on chart type
    const plotData = useMemo((): Plotly.Data[] => {
        if (normalizedData.length === 0) return [];

        const labels = normalizedData.map(d => d.name);
        const values = normalizedData.map(d => d.value);

        switch (chart.type) {
            // ===== MAPS & CHOROPLETH =====
            case 'map':
            case 'choropleth':
                return [{
                    type: 'choropleth',
                    locationmode: 'country names',
                    locations: labels,
                    z: values,
                    colorscale: 'Viridis',
                    reversescale: false,
                    marker: { line: { color: isDark ? '#1e293b' : '#94a3b8', width: 0.5 } },
                    hovertemplate: '<b>%{location}</b><br>Value: %{z:,.2f}<extra></extra>'
                }];

            case 'bubble_map':
            case 'scattergeo':
                return [{
                    type: 'scattergeo',
                    locationmode: 'country names',
                    locations: labels,
                    marker: {
                        size: values.map(v => Math.sqrt(v) * 2), // Scale bubble size
                        color: values,
                        colorscale: 'Viridis',
                        line: { color: isDark ? '#1e293b' : '#94a3b8', width: 0.5 },
                        opacity: 0.9
                    },
                    hovertemplate: '<b>%{location}</b><br>Value: %{marker.color:,.2f}<extra></extra>'
                }];

            // ===== HIERARCHICAL =====
            case 'sunburst':
                return [{
                    type: 'sunburst',
                    labels: labels,
                    parents: normalizedData.map(d => d.parent || ''), // Expect parent field if available
                    values: values,
                    leaf: { opacity: 0.8 },
                    marker: { line: { width: 1, color: 'white' }, colorscale: 'Viridis' },
                    hovertemplate: '<b>%{label}</b><br>Value: %{value:,.2f}<extra></extra>'
                } as any];

            // ===== STATISTICAL =====
            case 'box':
                return [{
                    y: values,
                    type: 'box',
                    name: chart.title || 'Distribution',
                    marker: { color: COLORS[0] },
                    boxpoints: 'outliers'
                }];

            case 'violin':
                return [{
                    y: values,
                    type: 'violin',
                    name: chart.title || 'Distribution',
                    marker: { color: COLORS[1] },
                    box: { visible: true },
                    meanline: { visible: true }
                }];

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
                const lineColor = isDark ? '#a5b4fc' : '#2563eb'; // Brighter Indigo in dark mode
                return [{
                    x: labels,
                    y: values,
                    type: 'scatter',
                    mode: 'lines+markers',
                    line: { color: lineColor, width: 3.5, shape: 'spline' },
                    marker: {
                        size: 9,
                        color: lineColor,
                        line: { width: 2, color: isDark ? '#0f172a' : 'white' }
                    },
                    hovertemplate: '<b>%{x}</b><br>Value: %{y:,.2f}<extra></extra>'
                }];

            case 'area':
                return [{
                    x: labels,
                    y: values,
                    type: 'scatter',
                    mode: 'lines',
                    fill: 'tozeroy',
                    fillcolor: isDark ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                    line: { color: COLORS[0], width: 2, shape: 'spline' },
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
                } as any];

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
            case 'scatter': {
                const xValues = normalizedData.map(d => d.x ?? d.value);
                const yValues = normalizedData.map(d => d.y ?? d.value);
                const isBinaryY = yValues.every(v => [0, 1].includes(v));

                const traces: Plotly.Data[] = [{
                    x: xValues,
                    y: yValues.map(val => isBinaryY ? val + (Math.random() - 0.5) * 0.05 : val),
                    mode: 'markers',
                    type: 'scatter',
                    marker: {
                        size: 10,
                        color: COLORS[0],
                        opacity: 0.6,
                        line: { width: 1.5, color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                    },
                    text: labels,
                    hovertemplate: '<b>%{text}</b><br>X: %{x:.2f}<br>Y: %{y:.2f}<extra></extra>'
                }];

                // Scientific Overlay: OLS Trendline
                if (chart.chartConfig?.trendline === 'ols' && xValues.length > 1) {
                    const n = xValues.length;
                    const sumX = xValues.reduce((a, b) => a + b, 0);
                    const sumY = yValues.reduce((a, b) => a + b, 0);
                    const sumXY = xValues.reduce((a, b, i) => a + b * yValues[i], 0);
                    const sumXX = xValues.reduce((a, b) => a + b * b, 0);
                    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    const intercept = (sumY - slope * sumX) / n;

                    const minX = Math.min(...xValues);
                    const maxX = Math.max(...xValues);
                    traces.push({
                        x: [minX, maxX],
                        y: [slope * minX + intercept, slope * maxX + intercept],
                        mode: 'lines',
                        type: 'scatter',
                        name: 'OLS Trend',
                        line: { color: isDark ? 'rgba(244, 63, 94, 0.4)' : '#f43f5e', width: 2 },
                        hoverinfo: 'none'
                    });

                    // Next-Gen: Predictive Ghost Line
                    const futureX = maxX + (maxX - minX) * 0.4;
                    traces.push({
                        x: [maxX, futureX],
                        y: [slope * maxX + intercept, slope * futureX + intercept],
                        mode: 'lines',
                        type: 'scatter',
                        name: 'AI Forecast',
                        line: { color: isDark ? '#818cf8' : COLORS[0], width: 3, dash: 'dot' },
                        opacity: 0.6,
                        hoverinfo: 'none'
                    });
                }

                return traces;
            }

            case 'bubble':
                return [{
                    x: normalizedData.map(d => d.x ?? d.value),
                    y: normalizedData.map(d => d.y ?? d.value * 0.5),
                    mode: 'markers',
                    type: 'scatter',
                    marker: {
                        size: normalizedData.map(d => Math.min(Math.max(d.size * 1.5, 12), 80)),
                        color: normalizedData.map((_, i) => COLORS[i % COLORS.length]),
                        opacity: 0.7,
                        line: { width: 1.5, color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' },
                        colorscale: 'Viridis',
                        showscale: false
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
                } as any];

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
                } as any];

            // ===== HISTOGRAM =====
            case 'histogram':
                return [{
                    x: values,
                    type: 'histogram',
                    marker: { color: COLORS[0], opacity: 0.8 },
                    nbinsx: 15
                } as any];

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
    }, [chart.type, normalizedData, isDark]);

    // Build layout based on chart type
    const layout = useMemo((): Partial<Plotly.Layout> => {
        const base = getLayout(height, isDark);

        // Special layouts for certain chart types
        if (chart.type === 'choropleth' || chart.type === 'scattergeo' || chart.type === 'map' || chart.type === 'bubble_map') {
            return {
                ...base,
                geo: {
                    showframe: false,
                    showcoastlines: true,
                    showcountries: true,
                    projection: { type: 'equirectangular' },
                    bgcolor: 'transparent',
                    coastlinecolor: isDark ? 'rgba(148, 163, 184, 0.4)' : '#64748b',
                    landcolor: isDark ? 'rgba(30, 41, 59, 1)' : '#f8fafc',
                    countrycolor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#cbd5e1'
                },
                margin: { l: 0, r: 0, t: 30, b: 0 }
            };
        }

        if (chart.type === 'sunburst') {
            return { ...base, margin: { l: 0, r: 0, t: 30, b: 0 } };
        }

        if (chart.type === 'radar') {
            return {
                ...base,
                polar: {
                    radialaxis: {
                        visible: true,
                        range: [0, Math.max(...normalizedData.map(d => d.value)) * 1.1],
                        gridcolor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(203, 213, 225, 0.4)',
                        tickfont: { color: isDark ? '#94a3b8' : '#64748b' }
                    },
                    bgcolor: 'transparent'
                }
            };
        }

        if (chart.type === 'pie' || chart.type === 'donut' || chart.type === 'doughnut') {
            return { ...base, showlegend: true, legend: { font: { color: isDark ? '#94a3b8' : '#475569' } } };
        }

        if (chart.type === 'gauge') {
            return { ...base, margin: { l: 30, r: 30, t: 30, b: 30 } };
        }

        if (chart.type === 'bar-horizontal' || chart.type === 'bar_horizontal') {
            return { ...base, yaxis: { ...base.yaxis, automargin: true } };
        }

        return base;
    }, [chart.type, height, normalizedData, isDark]);

    // Handle empty data
    if (normalizedData.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/20 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-800/50 p-8 text-center animate-in fade-in zoom-in-95 duration-700">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                    <svg className="w-6 h-6 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">Discovery Bound</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500/80 leading-relaxed max-w-[220px] font-medium">
                    No matching patterns found for <span className="text-indigo-500 dark:text-indigo-400">"{chart.title}"</span> with the current active filters.
                </p>
                <div className="mt-4 flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                    <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                    <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                </div>
            </div>
        );
    }

    try {
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
                                    label: (point as any).x || (point as any).label || (point as any).y || (point as any).location,
                                    value: (point as any).y || (point as any).value || (point as any).x || (point as any).z
                                }
                            }]
                        });
                    }
                }}
                style={{ width: '100%', height: '100%' }}
                useResizeHandler={true}
            />
        );
    } catch (e) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 dark:bg-rose-950/10 rounded-2xl border border-rose-200 dark:border-rose-900/30 p-6 text-center">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Chart Engine Error</p>
                <p className="text-[9px] text-rose-400 mt-1">Failed to initialize WebGL or Chart Layout.</p>
            </div>
        );
    }
};

export default PlotlyChart;
