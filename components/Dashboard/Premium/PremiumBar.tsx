import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine
} from 'recharts';
import { ChartSpec } from '../../../types';

interface PremiumBarProps {
    chart: ChartSpec;
    data: any[];
    height?: number;
    activeFilter?: string | null;
    onClick?: (data: any) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl shadow-2xl min-w-[150px]">
                <p className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">{label}</p>
                <p className="text-2xl font-black text-white">
                    {Number(payload[0].value).toLocaleString()}
                </p>
                <div className="flex items-center gap-2 mt-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span className="text-[10px] text-indigo-300">Live Metric</span>
                </div>
            </div>
        );
    }
    return null;
};

const THEME_CONFIG: any = {
    indigo: { primary: '#6366f1', secondary: '#818cf8', active: '#4f46e5' },
    emerald: { primary: '#10b981', secondary: '#34d399', active: '#059669' },
    rose: { primary: '#f43f5e', secondary: '#fb7185', active: '#e11d48' },
    ocean: { primary: '#0ea5e9', secondary: '#38bdf8', active: '#0284c7' },
    sunset: { primary: '#f59e0b', secondary: '#fbbf24', active: '#d97706' },
    amber: { primary: '#fbbf24', secondary: '#fcd34d', active: '#d97706' },
    sky: { primary: '#0ea5e9', secondary: '#7dd3fc', active: '#0284c7' },
    violet: { primary: '#8b5cf6', secondary: '#a78bfa', active: '#7c3aed' },
    minimal: { primary: '#1e293b', secondary: '#475569', active: '#0f172a' }
};

export const PremiumBar: React.FC<PremiumBarProps> = ({ chart, data, height = 300, activeFilter, onClick }) => {
    const theme = THEME_CONFIG[chart.colorScheme as any] || THEME_CONFIG.indigo;

    const formattedData = useMemo(() => {
        if (!Array.isArray(data) || data.length === 0) return [];
        // Normalize logic similar to PlotlyChart if needed, or assume pre-normalized
        return data.map(d => ({
            name: d.name || d.label || d.x,
            value: Number(d.value || d.y || d.count || 0),
            raw: d
        }));
    }, [data]);

    const trendData = useMemo(() => {
        if (chart.chartConfig?.trendline !== 'ols' || formattedData.length < 2) return null;

        const n = formattedData.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        formattedData.forEach((d, i) => {
            sumX += i;
            sumY += d.value;
            sumXY += i * d.value;
            sumXX += i * i;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Forecast points (future 20% of current length)
        const forecastLength = Math.max(1, Math.floor(n * 0.2));
        const forecastPoints = [];
        for (let j = 1; j <= forecastLength; j++) {
            forecastPoints.push({
                name: `Forecast ${j}`,
                value: null,
                trendValue: slope * (n + j - 1) + intercept,
            });
        }

        return [...formattedData.map((d, i) => ({ ...d, trendValue: slope * i + intercept })), ...forecastPoints];
    }, [formattedData, chart.chartConfig?.trendline]);

    const displayData = trendData || formattedData;

    return (
        <div style={{ width: '100%', height: '100%' }} className="animate-in fade-in duration-700">
            <ResponsiveContainer>
                <BarChart data={displayData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                        <linearGradient id={`colorBar-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={theme.primary} stopOpacity={0.9} />
                            <stop offset="95%" stopColor={theme.secondary} stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id={`colorBarActive-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={theme.active} stopOpacity={1} />
                            <stop offset="95%" stopColor={theme.primary} stopOpacity={0.9} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickFormatter={(value) =>
                            new Intl.NumberFormat('en', { notation: "compact", compactDisplay: "short" }).format(value)
                        }
                    />
                    <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} content={<CustomTooltip />} />
                    <Bar
                        dataKey="value"
                        radius={[6, 6, 0, 0]}
                        animationDuration={1500}
                        onClick={(data) => onClick && onClick({ activePayload: [{ payload: data }] })}
                    >
                        {formattedData.map((entry, index) => {
                            const isActive = !activeFilter || String(entry.name) === String(activeFilter);
                            return (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={isActive ? `url(#colorBar-${chart.id})` : "#e2e8f0"}
                                    opacity={isActive ? 1 : 0.3}
                                    className="transition-all duration-300 cursor-pointer hover:opacity-100"
                                />
                            );
                        })}
                    </Bar>

                    {chart.chartConfig?.trendline === 'ols' && (
                        <Bar
                            dataKey="trendValue"
                            fill="#f43f5e"
                            opacity={0.4}
                            radius={[4, 4, 0, 0]}
                            barSize={4}
                            tooltipType="none"
                        />
                    )}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
