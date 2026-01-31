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

const COLORS = ['#6366f1', '#4338ca', '#3730a3', '#312e81', '#1e1b4b'];

const CustomizedContent = (props: any) => {
    const { depth, x, y, width, height, index, name, value } = props;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: COLORS[index % COLORS.length],
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

    const formattedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.map(d => ({
            name: d.name || d.label || d.x,
            value: Number(d.value || d.y || d.count || 0),
        })).sort((a, b) => b.value - a.value);
    }, [data]);

    return (
        <div style={{ width: '100%', height: height }} className="animate-in fade-in duration-1000">
            <ResponsiveContainer>
                <Treemap
                    data={formattedData}
                    dataKey="value"
                    stroke="#fff"
                    fill="#8884d8"
                    content={<CustomizedContent />}
                    onClick={(data) => onClick && onClick({ activePayload: [{ payload: data }] })}
                />
            </ResponsiveContainer>
        </div>
    );
};
