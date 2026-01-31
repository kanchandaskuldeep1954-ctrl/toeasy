import React from 'react';
import { PlotlyChart } from './PlotlyChart';
import { PremiumBar } from './Premium/PremiumBar';
import { PremiumLine } from './Premium/PremiumLine';
import { PremiumPie } from './Premium/PremiumPie';
import { PremiumScatter } from './Premium/PremiumScatter';
import { PremiumRadar } from './Premium/PremiumRadar';
import { PremiumTreemap } from './Premium/PremiumTreemap';
import { PremiumFunnel } from './Premium/PremiumFunnel';
import { ChartSpec } from '../../types';

interface SmartChartProps {
    chart: ChartSpec;
    data?: any[];
    height?: number;
    activeFilter?: string | null;
    onClick?: (data: any) => void;
}

export const SmartChart: React.FC<SmartChartProps> = (props) => {
    const { chart, data = [] } = props;

    // --- EMPTY STATE UI ---
    if (!data || data.length === 0) {
        return (
            <div className="h-full min-h-[250px] flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">No Data Discovered</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[200px] leading-relaxed font-medium">
                    The AI couldn't find enough data points for this specific analysis. Try adjusting filters or selecting a different metric.
                </p>
            </div>
        );
    }

    // Normalize type
    const type = chart.type?.toLowerCase() || 'bar';

    // Route to Premium Engine (Recharts) for Standard BI Charts
    if (type === 'bar' || type === 'bar-horizontal' || type === 'bar_horizontal') {
        return <PremiumBar {...props} data={data} />;
    }

    if (type === 'line' || type === 'area') {
        return <PremiumLine {...props} data={data} />;
    }

    if (type === 'pie' || type === 'donut' || type === 'doughnut') {
        return <PremiumPie {...props} data={data} />;
    }

    if (type === 'scatter' || type === 'bubble') {
        return <PremiumScatter {...props} data={data} />;
    }

    if (type === 'radar') {
        return <PremiumRadar {...props} data={data} />;
    }

    if (type === 'treemap') {
        return <PremiumTreemap {...props} data={data} />;
    }

    if (type === 'funnel') {
        return <PremiumFunnel {...props} data={data} />;
    }

    // Default: Return Plotly for Scientific/Complex Charts (Heatmap, Maps, 3D, etc.)
    return <PlotlyChart {...props} data={data} />;
};
