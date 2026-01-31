import React, { useMemo, useState } from 'react';
import {
    PieChart,
    Pie,
    Sector,
    Cell,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import { ChartSpec } from '../../../types';

interface PremiumPieProps {
    chart: ChartSpec;
    data: any[];
    height?: number;
    activeFilter?: string | null;
    onClick?: (data: any) => void;
}

// Professional Palette
const COLORS = [
    '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
    '#f43f5e', '#f97316', '#eab308', '#84cc16',
    '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6'
];

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
            <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-xl font-bold">
                {payload.name}
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 6}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                filter="url(#shadow)"
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 6}
                outerRadius={outerRadius + 10}
                fill={fill}
            />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
            <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#94a3b8" fontSize={12} >{`Value ${value.toLocaleString()}`}</text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" fontSize={10}>
                {`(Rate ${(percent * 100).toFixed(1)}%)`}
            </text>
        </g>
    );
};

const RADIAN = Math.PI / 180;

export const PremiumPie: React.FC<PremiumPieProps> = ({ chart, data, height = 300, activeFilter, onClick }) => {
    const [activeIndex, setActiveIndex] = useState(0);

    const formattedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.map((d) => ({
            name: d.name || d.label || d.x,
            value: Number(d.value || d.y || d.count || 0),
        })).sort((a, b) => b.value - a.value); // Sort for better pie viz
    }, [data]);

    const isDonut = chart.type === 'donut' || chart.type === 'doughnut';

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index);
    };

    return (
        <div style={{ width: '100%', height: height }} className="animate-in fade-in zoom-in-95 duration-700">
            <ResponsiveContainer>
                <PieChart>
                    <defs>
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.3)" />
                        </filter>
                    </defs>
                    <Pie
                        activeIndex={activeIndex}
                        activeShape={renderActiveShape}
                        data={formattedData}
                        cx="50%"
                        cy="50%"
                        innerRadius={isDonut ? 60 : 0}
                        outerRadius={isDonut ? 80 : 80}
                        fill="#8884d8"
                        dataKey="value"
                        onMouseEnter={onPieEnter}
                        onClick={(data) => onClick && onClick({ activePayload: [{ payload: data }] })}
                        animationDuration={1500}
                    >
                        {formattedData.map((entry, index) => {
                            const isActive = !activeFilter || String(entry.name) === String(activeFilter);
                            return (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                    opacity={isActive ? 1 : 0.2}
                                    stroke={isActive ? 'rgba(255,255,255,0.1)' : 'transparent'}
                                />
                            );
                        })}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};
