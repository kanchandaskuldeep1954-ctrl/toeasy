import React from 'react';
import Plotly from 'react-plotly.js';
import { ChartSpec } from '../../../types';

interface PremiumSunburstProps {
    chart: ChartSpec;
    data: any[];
}

const COLOR_WAYS: any = {
    indigo: ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc"],
    emerald: ["#059669", "#10b981", "#34d399", "#6ee7b7"],
    vibrant: ["#e11d48", "#f43f5e", "#fb7185", "#fda4af"],
    ocean: ["#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc"],
    sunset: ["#d97706", "#f59e0b", "#fbbf24", "#fcd34d"],
    forest: ["#16a34a", "#22c55e", "#4ade80", "#86efac"],
    royal: ["#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd"],
    minimal: ["#0f172a", "#1e293b", "#334155", "#475569"]
};

export const PremiumSunburst: React.FC<PremiumSunburstProps> = ({ chart, data }) => {
    const labels = data.map(d => d.label || d.name);
    const parents = data.map(d => d.parent || "");
    const values = data.map(d => d.value);

    const colorway = COLOR_WAYS[chart.colorScheme as any] || COLOR_WAYS.indigo;

    return (
        <div className="w-full h-full min-h-[300px]">
            <Plotly
                data={[
                    {
                        type: 'sunburst',
                        labels: labels,
                        parents: parents,
                        values: values,
                        leaf: { opacity: 1 },
                        marker: { line: { width: 1, color: '#fff' } },
                    } as any,
                ]}
                layout={{
                    margin: { l: 0, r: 0, b: 0, t: 0 },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    autosize: true,
                    sunburstcolorway: colorway,
                    font: { family: 'Inter, sans-serif', size: 10, color: '#94a3b8' }
                } as any}
                useResizeHandler={true}
                className="w-full h-full"
                config={{ displayModeBar: false }}
            />
        </div>
    );
};
