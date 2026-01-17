
import React from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { KPI } from '../../types';

interface KPICardProps {
    kpi: KPI;
}

export const KPICard: React.FC<KPICardProps> = ({ kpi }) => {
    const { label, value, trend, trendDirection, status, sparklineData } = kpi;

    // Determine colors based on status or trend
    let statusColor = 'text-slate-400';
    let trendColor = 'text-slate-500';
    let bgColor = 'bg-slate-800/50';
    let borderColor = 'border-slate-700/50';
    let sparklineColor = '#94a3b8'; // slate-400

    if (status === 'on_track' || trendDirection === 'up') {
        statusColor = 'text-emerald-400';
        trendColor = 'text-emerald-500';
        sparklineColor = '#10b981';
        bgColor = 'bg-emerald-950/10';
        borderColor = 'border-emerald-500/20';
    } else if (status === 'off_track' || trendDirection === 'down') {
        statusColor = 'text-rose-400';
        trendColor = 'text-rose-500';
        sparklineColor = '#f43f5e';
        bgColor = 'bg-rose-950/10';
        borderColor = 'border-rose-500/20';
    } else if (status === 'at_risk') {
        statusColor = 'text-amber-400';
        trendColor = 'text-amber-500';
        sparklineColor = '#f59e0b';
        bgColor = 'bg-amber-950/10';
        borderColor = 'border-amber-500/20';
    }

    // Format sparkline data for Recharts
    const chartData = sparklineData ? sparklineData.map((val, idx) => ({ i: idx, v: val })) : [];

    return (
        <div className={`relative overflow-hidden rounded-xl border ${borderColor} ${bgColor} p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg backdrop-blur-sm group`}>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</h3>
                {status && (
                    <div className={`w-2 h-2 rounded-full ${statusColor.replace('text-', 'bg-')}`} />
                )}
            </div>

            <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-black text-white tracking-tight">{value}</span>
                {trend !== undefined && trend !== 0 && (
                    <span className={`text-xs font-bold ${trendColor} flex items-center`}>
                        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                )}
            </div>

            {/* Sparkline Area */}
            {chartData.length > 0 && (
                <div className="h-10 w-full mt-2 opacity-50 group-hover:opacity-80 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id={`gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={sparklineColor} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={sparklineColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="v"
                                stroke={sparklineColor}
                                fillOpacity={1}
                                fill={`url(#gradient-${kpi.id})`}
                                strokeWidth={2}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Ambient Glow */}
            <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 bg-${status === 'on_track' ? 'emerald' : status === 'off_track' ? 'rose' : 'slate'}-500 pointer-events-none`} />
        </div>
    );
};
