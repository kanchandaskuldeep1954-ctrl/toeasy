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
    onUpdateChart?: (chart: ChartSpec) => void;
}

export const SmartChart: React.FC<SmartChartProps> = (props) => {
    const { chart, data = [], editMode, onResize, onDelete, onPeek, onEdit, onUpdateChart } = props;

    // --- EDIT MODE OVERLAY ---
    const EditOverlay = () => {
        const [isMoving, setIsMoving] = React.useState(false);
        const [isDraggingHandle, setIsDraggingHandle] = React.useState<string | null>(null);
        const [showPalette, setShowPalette] = React.useState(false);
        const [startPos, setStartPos] = React.useState({ x: 0, y: 0 });
        const [startSize, setStartSize] = React.useState({ w: chart.layout?.w || 6, h: chart.layout?.h || 6 });
        const [startCoords, setStartCoords] = React.useState({ x: chart.layout?.x || 0, y: chart.layout?.y || 0 });

        const PALETTES = [
            { id: 'indigo', class: 'bg-indigo-500' },
            { id: 'rose', class: 'bg-rose-500' },
            { id: 'emerald', class: 'bg-emerald-500' },
            { id: 'amber', class: 'bg-amber-500' },
            { id: 'sky', class: 'bg-sky-500' },
            { id: 'violet', class: 'bg-violet-500' },
            { id: 'ocean', class: 'bg-cyan-600' },
            { id: 'sunset', class: 'bg-orange-600' }
        ];

        const handleQuickTheme = (paletteId: string) => {
            if (onUpdateChart) {
                onUpdateChart({ ...chart, colorScheme: paletteId });
            }
            setShowPalette(false);
        };

        const handleMouseDown = (e: React.MouseEvent, direction: string | 'move') => {
            e.preventDefault();
            e.stopPropagation();
            setStartPos({ x: e.clientX, y: e.clientY });

            if (direction === 'move') {
                setIsMoving(true);
                setStartCoords({ x: chart.layout?.x || 0, y: chart.layout?.y || 0 });
            } else {
                setIsDraggingHandle(direction);
                setStartSize({ w: chart.layout?.w || 6, h: chart.layout?.h || 6 });
            }
        };

        React.useEffect(() => {
            if (!isDraggingHandle && !isMoving) return;

            let frameId: number;
            const handleMouseMove = (e: MouseEvent) => {
                cancelAnimationFrame(frameId);
                frameId = requestAnimationFrame(() => {
                    const deltaX = e.clientX - startPos.x;
                    const deltaY = e.clientY - startPos.y;

                    const gridStepX = 80;
                    const gridStepY = 40;

                    if (isMoving) {
                        const newX = Math.round(startCoords.x + deltaX / gridStepX);
                        const newY = Math.round(startCoords.y + deltaY / gridStepY);
                        // We need a separate callback for moving
                        if (newX !== chart.layout?.x || newY !== chart.layout?.y) {
                            onUpdateChart && onUpdateChart({
                                ...chart,
                                layout: { ...chart.layout, x: newX, y: newY, w: chart.layout?.w || 6, h: chart.layout?.h || 6 }
                            } as any);
                        }
                    } else if (isDraggingHandle) {
                        let newW = startSize.w;
                        let newH = startSize.h;

                        if (isDraggingHandle.includes('right')) {
                            newW = Math.min(12, Math.max(2, startSize.w + Math.round(deltaX / gridStepX)));
                        } else if (isDraggingHandle.includes('left')) {
                            newW = Math.min(12, Math.max(2, startSize.w - Math.round(deltaX / gridStepX)));
                        }

                        if (isDraggingHandle.includes('bottom')) {
                            newH = Math.max(2, startSize.h + Math.round(deltaY / gridStepY));
                        } else if (isDraggingHandle.includes('top')) {
                            newH = Math.max(2, startSize.h - Math.round(deltaY / gridStepY));
                        }

                        if (newW !== chart.layout?.w || newH !== chart.layout?.h) {
                            onResize && onResize(newW, newH);
                        }
                    }
                });
            };

            const handleMouseUp = () => {
                setIsDraggingHandle(null);
                setIsMoving(false);
                cancelAnimationFrame(frameId);
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
                cancelAnimationFrame(frameId);
            };
        }, [isDraggingHandle, isMoving, startPos, startSize, startCoords, onResize, chart, onUpdateChart]);

        return (
            <div
                onMouseDown={(e) => handleMouseDown(e, 'move')}
                className={`absolute inset-0 bg-slate-900/5 dark:bg-slate-900/40 z-[40] border-2 ${isDraggingHandle || isMoving ? 'border-indigo-400 border-dashed' : 'border-indigo-500/20 group-hover:border-indigo-500/40'} rounded-3xl grid items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[1px] overflow-hidden cursor-move`}
            >
                <div className="flex gap-3 pointer-events-auto scale-100 group-hover:scale-110 transition-transform duration-500">
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowPalette(!showPalette); }}
                            className={`p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xl hover:scale-110 transition-all ${showPalette ? 'ring-2 ring-indigo-500' : ''} text-amber-500 active:scale-95`}
                            title="Quick Palette"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                        </button>

                        {showPalette && (
                            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-2.5 rounded-2xl shadow-2xl flex gap-1.5 animate-in slide-in-from-bottom-2 zoom-in-95 z-[100]">
                                {PALETTES.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={(e) => { e.stopPropagation(); handleQuickTheme(p.id); }}
                                        className={`w-7 h-7 rounded-xl ${p.class} border-2 ${chart.colorScheme === p.id ? 'border-white ring-2 ring-indigo-500 scale-110' : 'border-transparent'} hover:scale-125 transition-all shadow-sm`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }} className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xl hover:scale-110 transition-all text-indigo-600 active:scale-95" title="Edit Configuration">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onPeek && onPeek(); }} className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xl hover:scale-110 transition-all text-cyan-500 active:scale-95" title="Inspect Data">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }} className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xl hover:scale-110 transition-all text-rose-500 active:scale-95" title="Remove Chart">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>

                <div className="absolute top-0 left-0 p-4">
                    <div className="bg-indigo-600 shadow-xl text-white text-[8px] font-black tracking-[0.2em] px-3 py-1.5 rounded-br-2xl rounded-tl-3xl pointer-events-none uppercase flex items-center gap-2 border-b border-r border-white/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {isMoving ? 'Moving Analysis' : 'Studio Active'}
                    </div>
                </div>

                {/* --- 8-Point Resizing System --- */}
                {/* Corners */}
                <div onMouseDown={(e) => handleMouseDown(e, 'top-left')} className="absolute top-0 left-0 w-10 h-10 cursor-nw-resize z-[60] pointer-events-auto" />
                <div onMouseDown={(e) => handleMouseDown(e, 'top-right')} className="absolute top-0 right-0 w-10 h-10 cursor-ne-resize z-[60] pointer-events-auto" />
                <div onMouseDown={(e) => handleMouseDown(e, 'bottom-left')} className="absolute bottom-0 left-0 w-10 h-10 cursor-sw-resize z-[60] pointer-events-auto" />
                <div onMouseDown={(e) => handleMouseDown(e, 'bottom-right')} className="absolute bottom-0 right-0 w-10 h-10 cursor-se-resize z-[60] pointer-events-auto" />

                {/* Edges */}
                <div onMouseDown={(e) => handleMouseDown(e, 'top')} className="absolute top-0 left-10 right-10 h-5 cursor-n-resize z-[60] pointer-events-auto" />
                <div onMouseDown={(e) => handleMouseDown(e, 'bottom')} className="absolute bottom-0 left-10 right-10 h-5 cursor-s-resize z-[60] pointer-events-auto" />
                <div onMouseDown={(e) => handleMouseDown(e, 'left')} className="absolute left-0 top-10 bottom-10 w-5 cursor-w-resize z-[60] pointer-events-auto" />
                <div onMouseDown={(e) => handleMouseDown(e, 'right')} className="absolute right-0 top-10 bottom-10 w-5 cursor-e-resize z-[60] pointer-events-auto" />

                {/* Visual Indicators (Corners) */}
                <div className="absolute bottom-1.5 right-1.5 w-6 h-6 border-r-[3px] border-b-[3px] border-indigo-500 rounded-br-[6px] pointer-events-none opacity-80" />
                <div className="absolute top-1.5 left-1.5 w-6 h-6 border-l-[3px] border-t-[3px] border-indigo-500 rounded-tl-[6px] pointer-events-none opacity-20" />
                <div className="absolute top-1.5 right-1.5 w-6 h-6 border-r-[3px] border-t-[3px] border-indigo-500 rounded-tr-[6px] pointer-events-none opacity-20" />
                <div className="absolute bottom-1.5 left-1.5 w-6 h-6 border-l-[3px] border-b-[3px] border-indigo-500 rounded-bl-[6px] pointer-events-none opacity-20" />
            </div>
        );
    };

    // --- EMPTY STATE UI ---
    if (!data || !Array.isArray(data) || data.length === 0) {
        return (
            <div className="h-full min-h-[250px] flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 animate-in fade-in duration-500 relative overflow-hidden group">
                {editMode && <EditOverlay />}
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
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumRadar {...props} data={data} /></div>;
    }

    if (type === 'treemap') {
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumTreemap {...props} data={data} /></div>;
    }

    if (type === 'funnel') {
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumFunnel {...props} data={data} /></div>;
    }

    if (type === 'sunburst') {
        return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PremiumSunburst {...props} data={data} /></div>;
    }

    // Default: Return Plotly for Scientific/Complex Charts (Heatmap, Maps, 3D, etc.)
    return <div className="relative h-full w-full">{editMode && <EditOverlay />}<PlotlyChart {...props} data={data} /></div>;
};
