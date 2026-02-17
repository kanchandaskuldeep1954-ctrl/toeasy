import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
    ScatterChart, Scatter, ComposedChart
} from 'recharts';
import { ChartSpec } from '../../../types';
import { SendToMenu } from './SendToMenu';

export interface ChartWidgetProps {
    chart: ChartSpec;
    data?: any[];
    isEditing?: boolean;
    onUpdate?: (updatedChart: ChartSpec) => void;
    onDelete?: () => void;
    onPointClick?: (data: any, index: number) => void;
    height?: number | string;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#84cc16'];

const DARK_GRID = '#334155';
const LIGHT_GRID = '#e5e7eb';
const DARK_AXIS = '#94a3b8';
const LIGHT_AXIS = '#6b7280';

export const ChartWidget: React.FC<ChartWidgetProps> = ({
    chart,
    data: dataOverride,
    isEditing = false,
    onUpdate,
    onDelete,
    onPointClick,
    height = 300
}) => {
    const [editMode, setEditMode] = useState(false);
    const [localSpec, setLocalSpec] = useState<ChartSpec>(chart);

    // Detect dark mode from DOM
    const isDark = useMemo(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    }, []);

    const gridColor = isDark ? DARK_GRID : LIGHT_GRID;
    const axisColor = isDark ? DARK_AXIS : LIGHT_AXIS;
    const tooltipBg = isDark ? '#1e293b' : '#fff';
    const tooltipBorder = isDark ? '#334155' : '#e5e7eb';

    // Guard against undefined chart prop
    if (!chart) {
        return (
            <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg" style={{ height }}>
                <div className="text-center text-slate-400">
                    <p className="text-sm font-medium">No chart configuration</p>
                </div>
            </div>
        );
    }

    const chartData = dataOverride || chart.data || [];

    if (!chartData || chartData.length === 0) {
        return (
            <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg" style={{ height }}>
                <div className="text-center text-slate-400">
                    <p className="text-sm font-medium">No data available</p>
                    <p className="text-xs mt-1 text-slate-400">Try refreshing the dataset</p>
                </div>
            </div>
        );
    }

    const handleClick = (data: any, index: number) => {
        if (onPointClick) onPointClick(data, index);
    };

    const tooltipStyle = {
        backgroundColor: tooltipBg,
        borderRadius: '12px',
        border: `1px solid ${tooltipBorder}`,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
        padding: '8px 12px',
        fontSize: '12px'
    };

    const renderChart = () => {
        switch (localSpec.type) {
            case 'bar':
                return (
                    <BarChart data={chartData} onClick={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                            handleClick(e.activePayload[0].payload, e.activeTooltipIndex || 0);
                        }
                    }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis dataKey={localSpec.xAxis || 'name'} stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? '#1e293b' : '#f3f4f6' }} />
                        <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                        <Bar
                            dataKey={localSpec.yAxis || 'value'}
                            fill={localSpec.color || COLORS[0]}
                            radius={[6, 6, 0, 0]}
                            name={localSpec.title}
                            onClick={handleClick}
                        />
                    </BarChart>
                );

            case 'line':
                return (
                    <LineChart data={chartData} onClick={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                            handleClick(e.activePayload[0].payload, e.activeTooltipIndex || 0);
                        }
                    }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis dataKey={localSpec.xAxis || 'name'} stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                        <Line
                            type="monotone"
                            dataKey={localSpec.yAxis || 'value'}
                            stroke={localSpec.color || COLORS[0]}
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: isDark ? '#1e293b' : '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: localSpec.color || COLORS[0] }}
                        />
                    </LineChart>
                );

            case 'area':
                return (
                    <AreaChart data={chartData} onClick={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                            handleClick(e.activePayload[0].payload, e.activeTooltipIndex || 0);
                        }
                    }}>
                        <defs>
                            <linearGradient id={`color${localSpec.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={localSpec.color || COLORS[0]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={localSpec.color || COLORS[0]} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis dataKey={localSpec.xAxis || 'name'} stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                        <Area
                            type="monotone"
                            dataKey={localSpec.yAxis || 'value'}
                            stroke={localSpec.color || COLORS[0]}
                            fillOpacity={1}
                            fill={`url(#color${localSpec.id})`}
                        />
                    </AreaChart>
                );

            case 'pie':
            case 'donut':
                return (
                    <PieChart>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={localSpec.type === 'donut' ? 60 : 0}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey={localSpec.yAxis || 'value'}
                            nameKey={localSpec.xAxis || 'name'}
                            onClick={handleClick}
                        >
                            {chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                );

            case 'stacked':
            case 'stacked_bar': {
                // Stacked bar chart: detect all numeric keys except xAxis as series
                const xKey = localSpec.xAxis || 'name';
                const yKey = localSpec.yAxis || 'value';
                const allKeys = chartData.length > 0 ? Object.keys(chartData[0]).filter(k => k !== xKey && typeof chartData[0][k] === 'number') : [yKey];
                const seriesKeys = allKeys.length > 0 ? allKeys : [yKey];

                return (
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis dataKey={xKey} stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? '#1e293b' : '#f3f4f6' }} />
                        <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                        {seriesKeys.map((key, i) => (
                            <Bar key={key} dataKey={key} stackId="stack" fill={COLORS[i % COLORS.length]} radius={i === seriesKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                    </BarChart>
                );
            }

            case 'scatter': {
                const xKey = localSpec.xAxis || 'name';
                const yKey = localSpec.yAxis || 'value';
                return (
                    <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey={xKey} stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} name={xKey} />
                        <YAxis dataKey={yKey} stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} name={yKey} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                        <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                        <Scatter name={localSpec.title || 'Data'} data={chartData} fill={localSpec.color || COLORS[0]} />
                    </ScatterChart>
                );
            }

            case 'composed':
            case 'combo': {
                const xKey = localSpec.xAxis || 'name';
                const yKey = localSpec.yAxis || 'value';
                const allKeys = chartData.length > 0 ? Object.keys(chartData[0]).filter(k => k !== xKey && typeof chartData[0][k] === 'number') : [yKey];
                const barKey = allKeys[0] || yKey;
                const lineKey = allKeys[1] || barKey;

                return (
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis dataKey={xKey} stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                        <Bar dataKey={barKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                        {lineKey !== barKey && (
                            <Line type="monotone" dataKey={lineKey} stroke={COLORS[1]} strokeWidth={2.5} dot={{ r: 3, fill: isDark ? '#1e293b' : '#fff', strokeWidth: 2 }} />
                        )}
                    </ComposedChart>
                );
            }

            default:
                // Fallback to bar chart instead of showing unsupported message
                return (
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis dataKey={localSpec.xAxis || 'name'} stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? '#1e293b' : '#f3f4f6' }} />
                        <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                        <Bar
                            dataKey={localSpec.yAxis || 'value'}
                            fill={localSpec.color || COLORS[0]}
                            radius={[6, 6, 0, 0]}
                            name={localSpec.title}
                            onClick={handleClick}
                        />
                    </BarChart>
                );
        }
    };

    const handleSaveEdit = () => {
        if (onUpdate) {
            onUpdate(localSpec);
        }
        setEditMode(false);
    };

    return (
        <div className={`bg-white dark:bg-slate-900 rounded-xl p-4 transition-all duration-200 h-full flex flex-col ${isEditing ? 'ring-2 ring-indigo-500' : ''}`}>
            <div className="flex justify-between items-start mb-3 shrink-0">
                {editMode ? (
                    <div className="flex-1 space-y-2">
                        <input
                            type="text"
                            value={localSpec.title}
                            onChange={e => setLocalSpec({ ...localSpec, title: e.target.value })}
                            className="block w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            placeholder="Chart Title"
                        />
                        <div className="flex gap-2">
                            <select
                                value={localSpec.type}
                                onChange={e => setLocalSpec({ ...localSpec, type: e.target.value })}
                                className="block px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            >
                                <option value="bar">Bar</option>
                                <option value="line">Line</option>
                                <option value="area">Area</option>
                                <option value="pie">Pie</option>
                                <option value="donut">Donut</option>
                            </select>
                            <input
                                type="color"
                                value={localSpec.color || COLORS[0]}
                                onChange={e => setLocalSpec({ ...localSpec, color: e.target.value })}
                                className="h-6 w-8 p-0 border rounded cursor-pointer"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{chart.title}</h3>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{chartData.length} data points</p>
                    </div>
                )}

                <div className="flex items-center gap-1 shrink-0 ml-2">
                    {editMode ? (
                        <button
                            onClick={handleSaveEdit}
                            className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-md hover:bg-indigo-700 font-bold"
                        >
                            Save
                        </button>
                    ) : (
                        <>
                            {isEditing && (
                                <button
                                    onClick={() => setEditMode(true)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-500 rounded transition-colors"
                                    title="Edit Chart"
                                >
                                    ✎
                                </button>
                            )}
                            <SendToMenu chart={localSpec} elementId={`chart-export-${chart.id}`} />
                            {onDelete && isEditing && (
                                <button
                                    onClick={onDelete}
                                    className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                                    title="Remove"
                                >
                                    ✕
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 w-full" id={`chart-export-${chart.id}`}>
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>

            {localSpec.sourceModule && (
                <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                    <span>Source: {localSpec.sourceModule}</span>
                    {localSpec.isWidget && <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">Widget</span>}
                </div>
            )}
        </div>
    );
};
