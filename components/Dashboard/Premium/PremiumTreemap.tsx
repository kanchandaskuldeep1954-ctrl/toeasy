import React, { useMemo } from 'react';
import {
    Treemap,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import { ChartSpec } from '../../../types';

interface PremiumTreemapProps {
    chart: ChartSpec;
    data: any[];
    height?: number;
    activeFilter?: string | null;
    onClick?: (data: any) => void;
}

const THEME_PALETTES: any = {
    indigo: ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'],
    emerald: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    rose: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3'],
    ocean: ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'],
    sunset: ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'],
    amber: ['#fbbf24', '#fcd34d', '#fde68a', '#fffbeb', '#fff7ed'],
    sky: ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#f0f9ff'],
    violet: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
    minimal: ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b']
};

const CustomizedContent = (props: any) => {
    const { depth, x, y, width, height, index, name, value, palette } = props;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: palette[index % palette.length],
                    stroke: '#fff',
                    strokeWidth: 2 / (depth + 1),
                    strokeOpacity: 1 / (depth + 1),
                }}
            />
            {width > 50 && height > 30 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={12}
                    fontWeight="bold"
                >
                    {name}
                </text>
            )}
            {width > 50 && height > 50 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 14}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.6)"
                    fontSize={10}
                >
                    {value.toLocaleString()}
                </text>
            )}
        </g>
    );
};

export const PremiumTreemap: React.FC<PremiumTreemapProps> = ({ chart, data, height = 300, onClick }) => {
    const palette = THEME_PALETTES[chart.colorScheme as any] || THEME_PALETTES.indigo;

    const formattedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.map(d => ({
            name: d.name || d.label || d.x,
            value: Number(d.value || d.y || d.count || 0),
        })).sort((a, b) => b.value - a.value);
    }, [data]);

    return (
        <div style={{ width: '100%', height: '100%' }} className="animate-in fade-in duration-1000">
            <ResponsiveContainer>
                <Treemap
                    data={formattedData}
                    dataKey="value"
                    stroke="#fff"
                    fill="#8884d8"
                    content={<CustomizedContent palette={palette} />}
                    onClick={(data) => onClick && onClick({ activePayload: [{ payload: data }] })}
                />
            </ResponsiveContainer>
        </div>
    );
};
