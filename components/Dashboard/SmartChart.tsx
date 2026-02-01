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
    editMode?: boolean;
    onResize?: (w: number, h: number) => void;
    onDelete?: () => void;
    onPeek?: () => void;
}

export const SmartChart: React.FC<SmartChartProps> = (props) => {
    const { chart, data = [], editMode, onResize, onDelete, onPeek } = props;

    // --- EDIT MODE OVERLAY ---
    const EditOverlay = () => (
        <div className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 z-50 border-2 border-indigo-500 rounded-3xl grid items-center justify-center opacity-0 hover:opacity-100 transition-opacity backdrop-blur-[2px]">
            <div className="flex gap-2">
                <button onClick={onPeek} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:scale-110 transition text-indigo-500" title="Inspect Data">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
                <button onClick={onDelete} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:scale-110 transition text-red-500" title="Remove Chart">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                <div className="flex flex-col gap-1 ml-4 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-xl">
                    <button onClick={() => onResize && onResize(1, 1)} className="w-6 h-6 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-[10px] font-bold">1x</button>
                    <button onClick={() => onResize && onResize(2, 1)} className="w-6 h-6 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-[10px] font-bold">2x</button>
                    <button onClick={() => onResize && onResize(2, 2)} className="w-6 h-6 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-[10px] font-bold">Full</button>
                </div>
            </div>
            <div className="absolute top-2 left-3 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg pointer-events-none">
                EDIT MODE
            </div>
        </div>
    );

    // --- EMPTY STATE UI ---
    if (!data || !Array.isArray(data) || data.length === 0) {
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
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumBar {...props} data={data} /></div>;
    }

    if (type === 'line' || type === 'area') {
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumLine {...props} data={data} /></div>;
    }

    if (type === 'pie' || type === 'donut' || type === 'doughnut') {
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumPie {...props} data={data} /></div>;
    }

    if (type === 'scatter' || type === 'bubble') {
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumScatter {...props} data={data} /></div>;
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
