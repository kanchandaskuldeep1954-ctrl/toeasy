import React from 'react';
import { KPI } from '../../../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { SendToMenu } from './SendToMenu';

interface KPIWidgetProps {
    kpi: KPI;
    sparklineData?: any[];
    onClick?: () => void;
    width?: string | number;
}

/**
 * Smart value formatter: handles currency, percentages, large numbers
 * and ensures nonsensical AI-generated values are clamped/sanitized.
 */
function formatKPIValue(value: string | number | undefined | null, format?: string, unit?: string): string {
    if (value === undefined || value === null || value === '') return '—';

    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ''));

    // If it's a non-numeric string (can't parse), return it as-is but truncated
    if (isNaN(num)) {
        const str = String(value);
        return str.length > 20 ? str.slice(0, 20) + '…' : str;
    }

    // Format based on declared format or auto-detect
    if (format === 'percentage' || unit === '%' || String(value).includes('%')) {
        // Clamp percentage to reasonable bounds — AI sometimes produces 43534500.0%
        const clamped = Math.min(Math.max(num, -1000), 10000);
        if (Math.abs(clamped) !== Math.abs(num)) {
            // Value was clamped; it was nonsensical — show a sane fallback
            return `${num > 0 ? '>' : '<'}${num > 0 ? '100' : '-100'}%`;
        }
        return `${num.toFixed(1)}%`;
    }

    if (format === 'currency' || unit === '$' || unit === '₹' || unit === '€' || unit === '£') {
        const symbol = unit || '$';
        if (Math.abs(num) >= 1e9) return `${symbol}${(num / 1e9).toFixed(1)}B`;
        if (Math.abs(num) >= 1e6) return `${symbol}${(num / 1e6).toFixed(1)}M`;
        if (Math.abs(num) >= 1e3) return `${symbol}${(num / 1e3).toFixed(1)}K`;
        return `${symbol}${num.toFixed(2)}`;
    }

    // Default: compact number formatting
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    if (Number.isInteger(num)) return num.toLocaleString();
    return num.toFixed(2);
}

/** Humanize field names: snake_case → Title Case */
function humanizeTitle(title: string | undefined | null): string {
    if (!title || title.trim() === '') return 'Metric';
    return title
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, c => c.toUpperCase());
}

export const KPIWidget: React.FC<KPIWidgetProps> = ({ kpi, sparklineData, onClick, width = '100%' }) => {
    // Guard against undefined/null kpi prop
    if (!kpi) {
        return (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 text-center text-slate-400" style={{ width }}>
                <p className="text-sm font-medium">No KPI Data</p>
            </div>
        );
    }

    const isPositive = kpi.trend?.direction === 'up';
    const trendColor = isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
    const trendBg = isPositive ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20';
    const TrendIcon = isPositive ? '↗' : '↘';
    const lineColor = isPositive ? '#10b981' : '#ef4444';

    // Smart formatting
    const displayTitle = humanizeTitle(kpi.title);
    const displayValue = formatKPIValue(kpi.value, kpi.calculation?.format, kpi.unit);

    // Trend value: clamp to [-100, 1000]
    const trendValue = kpi.trend?.value != null
        ? Math.min(Math.max(kpi.trend.value, -100), 1000)
        : null;

    const data = sparklineData || (kpi.sparklineData
        ? kpi.sparklineData.map(v => ({ v }))
        : [{ v: 10 }, { v: 15 }, { v: 13 }, { v: 20 }, { v: 25 }, { v: 22 }, { v: 30 }]
    );

    // Category badge color
    const categoryColors: Record<string, string> = {
        financial: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
        quality: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
        operational: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
        efficiency: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
        growth: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
        volume: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    };

    return (
        <div
            className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all duration-200 relative group cursor-pointer"
            style={{ width }}
            onClick={onClick}
        >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <SendToMenu
                    chart={{
                        id: kpi.id,
                        title: displayTitle,
                        type: 'kpi',
                        data: data
                    } as any}
                    elementId={`kpi-${kpi.id}`}
                />
            </div>

            <div id={`kpi-${kpi.id}`}>
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">{displayTitle}</h3>
                    {kpi.category && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${categoryColors[kpi.category] || 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                            {kpi.category}
                        </span>
                    )}
                </div>

                <div className="flex items-end gap-2 mb-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{displayValue}</span>
                    {trendValue !== null && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold ${trendBg} ${trendColor}`}>
                            {TrendIcon} {Math.abs(trendValue).toFixed(1)}%
                        </span>
                    )}
                </div>

                <div className="h-10 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id={`grad-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="v"
                                stroke={lineColor}
                                strokeWidth={2}
                                fill={`url(#grad-${kpi.id})`}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
