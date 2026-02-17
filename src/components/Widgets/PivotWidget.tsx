import React, { useState, useMemo, useEffect } from 'react';
import { DataRow } from '../../../types';
import { DataGridWidget } from './DataGridWidget';

export interface PivotConfig {
    rows: string[];
    columns: string[];
    values: { field: string; agg: 'sum' | 'count' | 'avg' | 'min' | 'max' }[];
}

export interface PivotWidgetProps {
    data: DataRow[];
    fields: string[];
    config?: PivotConfig;
    onConfigChange?: (config: PivotConfig) => void;
    height?: number | string;
}

export const PivotWidget: React.FC<PivotWidgetProps> = ({
    data = [],
    fields = [],
    config: initialConfig,
    onConfigChange,
    height = 500
}) => {
    const [config, setConfig] = useState<PivotConfig>(initialConfig || {
        rows: [],
        columns: [],
        values: []
    });

    // Sync if initialConfig updates externally
    useEffect(() => {
        if (initialConfig) {
            setConfig(prev => (JSON.stringify(prev) !== JSON.stringify(initialConfig) ? initialConfig : prev));
        }
    }, [initialConfig]);

    const updateConfig = (newConfig: PivotConfig) => {
        setConfig(newConfig);
        if (onConfigChange) onConfigChange(newConfig);
    };

    const handleAddField = (field: string, target: 'rows' | 'columns' | 'values') => {
        const newConfig = { ...config };
        newConfig.rows = [...config.rows];
        newConfig.columns = [...config.columns];
        newConfig.values = [...config.values];

        if (target === 'values') {
            newConfig.values.push({ field, agg: 'sum' });
        } else {
            newConfig[target].push(field);
        }
        updateConfig(newConfig);
    };

    const handleRemoveField = (index: number, target: 'rows' | 'columns' | 'values') => {
        const newConfig = { ...config };
        newConfig.rows = [...config.rows];
        newConfig.columns = [...config.columns];
        newConfig.values = [...config.values];

        if (target === 'values') {
            newConfig.values.splice(index, 1);
        } else {
            newConfig[target].splice(index, 1);
        }
        updateConfig(newConfig);
    };

    const handleAggChange = (index: number, agg: string) => {
        const newConfig = { ...config };
        newConfig.values = [...config.values];
        newConfig.values[index] = { ...newConfig.values[index], agg: agg as any };
        updateConfig(newConfig);
    };

    // Compute Pivot Logic
    const pivotData = useMemo(() => {
        if (!data || !data.length || (!config.rows.length && !config.columns.length && !config.values.length)) return [];

        const groups: Record<string, any[]> = {};

        data.forEach(row => {
            const rowKey = config.rows.map(r => row[r]).join('::');
            const colKey = config.columns.map(c => row[c]).join('::');
            const key = `${rowKey}|||${colKey}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });

        const result: any[] = [];
        const rowKeysSet = new Set<string>();
        const colKeysSet = new Set<string>();

        Object.keys(groups).forEach(key => {
            const [rKey, cKey] = key.split('|||');
            if (rKey) rowKeysSet.add(rKey);
            if (cKey) colKeysSet.add(cKey);
        });

        const uniqueRowKeys = Array.from(rowKeysSet).sort();
        const uniqueColKeys = Array.from(colKeysSet).sort();

        if (config.columns.length > 0) {
            uniqueRowKeys.forEach(rKey => {
                const rowObj: any = {};
                const rValues = rKey.split('::');
                config.rows.forEach((field, i) => {
                    rowObj[field] = rValues[i] === 'undefined' ? '(blank)' : rValues[i];
                });

                uniqueColKeys.forEach(cKey => {
                    const key = `${rKey}|||${cKey}`;
                    const group = groups[key] || [];
                    config.values.forEach(v => {
                        const val = aggregate(group, v.field, v.agg);
                        const colName = `${cKey} (${v.agg} ${v.field})`;
                        rowObj[colName] = val;
                    });
                });
                result.push(rowObj);
            });
        } else {
            uniqueRowKeys.forEach(rKey => {
                const rowObj: any = {};
                const rValues = rKey.split('::');
                config.rows.forEach((field, i) => {
                    rowObj[field] = rValues[i] === 'undefined' ? '(blank)' : rValues[i];
                });

                const key = `${rKey}|||`;
                const group = groups[key] || [];
                config.values.forEach(v => {
                    const val = aggregate(group, v.field, v.agg);
                    rowObj[`${v.agg}_${v.field}`] = val;
                });
                result.push(rowObj);
            });

            if (config.rows.length === 0 && config.columns.length === 0 && config.values.length > 0) {
                const rowObj: any = { 'Label': 'Grand Total' };
                const key = `|||`;
                const group = groups[key] || [];
                config.values.forEach(v => {
                    const val = aggregate(group, v.field, v.agg);
                    rowObj[`${v.agg}_${v.field}`] = val;
                });
                result.push(rowObj);
            }
        }

        return result;
    }, [data, config]);

    function aggregate(rows: any[], field: string, type: string) {
        const values = rows.map(r => r[field]).filter(v => typeof v === 'number');
        if (values.length === 0) return 0;

        switch (type) {
            case 'sum': return values.reduce((a, b) => a + b, 0);
            case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
            case 'min': return Math.min(...values);
            case 'max': return Math.max(...values);
            case 'count': return rows.length;
            default: return 0;
        }
    }

    return (
        <div className="flex h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" style={{ height }}>
            {/* Config Panel */}
            <div className="w-64 bg-slate-50 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-y-auto">
                <div className="p-3 font-bold text-slate-700 dark:text-slate-200 text-sm border-b border-slate-200 dark:border-slate-700">Fields</div>
                <div className="p-2 space-y-1">
                    {fields.map(field => (
                        <div key={field} className="text-sm px-2 py-1.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg cursor-move hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex justify-between group transition-colors">
                            <span className="text-slate-700 dark:text-slate-300 truncate">{field}</span>
                            <div className="hidden group-hover:flex gap-1">
                                <button onClick={() => handleAddField(field, 'rows')} className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 rounded font-medium">R</button>
                                <button onClick={() => handleAddField(field, 'columns')} className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-1.5 rounded font-medium">C</button>
                                <button onClick={() => handleAddField(field, 'values')} className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 px-1.5 rounded font-medium">V</button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-3 font-bold text-slate-700 dark:text-slate-200 text-sm border-b border-slate-200 dark:border-slate-700 mt-4">Row Groups</div>
                <div className="p-2 space-y-1 min-h-[50px] bg-blue-50/50 dark:bg-blue-900/10">
                    {config.rows.length === 0 && <div className="text-xs text-slate-400 dark:text-slate-500 italic p-2">Drag fields here</div>}
                    {config.rows.map((field, i) => (
                        <div key={i} className="text-sm px-2 py-1.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg flex justify-between items-center text-blue-800 dark:text-blue-300">
                            {field}
                            <button onClick={() => handleRemoveField(i, 'rows')} className="hover:text-red-500 dark:hover:text-red-400 text-blue-400 dark:text-blue-500">×</button>
                        </div>
                    ))}
                </div>

                <div className="p-3 font-bold text-slate-700 dark:text-slate-200 text-sm border-b border-slate-200 dark:border-slate-700 mt-2">Column Groups</div>
                <div className="p-2 space-y-1 min-h-[50px] bg-emerald-50/50 dark:bg-emerald-900/10">
                    {config.columns.length === 0 && <div className="text-xs text-slate-400 dark:text-slate-500 italic p-2">Drag fields here</div>}
                    {config.columns.map((field, i) => (
                        <div key={i} className="text-sm px-2 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-lg flex justify-between items-center text-emerald-800 dark:text-emerald-300">
                            {field}
                            <button onClick={() => handleRemoveField(i, 'columns')} className="hover:text-red-500 dark:hover:text-red-400 text-emerald-400 dark:text-emerald-500">×</button>
                        </div>
                    ))}
                </div>

                <div className="p-3 font-bold text-slate-700 dark:text-slate-200 text-sm border-b border-slate-200 dark:border-slate-700 mt-2">Values</div>
                <div className="p-2 space-y-1 min-h-[50px] bg-amber-50/50 dark:bg-amber-900/10">
                    {config.values.length === 0 && <div className="text-xs text-slate-400 dark:text-slate-500 italic p-2">Drag fields here</div>}
                    {config.values.map((v, i) => (
                        <div key={i} className="flex flex-col gap-1 text-sm p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300">
                            <div className="flex justify-between items-center">
                                <span className="font-medium truncate">{v.field}</span>
                                <button onClick={() => handleRemoveField(i, 'values')} className="hover:text-red-500 dark:hover:text-red-400 text-amber-400 dark:text-amber-500">×</button>
                            </div>
                            <select
                                value={v.agg}
                                onChange={(e) => handleAggChange(i, e.target.value)}
                                className="text-xs bg-white dark:bg-slate-700 border border-amber-200 dark:border-amber-700 rounded px-1.5 py-0.5 text-amber-800 dark:text-amber-300"
                            >
                                <option value="sum">Sum</option>
                                <option value="count">Count</option>
                                <option value="avg">Average</option>
                                <option value="min">Min</option>
                                <option value="max">Max</option>
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
                    Pivot Results
                    {pivotData.length > 0 && ` (${pivotData.length} groups)`}
                </div>
                <div className="flex-1 overflow-hidden p-0">
                    <DataGridWidget
                        data={pivotData}
                        height="100%"
                        title=""
                    />
                </div>
            </div>
        </div>
    );
};
