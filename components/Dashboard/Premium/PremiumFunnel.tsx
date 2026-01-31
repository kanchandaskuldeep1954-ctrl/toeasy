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

const COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'];

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
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
                        ))}
                    </Funnel>
                </FunnelChart>
            </ResponsiveContainer>
        </div>
    );
};
