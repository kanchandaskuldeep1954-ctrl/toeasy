import React, { useMemo, useState } from 'react';
import {
    PieChart,
    Pie,
    Sector,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend
} from 'recharts';
import { ChartSpec } from '../../../types';

interface PremiumPieProps {
    chart: ChartSpec;
    data: any[];
    height?: number;
    activeFilter?: string | null;
    onClick?: (data: any) => void;
}

const THEME_PALETTES: any = {
    indigo: ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'],
    emerald: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'],
    rose: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fff1f2'],
    ocean: ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#f0f9ff'],
    sunset: ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fffbeb'],
    amber: ['#fbbf24', '#fcd34d', '#fde68a', '#fffbeb', '#fff7ed', '#fff1f2'],
    sky: ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#f0f9ff', '#f5f3ff'],
    violet: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#f5f3ff'],
    minimal: ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8']
};

const renderActiveShape = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                filter="url(#shadow)"
                className="transition-all duration-500"
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 8}
                outerRadius={outerRadius + 12}
                fill={fill}
                opacity={0.5}
            />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} strokeWidth={2} fill="none" />
            <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={-10} textAnchor={textAnchor} fill="#94a3b8" fontSize={11} fontWeight="bold" transform={`translate(0, 0)`}>
                {payload.name}
            </text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={10} textAnchor={textAnchor} fill="#eee" fontSize={14} fontWeight="900" >
                {value.toLocaleString()}
            </text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={26} textAnchor={textAnchor} fill="#6366f1" fontSize={10} fontWeight="bold">
                {`(${(percent * 100).toFixed(1)}%)`}
            </text>
        </g>
    );
};

const RADIAN = Math.PI / 180;

export const PremiumPie: React.FC<PremiumPieProps> = ({ chart, data, height = 300, activeFilter, onClick }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const palette = THEME_PALETTES[chart.colorScheme as any] || THEME_PALETTES.indigo;

    const formattedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // 1. Initial Map & Sort
        const raw = data.map((d) => ({
            name: String(d.name || d.label || d.x || 'Unknown'),
            value: Number(d.value || d.y || d.count || 0),
        })).sort((a, b) => b.value - a.value);

        // 2. Grouping Logic: Consolidate tiny slices (< 3%) or beyond top 8
        const total = raw.reduce((sum, item) => sum + item.value, 0);
        const threshold = total * 0.03;

        const top = raw.filter((item, index) => (item.value >= threshold && index < 8));
        const others = raw.filter(item => !top.includes(item));

        if (others.length > 0) {
            top.push({
                name: 'Others',
                value: others.reduce((sum, item) => sum + item.value, 0)
            });
        }

        return top.filter(i => i.value > 0);
    }, [data]);

    const isDonut = chart.type === 'donut' || chart.type === 'doughnut';

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index);
    };

    return (
        <div style={{ width: '100%', height: '100%' }} className="animate-in fade-in zoom-in-95 duration-1000 flex flex-col justify-center overflow-hidden">
            <div style={{ width: '100%', height: '100%', minHeight: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <defs>
                            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="rgba(0,0,0,0.4)" />
                            </filter>
                        </defs>
                        <Tooltip
                            content={({ active, payload }: any) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-xl">
                                            <p className="text-[10px] font-black uppercase text-slate-500 mb-1">{payload[0].name}</p>
                                            <p className="text-xl font-black text-white">{payload[0].value.toLocaleString()}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={40}
                            iconType="circle"
                            formatter={(value) => <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{value}</span>}
                        />
                        <Pie
                            activeIndex={activeIndex}
                            activeShape={renderActiveShape}
                            data={formattedData}
                            cx="50%"
                            cy="42%"
                            innerRadius={isDonut ? "65%" : 0}
                            outerRadius="82%"
                            stroke="none"
                            dataKey="value"
                            onMouseEnter={onPieEnter}
                            onClick={(data) => onClick && onClick({ activePayload: [{ payload: data }] })}
                            animationDuration={1200}
                            paddingAngle={isDonut ? 3 : 0}
                        >
                            {formattedData.map((entry, index) => {
                                const isActive = !activeFilter || String(entry.name) === String(activeFilter);
                                return (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={palette[index % palette.length]}
                                        opacity={isActive ? 1 : 0.2}
                                        className="transition-all duration-300 hover:scale-105"
                                    />
                                );
                            })}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
