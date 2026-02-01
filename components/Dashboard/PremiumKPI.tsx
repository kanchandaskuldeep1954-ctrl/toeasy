import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { KPI, Dataset } from '../../types';

interface PremiumKPIProps {
    kpi: KPI;
    dataset: Dataset;
    onEdit?: () => void;
}

export const PremiumKPI: React.FC<PremiumKPIProps> = ({ kpi, onEdit }) => {
    const { label, value, trend, trendDirection, status, sparklineData } = kpi;

    // Premium Color Logic (Standardized palettes with semantic fallbacks)
    const theme = useMemo(() => {
        const scheme = (kpi as any).colorScheme;

        const PALETTE_MAP: any = {
            emerald: { hex: '#10b981', base: 'emerald' },
            rose: { hex: '#f43f5e', base: 'rose' },
            amber: { hex: '#f59e0b', base: 'amber' },
            indigo: { hex: '#6366f1', base: 'indigo' },
            sky: { hex: '#0ea5e9', base: 'sky' },
            violet: { hex: '#8b5cf6', base: 'violet' },
            ocean: { hex: '#06b6d4', base: 'cyan' },
            sunset: { hex: '#f97316', base: 'orange' }
        };

        if (scheme && PALETTE_MAP[scheme]) {
            const p = PALETTE_MAP[scheme];
            return {
                base: p.base,
                hex: p.hex,
                bg: `bg-${p.base}-500/5`,
                border: `border-${p.base}-500/20`,
                text: `text-${p.base}-500`,
                glow: `shadow-${p.base}-500/20`
            };
        }

        // Semantic Fallbacks
        if (status === 'on_track' || trendDirection === 'up') {
            return {
                base: 'emerald',
                hex: '#10b981',
                bg: 'bg-emerald-500/5',
                border: 'border-emerald-500/20',
                text: 'text-emerald-500',
                glow: 'shadow-emerald-500/20'
            };
        }
        if (status === 'off_track' || trendDirection === 'down') {
            return {
                base: 'rose',
                hex: '#f43f5e',
                bg: 'bg-rose-500/5',
                border: 'border-rose-500/20',
                text: 'text-rose-500',
                glow: 'shadow-rose-500/20'
            };
        }
        if (status === 'at_risk') {
            return {
                base: 'amber',
                hex: '#f59e0b',
                bg: 'bg-amber-500/5',
                border: 'border-amber-500/20',
                text: 'text-amber-500',
                glow: 'shadow-amber-500/20'
            };
        }
        return {
            base: 'indigo',
            hex: '#6366f1',
            bg: 'bg-indigo-500/5',
            border: 'border-indigo-500/20',
            text: 'text-indigo-500',
            glow: 'shadow-indigo-500/20'
        };
    }, [status, trendDirection, (kpi as any).colorScheme]);

    const chartData = useMemo(() =>
        sparklineData?.map((v, i) => ({ i, v })) || [],
        [sparklineData]);

    return (
        <div
            onClick={onEdit}
            className={`
                relative overflow-hidden group cursor-pointer
                bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
                border ${theme.border} p-5 rounded-[24px]
                transition-all duration-500 ease-out
                hover:scale-[1.03] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]
                dark:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]
                ${theme.glow}
            `}
        >
            {/* Ambient Background Glow */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 bg-${theme.base}-500`} />

            <div className="flex justify-between items-start relative z-10">
                <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1 block">
                        {label}
                    </span>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                            {value}
                        </h3>
                        {trend !== undefined && (
                            <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${theme.bg} ${theme.text} border ${theme.border}`}>
                                {trendDirection === 'up' ? '↑' : '↓'} {Math.abs(trend)}%
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Dot with Pulse */}
                <div className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${theme.base}-400 opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 bg-${theme.base}-500`}></span>
                </div>
            </div>

            {/* High-Fidelity Sparkline */}
            <div className="h-16 w-full mt-6 relative translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id={`kpi-grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={theme.hex} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={theme.hex} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="v"
                            stroke={theme.hex}
                            strokeWidth={3}
                            fill={`url(#kpi-grad-${label})`}
                            isAnimationActive={true}
                            animationDuration={2000}
                        />
                    </AreaChart>
                </ResponsiveContainer>

                {/* Glassy Overlay for Sparkline depth */}
                <div className="absolute inset-0 bg-gradient-to-t from-white/20 dark:from-slate-900/20 to-transparent pointer-events-none" />
            </div>

            {/* First Principles Logic Badge (Appears on Hover) */}
            <div className="absolute bottom-3 left-5 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <span className="text-[8px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest flex items-center gap-1">
                    <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM5.884 6.607a1 1 0 01-.223 1.39l-.91.7a1 1 0 01-1.135-1.647l.91-.7a1 1 0 011.358.257zM11 8a3 3 0 100 6 3 3 0 000-6zM16.95 8.332a1 1 0 10-1.298-1.524l-.856.73a1 1 0 101.298 1.524l.856-.73zM4.464 14.45a1 1 0 101.284 1.537l.85-.711a1 1 0 10-1.284-1.537l-.85.711zM11 15a1 1 0 100 2v1a1 1 0 100-2v-1zM16.536 14.45a1 1 0 011.284 1.537l-.85.711a1 1 0 10-1.284-1.537l.85-.711z" /></svg>
                    Forensic Verification Active
                </span>
            </div>
        </div>
    );
};
