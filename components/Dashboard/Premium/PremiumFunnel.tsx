import React, { useMemo } from 'react';
import {
    FunnelChart,
    Funnel,
    LabelList,
    Cell,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import { ChartSpec } from '../../../types';

interface PremiumFunnelProps {
    chart: ChartSpec;
    data: any[];
    height?: number;
    activeFilter?: string | null;
    onClick?: (data: any) => void;
}

const THEME_PALETTES: any = {
    indigo: ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'],
    emerald: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    vibrant: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3'],
    ocean: ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'],
    sunset: ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'],
    forest: ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0'],
    royal: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
    minimal: ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b']
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-4 rounded-xl shadow-2xl">
                <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black mb-1">{payload[0].payload.name}</p>
                <p className="text-xl font-black text-white">{payload[0].value.toLocaleString()}</p>
            </div>
        );
    }
    return null;
};

export const PremiumFunnel: React.FC<PremiumFunnelProps> = ({ chart, data, height = 300, onClick }) => {
    const palette = THEME_PALETTES[chart.colorScheme as any] || THEME_PALETTES.indigo;

    const formattedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.map(d => ({
            name: d.name || d.label || d.x,
            value: Number(d.value || d.y || d.count || 0),
        })).sort((a, b) => b.value - a.value);
    }, [data]);

    return (
        <div style={{ width: '100%', height: height }} className="animate-in fade-in slide-in-from-top-4 duration-700">
            <ResponsiveContainer>
                <FunnelChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Funnel
                        dataKey="value"
                        data={formattedData}
                        isAnimationActive
                        onClick={(data) => onClick && onClick({ activePayload: [{ payload: data }] })}
                    >
                        <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" fontSize={11} fontWeight="bold" />
                        {formattedData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={palette[index % palette.length]} fillOpacity={0.8} />
                        ))}
                    </Funnel>
                </FunnelChart>
            </ResponsiveContainer>
        </div>
    );
};
