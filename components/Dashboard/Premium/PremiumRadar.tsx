import React, { useMemo } from 'react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import { ChartSpec } from '../../../types';

interface PremiumRadarProps {
    chart: ChartSpec;
    data: any[];
    height?: number;
    activeFilter?: string | null;
    onClick?: (data: any) => void;
}

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

const THEME_CONFIG: any = {
    indigo: { primary: '#6366f1' },
    emerald: { primary: '#10b981' },
    vibrant: { primary: '#f43f5e' },
    ocean: { primary: '#0ea5e9' },
    sunset: { primary: '#f59e0b' },
    forest: { primary: '#22c55e' },
    royal: { primary: '#8b5cf6' },
    minimal: { primary: '#1e293b' }
};

export const PremiumRadar: React.FC<PremiumRadarProps> = ({ chart, data, height = 300, onClick }) => {
    const theme = THEME_CONFIG[chart.colorScheme as any] || THEME_CONFIG.indigo;

    const formattedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.map(d => ({
            name: d.name || d.label || d.x,
            value: Number(d.value || d.y || d.count || 0),
        }));
    }, [data]);

    return (
        <div style={{ width: '100%', height: height }} className="animate-in fade-in zoom-in-95 duration-700">
            <ResponsiveContainer>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={formattedData}>
                    <PolarGrid stroke="rgba(148, 163, 184, 0.1)" />
                    <PolarAngleAxis
                        dataKey="name"
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                    />
                    <PolarRadiusAxis
                        angle={30}
                        domain={[0, 'auto']}
                        tick={{ fill: '#475569', fontSize: 8 }}
                        axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Radar
                        name={chart.title}
                        dataKey="value"
                        stroke={theme.primary}
                        strokeWidth={3}
                        fill={theme.primary}
                        fillOpacity={0.3}
                        animationDuration={1500}
                        onClick={(data) => onClick && onClick({ activePayload: [{ payload: data }] })}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};
