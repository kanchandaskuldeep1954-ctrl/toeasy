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

export const PremiumBar: React.FC<PremiumBarProps> = ({ chart, data, height = 300, activeFilter, onClick }) => {

    const formattedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        // Normalize logic similar to PlotlyChart if needed, or assume pre-normalized
        return data.map(d => ({
            name: d.name || d.label || d.x,
            value: Number(d.value || d.y || d.count || 0),
            raw: d
        }));
    }, [data]);

    return (
        <div style={{ width: '100%', height: height }} className="animate-in fade-in duration-700">
            <ResponsiveContainer>
                <BarChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                        <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="colorBarActive" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={1} />
                            <stop offset="95%" stopColor="#d946ef" stopOpacity={0.9} />
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
                                    fill={isActive ? "url(#colorBar)" : "#e2e8f0"}
                                    opacity={isActive ? 1 : 0.3}
                                    className="transition-all duration-300 cursor-pointer hover:opacity-100"
                                />
                            );
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
