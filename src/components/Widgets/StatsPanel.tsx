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

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    return (
        <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-slate-900 shadow-xl border-l border-slate-200 dark:border-slate-700 overflow-y-auto z-50 transform transition-transform duration-300">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
                <h3 className="font-bold text-slate-700 dark:text-white">Column Statistics</h3>
                <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">✕</button>
            </div>

            <div className="p-4 space-y-6">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Analysis of {data.length} rows
                </div>

                {(columns || []).map(col => {
                    const stat = stats[col];
                    if (!stat) return null;

                    return (
                        <div key={col} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-slate-800 dark:text-white truncate" title={col}>{col}</h4>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-medium ${stat.type === 'numeric'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                    : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                    }`}>
                                    {stat.type}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 mb-3">
                                <div>Unique: <span className="font-medium text-slate-900 dark:text-slate-200">{stat.unique}</span></div>
                                <div>Nulls: <span className="font-medium text-slate-900 dark:text-slate-200">{stat.nulls}</span> ({((stat.nulls / stat.count) * 100).toFixed(0)}%)</div>
                                {stat.type === 'numeric' && (
                                    <>
                                        <div>Min: <span className="font-medium text-slate-900 dark:text-slate-200">{stat.min?.toFixed(1)}</span></div>
                                        <div>Max: <span className="font-medium text-slate-900 dark:text-slate-200">{stat.max?.toFixed(1)}</span></div>
                                        <div className="col-span-2">Avg: <span className="font-medium text-slate-900 dark:text-slate-200">{stat.avg?.toFixed(2)}</span></div>
                                    </>
                                )}
                            </div>

                            <div className="h-16 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stat.distribution}>
                                        <Tooltip
                                            contentStyle={{
                                                fontSize: '10px',
                                                padding: '4px 8px',
                                                borderRadius: '8px',
                                                backgroundColor: isDark ? '#1e293b' : '#fff',
                                                border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
                                            }}
                                            cursor={{ fill: isDark ? '#1e293b' : '#e5e7eb' }}
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
