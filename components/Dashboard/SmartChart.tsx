import React from 'react';
import { PlotlyChart } from './PlotlyChart';
import { PremiumBar } from './Premium/PremiumBar';
import { PremiumLine } from './Premium/PremiumLine';
import { PremiumPie } from './Premium/PremiumPie';
import { PremiumScatter } from './Premium/PremiumScatter';
import { PremiumRadar } from './Premium/PremiumRadar';
import { PremiumTreemap } from './Premium/PremiumTreemap';
import { PremiumFunnel } from './Premium/PremiumFunnel';
import { PremiumSunburst } from './Premium/PremiumSunburst';
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
    onEdit?: () => void;
}

export const SmartChart: React.FC<SmartChartProps> = (props) => {
    const { chart, data = [], editMode, onResize, onDelete, onPeek, onEdit } = props;

    // --- EDIT MODE OVERLAY ---
    const EditOverlay = () => {
        const [isDraggingHandle, setIsDraggingHandle] = React.useState<string | null>(null);
        const [startPos, setStartPos] = React.useState({ x: 0, y: 0 });
        const [startSize, setStartSize] = React.useState({ w: chart.layout?.w || 6, h: chart.layout?.h || 6 });

        const handleMouseDown = (e: React.MouseEvent, direction: string) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingHandle(direction);
            setStartPos({ x: e.clientX, y: e.clientY });
            setStartSize({ w: chart.layout?.w || 6, h: chart.layout?.h || 6 });
        };

        React.useEffect(() => {
            if (!isDraggingHandle) return;

            const handleMouseMove = (e: MouseEvent) => {
                const deltaX = e.clientX - startPos.x;
                const deltaY = e.clientY - startPos.y;

                // Estimate grid unit size (12 columns on large screens)
                const gridStepX = 80; // adjusted pixels per column
                const gridStepY = 40; // adjusted pixels per row

                let newW = startSize.w;
                let newH = startSize.h;

                if (isDraggingHandle.includes('right')) {
                    newW = Math.min(12, Math.max(1, startSize.w + Math.round(deltaX / gridStepX)));
                } else if (isDraggingHandle.includes('left')) {
                    newW = Math.min(12, Math.max(1, startSize.w - Math.round(deltaX / gridStepX)));
                }

                if (isDraggingHandle.includes('bottom')) {
                    newH = Math.max(1, startSize.h + Math.round(deltaY / gridStepY));
                } else if (isDraggingHandle.includes('top')) {
                    newH = Math.max(1, startSize.h - Math.round(deltaY / gridStepY));
                }

                if (newW !== chart.layout?.w || newH !== chart.layout?.h) {
                    onResize && onResize(newW, newH);
                }
            };

            const handleMouseUp = () => {
                setIsDraggingHandle(null);
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }, [isDraggingHandle, startPos, startSize]);

        return (
            <div className={`absolute inset-0 bg-indigo-500/5 dark:bg-indigo-500/10 z-50 border-2 ${isDraggingHandle ? 'border-indigo-400 border-dashed' : 'border-indigo-500/50 group-hover:border-indigo-500'} rounded-3xl grid items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]`}>
                <div className="flex gap-2">
                    <button onClick={onEdit} className="p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:scale-110 transition text-indigo-600 active:scale-90" title="Edit Configuration">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={onPeek} className="p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:scale-110 transition text-indigo-500 active:scale-90" title="Inspect Data">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    <button onClick={onDelete} className="p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:scale-110 transition text-red-500 active:scale-90" title="Remove Chart">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>

                <div className="absolute top-2 left-3 bg-indigo-600/90 text-white text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full shadow-lg pointer-events-none uppercase">
                    Layout Mode
                </div>

                {/* --- 8-Point Resizing System --- */}
                {/* Corners */}
                <div onMouseDown={(e) => handleMouseDown(e, 'top-left')} className="absolute top-0 left-0 w-6 h-6 cursor-nw-resize z-[60]" />
                <div onMouseDown={(e) => handleMouseDown(e, 'top-right')} className="absolute top-0 right-0 w-6 h-6 cursor-ne-resize z-[60]" />
                <div onMouseDown={(e) => handleMouseDown(e, 'bottom-left')} className="absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize z-[60]" />
                <div onMouseDown={(e) => handleMouseDown(e, 'bottom-right')} className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-[60]" />

                {/* Edges */}
                <div onMouseDown={(e) => handleMouseDown(e, 'top')} className="absolute top-0 left-6 right-6 h-3 cursor-n-resize z-[60]" />
                <div onMouseDown={(e) => handleMouseDown(e, 'bottom')} className="absolute bottom-0 left-6 right-6 h-3 cursor-s-resize z-[60]" />
                <div onMouseDown={(e) => handleMouseDown(e, 'left')} className="absolute left-0 top-6 bottom-6 w-3 cursor-w-resize z-[60]" />
                <div onMouseDown={(e) => handleMouseDown(e, 'right')} className="absolute right-0 top-6 bottom-6 w-3 cursor-e-resize z-[60]" />

                {/* Visual Indicators (Corners) */}
                <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-indigo-500 rounded-br-[4px] pointer-events-none opacity-40" />
                <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-indigo-500 rounded-tl-[4px] pointer-events-none opacity-40" />
                <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-indigo-500 rounded-tr-[4px] pointer-events-none opacity-40" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-indigo-500 rounded-bl-[4px] pointer-events-none opacity-40" />
            </div>
        );
    };

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
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumBar {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} /></div>;
    }

    if (type === 'line' || type === 'area') {
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumLine {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} /></div>;
    }

    if (type === 'pie' || type === 'donut' || type === 'doughnut') {
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumPie {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} /></div>;
    }

    if (type === 'scatter' || type === 'bubble') {
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumScatter {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} /></div>;
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

    if (type === 'sunburst') {
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumSunburst {...props} data={data} /></div>;
    }

    // Default: Return Plotly for Scientific/Complex Charts (Heatmap, Maps, 3D, etc.)
    return <PlotlyChart {...props} data={data} />;
};
