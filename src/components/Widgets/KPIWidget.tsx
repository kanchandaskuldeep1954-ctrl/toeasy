import React from 'react';
import { KPI } from '../../../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { SendToMenu } from './SendToMenu';

interface KPIWidgetProps {
    kpi: KPI;
    sparklineData?: any[]; // Array of { date, value } or similar
    onClick?: () => void;
    width?: string | number;
}

export const KPIWidget: React.FC<KPIWidgetProps> = ({ kpi, sparklineData, onClick, width = '100%' }) => {
    // Determine trend color
    const isPositive = kpi.trend?.direction === 'up';
    const trendColor = isPositive ? 'text-green-600' : 'text-red-600';
    const trendBg = isPositive ? 'bg-green-50' : 'bg-red-50';
    const TrendIcon = isPositive ? '↗' : '↘';

    // Mock sparkline if not provided but requested
    const data = sparklineData || [
        { v: 10 }, { v: 15 }, { v: 13 }, { v: 20 }, { v: 25 }, { v: 22 }, { v: 30 }
    ];

    return (
        <div
            className="bg-white rounded-lg p-4 border border-gray-100 hover:shadow-md transition-shadow relative group"
            style={{ width }}
            onClick={onClick}
        >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* We wrap KPI in a mock ChartSpec-like object for SendToMenu compatibility, or allow SendToMenu to accept KPIs in V2 */}
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
                <h3 className="text-sm font-medium text-gray-500 mb-1">{kpi.title}</h3>

                <div className="flex items-end gap-2 mb-2">
                    <span className="text-2xl font-bold text-gray-900">{kpi.value}</span>
                    {kpi.trend && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${trendBg} ${trendColor}`}>
                            {TrendIcon} {kpi.trend.value}%
                        </span>
                    )}
                </div>

                <div className="h-10 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id={`grad-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="v"
                                stroke={isPositive ? '#10b981' : '#ef4444'}
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
