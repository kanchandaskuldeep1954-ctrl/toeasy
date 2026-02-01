
import React from 'react';
import Plotly from 'react-plotly.js';
import { ChartSpec } from '../../../types';

interface PremiumSunburstProps {
    chart: ChartSpec;
    data: any[];
}

export const PremiumSunburst: React.FC<PremiumSunburstProps> = ({ chart, data }) => {
    // Sunburst data expects: ids, labels, parents, values
    // We assume data is already formatted for hierarchical view or we transform it.
    // If aggregateData provides { label, value, parent }, we use it.

    const labels = data.map(d => d.label || d.name);
    const parents = data.map(d => d.parent || ""); // Default to root if no parent
    const values = data.map(d => d.value);

    return (
        <div className="w-full h-full min-h-[300px]">
            <Plotly
                data={[
                    {
                        type: 'sunburst',
                        labels: labels,
                        parents: parents,
                        values: values,
                        outsidetextfont: { size: 20, color: "#377eb8" },
                        leaf: { opacity: 0.7 },
                        marker: { line: { width: 2 } },
                    },
                ]}
                layout={{
                    margin: { l: 0, r: 0, b: 0, t: 0 },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    autosize: true,
                    sunburstcolorway: ["#6366f1", "#10b981", "#f43f5e", "#8b5cf6", "#f59e0b"]
                }}
                useResizeHandler={true}
                className="w-full h-full"
                config={{ displayModeBar: false }}
            />
        </div>
    );
};
