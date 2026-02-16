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

    const data = sparklineData || [
        { v: 10 }, { v: 15 }, { v: 13 }, { v: 20 }, { v: 25 }, { v: 22 }, { v: 30 }
    ];

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
                        title: kpi.title,
                        type: 'kpi',
                        data: data
                    } as any}
                    elementId={`kpi-${kpi.id}`}
                />
            </div>

            <div id={`kpi-${kpi.id}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{kpi.title}</h3>

                <div className="flex items-end gap-2 mb-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</span>
                    {kpi.trend && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold ${trendBg} ${trendColor}`}>
                            {TrendIcon} {kpi.trend.value}%
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
