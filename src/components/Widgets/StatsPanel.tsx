import React, { useMemo } from 'react';
import { DataRow } from '../../../types';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface StatsPanelProps {
    data: DataRow[];
    columns: string[];
    isOpen: boolean;
    onClose: () => void;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ data = [], columns = [], isOpen, onClose }) => {
    const stats = useMemo(() => {
        if (!data || !data.length || !columns || !columns.length) return {};

        const computed: Record<string, any> = {};

        (columns || []).forEach(col => {
            const values = data.map(row => row[col]);
            const validValues = values.filter(v => v !== null && v !== undefined && v !== '');
            const numValues = validValues.filter(v => typeof v === 'number');

            const isNumeric = numValues.length > validValues.length * 0.8;
            const uniqueValues = new Set(validValues).size;
            const nullCount = values.length - validValues.length;

            let distribution = [];
            let min, max, avg;

            if (isNumeric) {
                const nums = validValues.map(Number).sort((a, b) => a - b);
                min = nums[0];
                max = nums[nums.length - 1];
                avg = nums.reduce((a, b) => a + b, 0) / nums.length;

                // Simple 10-bin histogram
                const range = max - min;
                const binSize = range / 10;
                const bins = Array(10).fill(0);
                nums.forEach(n => {
                    const binIdx = Math.min(Math.floor((n - min) / binSize), 9);
                    bins[binIdx]++;
                });
                distribution = bins.map((count, i) => ({
                    name: (min + i * binSize).toFixed(1),
                    value: count
                }));
            } else {
                // Top 5 values
                const counts: Record<string, number> = {};
                validValues.forEach(v => {
                    const s = String(v);
                    counts[s] = (counts[s] || 0) + 1;
                });
                distribution = Object.entries(counts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, value]) => ({ name, value }));
            }

            computed[col] = {
                type: isNumeric ? 'numeric' : 'categorical',
                count: values.length,
                unique: uniqueValues,
                nulls: nullCount,
                min, max, avg,
                distribution
            };
        });

        return computed;
    }, [data, columns]);

    if (!isOpen) return null;

    return (
        <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl border-l border-gray-200 overflow-y-auto z-50 transform transition-transform duration-300">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 className="font-bold text-gray-700">Column Statistics</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-4 space-y-6">
                <div className="text-sm text-gray-500 mb-4">
                    Analysis of {data.length} rows
                </div>

                {(columns || []).map(col => {
                    const stat = stats[col];
                    if (!stat) return null;

                    return (
                        <div key={col} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-gray-800 truncate" title={col}>{col}</h4>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${stat.type === 'numeric' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                    {stat.type}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                                <div>Unique: <span className="font-medium text-gray-900">{stat.unique}</span></div>
                                <div>Nulls: <span className="font-medium text-gray-900">{stat.nulls}</span> ({((stat.nulls / stat.count) * 100).toFixed(0)}%)</div>
                                {stat.type === 'numeric' && (
                                    <>
                                        <div>Min: <span className="font-medium text-gray-900">{stat.min?.toFixed(1)}</span></div>
                                        <div>Max: <span className="font-medium text-gray-900">{stat.max?.toFixed(1)}</span></div>
                                        <div className="col-span-2">Avg: <span className="font-medium text-gray-900">{stat.avg?.toFixed(2)}</span></div>
                                    </>
                                )}
                            </div>

                            <div className="h-16 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stat.distribution}>
                                        <Tooltip
                                            contentStyle={{ fontSize: '10px', padding: '4px' }}
                                            cursor={{ fill: '#e5e7eb' }}
                                        />
                                        <Bar dataKey="value" fill={stat.type === 'numeric' ? '#6366f1' : '#8b5cf6'} radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
