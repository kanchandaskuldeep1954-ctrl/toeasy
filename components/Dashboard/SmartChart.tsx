import React, { useRef, useState, useEffect } from 'react';
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
    hideHeader?: boolean;
    hidePadding?: boolean;
    onDragUpdate?: (layout: { x: number, y: number, w: number, h: number } | null, offset?: { x: number, y: number }) => void;
}

export const SmartChart: React.FC<SmartChartProps> = (props) => {
    const { chart, data = [], editMode, onResize, onDelete, onPeek, onEdit, onUpdateChart, onDragUpdate, title, chartType, onAiExplain, hideHeader, hidePadding } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const [isMoving, setIsMoving] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null);
    const [showPalette, setShowPalette] = useState(false);

    const PALETTES = [
        { id: 'indigo', class: 'bg-indigo-500' },
        { id: 'emerald', class: 'bg-emerald-500' },
        { id: 'vibrant', class: 'bg-rose-500' },
        { id: 'ocean', class: 'bg-sky-500' },
        { id: 'sunset', class: 'bg-orange-500' },
        { id: 'forest', class: 'bg-green-600' },
        { id: 'royal', class: 'bg-violet-600' },
        { id: 'minimal', class: 'bg-slate-600' }
    ];

    const interaction = useRef({
        startX: 0, startY: 0,
        startRect: { x: 0, y: 0, w: 0, h: 0 },
        gridStepX: 80, gridStepY: 40,
        currentGhost: null as any
    });

    const handleMouseDown = (e: React.MouseEvent, type: 'move' | string) => {
        e.preventDefault(); e.stopPropagation();
        const parent = containerRef.current?.closest('.grid');
        if (!parent) return;

        interaction.current.gridStepX = parent.clientWidth / 12;
        interaction.current.gridStepY = 40;
        interaction.current.startX = e.clientX;
        interaction.current.startY = e.clientY;
        interaction.current.startRect = {
            x: chart.layout?.x || 0, y: chart.layout?.y || 0,
            w: chart.layout?.w || 6, h: chart.layout?.h || 6
        };
        interaction.current.currentGhost = { ...interaction.current.startRect };

        if (type === 'move') setIsMoving(true);
        else setIsResizing(type);
        onDragUpdate?.(interaction.current.currentGhost);
    };

    useEffect(() => {
        if (!isMoving && !isResizing) return;
        let frameId: number;
        const handleMouseMove = (e: MouseEvent) => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => {
                const deltaX = e.clientX - interaction.current.startX;
                const deltaY = e.clientY - interaction.current.startY;
                const { gridStepX, gridStepY, startRect } = interaction.current;

                if (isMoving) {
                    const snapX = Math.max(0, Math.min(12 - startRect.w, Math.round(startRect.x + deltaX / gridStepX)));
                    const snapY = Math.max(0, Math.round(startRect.y + deltaY / gridStepY));
                    if (snapX !== interaction.current.currentGhost.x || snapY !== interaction.current.currentGhost.y || true) {
                        interaction.current.currentGhost = { ...interaction.current.currentGhost, x: snapX, y: snapY };
                        onDragUpdate?.(interaction.current.currentGhost, { x: deltaX, y: deltaY });
                    }
                } else if (isResizing) {
                    let dw = 0, dh = 0;
                    if (isResizing.includes('right')) dw = Math.round(deltaX / gridStepX);
                    if (isResizing.includes('bottom')) dh = Math.round(deltaY / gridStepY);
                    const newW = Math.max(2, Math.min(12, startRect.w + dw));
                    const newH = Math.max(2, startRect.h + dh);
                    if (newW !== interaction.current.currentGhost.w || newH !== interaction.current.currentGhost.h) {
                        interaction.current.currentGhost = { ...interaction.current.currentGhost, w: newW, h: newH };
                        onDragUpdate?.(interaction.current.currentGhost);
                    }
                }
            });
        };

        const handleMouseUp = () => {
            if (interaction.current.currentGhost) {
                const { x, y, w, h } = interaction.current.currentGhost;
                if (isMoving) onUpdateChart?.({ ...chart, layout: { ...(chart.layout || {}), x, y, w, h } });
                else if (isResizing) onResize?.(w, h);
            }
            if (overlayRef.current?.parentElement) {
                overlayRef.current.parentElement.style.transform = '';
                overlayRef.current.parentElement.style.zIndex = '';
            }
            setIsMoving(false); setIsResizing(null); onDragUpdate?.(null);
        };

        window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); cancelAnimationFrame(frameId); };
    }, [isMoving, isResizing, chart, onUpdateChart, onResize, onDragUpdate]);

    const EditOverlay = () => (
        <div ref={overlayRef} onMouseDown={(e) => handleMouseDown(e, 'move')} className={`absolute inset-0 z-[50] rounded-3xl cursor-move transition-all duration-300 ${isMoving || isResizing ? 'bg-indigo-500/10 border-2 border-indigo-500 shadow-2xl backdrop-blur-sm' : 'bg-slate-900/5 group-hover:bg-indigo-500/10 border-2 border-transparent group-hover:border-indigo-500/20'} flex items-center justify-center opacity-0 group-hover:opacity-100`}>
            <div className="flex gap-2 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
                {onAiExplain && (
                    <button onClick={(e) => { e.stopPropagation(); onAiExplain(); }} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-lg text-emerald-500 hover:scale-110 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                )}
                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setShowPalette(!showPalette); }} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-lg text-amber-500 hover:scale-110 active:scale-95 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg></button>
                    {showPalette && <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl flex gap-1.5 border border-slate-200 dark:border-white/10 z-[100] animate-in zoom-in-95 duration-200">
                        {PALETTES.map(p => <button key={p.id} onClick={(e) => { e.stopPropagation(); onUpdateChart?.({ ...chart, colorScheme: p.id }); }} className={`w-6 h-6 rounded-lg ${p.class} border-2 ${chart.colorScheme === p.id ? 'border-white' : 'border-transparent'} hover:scale-125 transition-all`} />)}
                    </div>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); onEdit?.(); }} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-lg text-indigo-500 hover:scale-110 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                <button onClick={(e) => { e.stopPropagation(); onDelete?.(); }} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-lg text-rose-500 hover:scale-110 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
            <div onMouseDown={(e) => handleMouseDown(e, 'right')} className="absolute right-0 top-0 bottom-8 w-3 hover:bg-indigo-500/20 cursor-e-resize z-[60]" />
            <div onMouseDown={(e) => handleMouseDown(e, 'bottom')} className="absolute bottom-0 left-0 right-8 h-3 hover:bg-indigo-500/20 cursor-s-resize z-[60]" />
            <div onMouseDown={(e) => handleMouseDown(e, 'bottom-right')} className="absolute bottom-0 right-0 w-8 h-8 hover:bg-indigo-500/40 cursor-se-resize flex items-end justify-end p-1 z-[60]"><div className="w-2.5 h-2.5 border-r-2 border-b-2 border-indigo-500/50" /></div>
        </div>
    );

    const type = chart.type?.toLowerCase() || 'bar';
    const chartContent = (() => {
        if (!data?.length) return <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Insights Discovered</p></div>;
        if (['bar', 'bar-horizontal', 'bar_horizontal'].includes(type)) return <PremiumBar {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} />;
        if (['line', 'area'].includes(type)) return <PremiumLine {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} />;
        if (['pie', 'donut', 'doughnut'].includes(type)) return <PremiumPie {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} />;
        if (['scatter', 'bubble'].includes(type)) return <PremiumScatter {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} />;
        if (type === 'radar') return <PremiumRadar {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} />;
        if (type === 'treemap') return <PremiumTreemap {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} />;
        if (type === 'funnel') return <PremiumFunnel {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} />;
        if (type === 'sunburst') return <PremiumSunburst {...props} data={data} chart={{ ...chart, colorScheme: chart.colorScheme || 'indigo' }} />;
        return <PlotlyChart {...props} data={data} />;
    })();

    return (
        <div ref={containerRef} className={`h-full w-full relative group flex flex-col ${hidePadding ? '' : 'p-5'}`}>
            {/* Unified Card Header */}
            {!hideHeader && (
                <div className="flex justify-between items-start mb-4 shrink-0 pointer-events-none">
                    <div>
                        <h3 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-widest leading-tight mb-0.5 line-clamp-1">{title || chart.title}</h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{chartType || chart.type}</p>
                    </div>
                    {onAiExplain && !editMode && (
                        <button onClick={(e) => { e.stopPropagation(); onAiExplain(); }} className="p-1.5 text-slate-400 hover:text-indigo-500 bg-slate-50 dark:bg-slate-800 rounded-lg pointer-events-auto">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    )}
                </div>
            )}

            <div className="flex-1 min-h-0 relative">
                {chartContent}
            </div>

            {editMode && <EditOverlay />}
        </div>
    );
};
