import React, { useState } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
    ScatterChart, Scatter, ComposedChart
} from 'recharts';
import { ChartSpec } from '../../../types';
import { SendToMenu } from './SendToMenu';

interface ChartWidgetProps {
    chart: ChartSpec;
    data?: any[]; // Allow overriding data (e.g. for drilldown or playground)
    isEditing?: boolean;
    onUpdate?: (updatedChart: ChartSpec) => void;
    onDelete?: () => void;
    height?: number | string;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const ChartWidget: React.FC<ChartWidgetProps> = ({
    chart,
    data: dataOverride,
    isEditing = false,
    onUpdate,
    onDelete,
    height = 300
}) => {
    const [editMode, setEditMode] = useState(false);
    const [localSpec, setLocalSpec] = useState<ChartSpec>(chart);

    // Use data from props or from the chart spec itself (if embedded)
    const chartData = dataOverride || chart.data || [];

    if (!chartData || chartData.length === 0) {
        return (
            <div className="flex items-center justify-center p-4 bg-gray-50 border border-gray-200 rounded-lg" style={{ height }}>
                <div className="text-center text-gray-500">
                    <p>No data available</p>
                    <p className="text-xs mt-1">Try refreshing the dataset</p>
                </div>
            </div>
        );
    }

    const renderChart = () => {
        switch (localSpec.type) {
            case 'bar':
                return (
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey={localSpec.xAxis} stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            cursor={{ fill: '#f3f4f6' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey={localSpec.yAxis} fill={localSpec.color || COLORS[0]} radius={[4, 4, 0, 0]} name={localSpec.title} />
                    </BarChart>
                );

            case 'line':
                return (
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey={localSpec.xAxis} stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Line
                            type="monotone"
                            dataKey={localSpec.yAxis}
                            stroke={localSpec.color || COLORS[0]}
                            strokeWidth={2}
                            dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                );

            case 'area':
                return (
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id={`color${localSpec.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={localSpec.color || COLORS[0]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={localSpec.color || COLORS[0]} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey={localSpec.xAxis} stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Area
                            type="monotone"
                            dataKey={localSpec.yAxis}
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
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={localSpec.type === 'donut' ? 60 : 0}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey={localSpec.yAxis || 'value'} // Fallback for pure aggregates
                            nameKey={localSpec.xAxis || 'name'}
                        >
                            {chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                );

            // Fallback for types not yet implemented
            default:
                return (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        Chart type '{localSpec.type}' not yet supported in Widget
                    </div>
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
        <div className={`bg-white rounded-lg p-4 transition-all duration-200 ${isEditing ? 'ring-2 ring-indigo-500' : 'hover:shadow-md'}`}>
            <div className="flex justify-between items-start mb-4">
                {editMode ? (
                    <div className="flex-1 space-y-2">
                        <input
                            type="text"
                            value={localSpec.title}
                            onChange={e => setLocalSpec({ ...localSpec, title: e.target.value })}
                            className="block w-full px-2 py-1 border rounded text-sm font-semibold"
                            placeholder="Chart Title"
                        />
                        <div className="flex gap-2">
                            <select
                                value={localSpec.type}
                                onChange={e => setLocalSpec({ ...localSpec, type: e.target.value })}
                                className="block px-2 py-1 border rounded text-xs"
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
                    <div>
                        <h3 className="font-semibold text-gray-800">{chart.title}</h3>
                        <p className="text-xs text-gray-400">{chartData.length} data points</p>
                    </div>
                )}

                <div className="flex items-center gap-1">
                    {editMode ? (
                        <button
                            onClick={handleSaveEdit}
                            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                        >
                            Save
                        </button>
                    ) : (
                        <>
                            {isEditing && (
                                <button
                                    onClick={() => setEditMode(true)}
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"
                                    title="Edit Chart"
                                >
                                    ✎
                                </button>
                            )}
                            <SendToMenu chart={localSpec} elementId={`chart-export-${chart.id}`} />
                            {onDelete && isEditing && (
                                <button
                                    onClick={onDelete}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                                    title="Remove"
                                >
                                    ✕
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="w-full" style={{ height: typeof height === 'number' ? height - 60 : `calc(${height} - 60px)` }} id={`chart-export-${chart.id}`}>
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>

            {localSpec.sourceModule && (
                <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    <span>Source: {localSpec.sourceModule}</span>
                    {localSpec.isWidget && <span className="px-1.5 py-0.5 bg-gray-100 rounded-full text-[10px]">Widget</span>}
                </div>
            )}
        </div>
    );
};
