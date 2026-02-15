import React from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer,
    XAxis, YAxis, Tooltip, CartesianGrid, Cell, AreaChart, Area,
    ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Treemap, ComposedChart, ZAxis, ReferenceLine, RadialBarChart, RadialBar, FunnelChart, Funnel,
    LabelList, Legend
} from 'recharts';
import { ChartSpec } from '@/types';

interface DashboardChartProps {
    chart: ChartSpec;
    data: any[];
    colors: string[];
    perspective?: string;
    isPreview?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        const value = typeof data.value === 'number' ? data.value.toLocaleString() : data.value;
        const name = data.name || label || data.payload?.name || 'Record';

        return (
            <div className="bg-slate-900/95 border border-slate-700/50 p-4 rounded-xl shadow-2xl backdrop-blur-md animate-in zoom-in-95 z-[100] min-w-[150px]">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em] border-b border-slate-700 pb-2">{name}</p>
                <div className="space-y-1">
                    {payload.map((p: any, idx: number) => (
                        <p key={idx} className="text-sm font-bold text-white flex justify-between gap-4">
                            <span style={{ color: p.color }}>{p.name || 'Value'}:</span>
                            <span className="font-mono">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
                        </p>
                    ))}
                </div>
                {data.payload?.z !== undefined && (
                    <p className="text-[10px] font-medium text-slate-500 mt-2 pt-2 border-t border-slate-800">
                        Metric (Z): {typeof data.payload.z === 'number' ? Math.round(data.payload.z).toLocaleString() : data.payload.z}
                    </p>
                )}
            </div>
        );
    }
    return null;
};

const DashboardChart: React.FC<DashboardChartProps> = ({ chart, data, colors, perspective = 'Overview', isPreview = false }) => {
    const color = isPreview ? '#6366f1' : (perspective === 'Forensic' ? '#f43f5e' : '#6366f1');
    const gradientId = `grad-${chart.id}`;

    const CommonGrid = () => <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />;
    const CommonX = () => <XAxis dataKey={chart.type === 'scatter' || chart.type === 'bubble' ? 'x' : 'name'} fontSize={10} axisLine={false} tickLine={false} tick={{ dy: 10, fill: '#94a3b8' }} type={chart.type === 'scatter' || chart.type === 'bubble' ? 'number' : 'category'} hide={chart.type === 'heatmap'} />;
    const CommonY = () => <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} type={chart.type === 'scatter' || chart.type === 'bubble' ? 'number' : 'number'} hide={chart.type === 'heatmap'} />;

    switch (chart.type) {
        case 'bar_horizontal':
            return (
                <BarChart layout="vertical" data={data} margin={{ left: 20 }}>
                    <CommonGrid />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
            );

        case 'scatter':
        case 'bubble':
            return (
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CommonGrid />
                    <XAxis type="number" dataKey="x" name={chart.xAxis} fontSize={10} domain={['auto', 'auto']} />
                    <YAxis type="number" dataKey="y" name={chart.yAxis} fontSize={10} domain={['auto', 'auto']} />
                    {chart.type === 'bubble' && <ZAxis type="number" dataKey="z" range={[50, 1000]} name={chart.zAxis} />}
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                    <Scatter name={chart.title} data={data} fill={color} fillOpacity={0.6} />
                </ScatterChart>
            );

        case 'heatmap':
            // Simulated Heatmap using Scatter with custom shape
            return (
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 60 }}>
                    <XAxis type="category" dataKey="x" name={chart.xAxis} fontSize={10} />
                    <YAxis type="category" dataKey="y" name={chart.yAxis} fontSize={10} />
                    <ZAxis type="number" dataKey="z" range={[0, 500]} name={chart.zAxis} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                    <Scatter data={data} shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const opacity = Math.min(1, Math.max(0.2, (payload.z / (Math.max(...data.map(d => d.z)) || 1))));
                        return <rect x={cx - 15} y={cy - 15} width={30} height={30} fill={color} fillOpacity={opacity} rx={4} />;
                    }} />
                </ScatterChart>
            );

        case 'pie':
        case 'donut':
            return (
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={chart.type === 'donut' ? '60%' : '0%'}
                        outerRadius="80%"
                        paddingAngle={2}
                        stroke="none"
                    >
                        {data.map((_, idx) => <Cell key={idx} fill={colors[idx % colors.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
            );

        case 'radar':
            return (
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid strokeOpacity={0.1} />
                    <PolarAngleAxis dataKey="name" fontSize={10} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} opacity={0} />
                    <Radar name={chart.yAxis} dataKey="value" stroke={color} fill={color} fillOpacity={0.4} />
                    <Tooltip content={<CustomTooltip />} />
                </RadarChart>
            );

        case 'funnel':
            return (
                <FunnelChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Funnel data={data} dataKey="value" nameKey="name" fill={color}>
                        <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                    </Funnel>
                </FunnelChart>
            );

        case 'gauge':
            return (
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" barSize={20} data={data.slice(0, 1)} startAngle={180} endAngle={0}>
                    <RadialBar label={{ position: 'insideStart', fill: '#fff' }} background dataKey="value" fill={color} cornerRadius={10} />
                    <Legend iconSize={10} layout="vertical" verticalAlign="middle" wrapperStyle={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                    <Tooltip content={<CustomTooltip />} />
                </RadialBarChart>
            );

        case 'treemap':
            return (
                <ResponsiveContainer>
                    <Treemap data={data} dataKey="size" aspectRatio={4 / 3} stroke="#fff" fill={color} animationDuration={800}>
                        <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            );

        case 'line':
            return (
                <LineChart data={data}>
                    <CommonGrid />
                    <CommonX />
                    <CommonY />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
            );

        case 'area':
            return (
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CommonGrid />
                    <CommonX />
                    <CommonY />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="value" stroke={color} fill={`url(#${gradientId})`} strokeWidth={3} />
                </AreaChart>
            );

        case 'composed':
            return (
                <ComposedChart data={data}>
                    <CommonGrid />
                    <CommonX />
                    <CommonY />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.6} />
                    <Line type="monotone" dataKey="value" stroke={colors[1]} strokeWidth={3} dot={{ r: 4, fill: '#fff' }} />
                </ComposedChart>
            );

        case 'bar':
        case 'histogram':
        default:
            return (
                <BarChart data={data} barCategoryGap={chart.type === 'histogram' ? 1 : '10%'}>
                    <CommonGrid />
                    <CommonX />
                    <CommonY />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
                    {chart.type !== 'histogram' && <ReferenceLine y={data.reduce((a: number, b: any) => a + b.value, 0) / (data.length || 1)} stroke="orange" strokeDasharray="3 3" opacity={0.5} label={{ value: 'AVG', position: 'insideTopRight', fill: 'orange', fontSize: 9 }} />}
                </BarChart>
            );
    }
};

export default DashboardChart;
