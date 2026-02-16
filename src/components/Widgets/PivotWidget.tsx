import React, { useState, useMemo } from 'react';
import { DataRow } from '../../../types';
import { DataGridWidget } from './DataGridWidget';

interface PivotWidgetProps {
    data: DataRow[];
    fields: string[];
    height?: number | string;
}

interface PivotConfig {
    rows: string[];
    columns: string[];
    values: { field: string; agg: 'sum' | 'count' | 'avg' | 'min' | 'max' }[];
}

export const PivotWidget: React.FC<PivotWidgetProps> = ({ data, fields, height = 500 }) => {
    const [config, setConfig] = useState<PivotConfig>({
        rows: [],
        columns: [],
        values: []
    });

    const [availableFields, setAvailableFields] = useState<string[]>(fields);

    const handleAddField = (field: string, target: 'rows' | 'columns' | 'values') => {
        setConfig(prev => {
            const newConfig = { ...prev };
            if (target === 'values') {
                newConfig.values.push({ field, agg: 'sum' });
            } else {
                newConfig[target].push(field);
            }
            return newConfig;
        });
    };

    const handleRemoveField = (index: number, target: 'rows' | 'columns' | 'values') => {
        setConfig(prev => {
            const newConfig = { ...prev };
            if (target === 'values') {
                newConfig.values.splice(index, 1);
            } else {
                newConfig[target].splice(index, 1);
            }
            return newConfig;
        });
        // Logic to return to availableFields if needed, but for now we allow duplicate usage or just keep list static
    };

    const handleAggChange = (index: number, agg: string) => {
        setConfig(prev => {
            const newConfig = { ...prev };
            newConfig.values[index].agg = agg as any;
            return newConfig;
        });
    };

    // Compute Pivot Logic
    const pivotData = useMemo(() => {
        if (!data.length || (!config.rows.length && !config.columns.length && !config.values.length)) return [];

        // Grouping
        const groups: Record<string, any[]> = {};

        data.forEach(row => {
            const rowKey = config.rows.map(r => row[r]).join('::');
            const colKey = config.columns.map(c => row[c]).join('::');
            const key = `${rowKey}|||${colKey}`; // Separator
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });

        // Aggregation
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

        // If we have columns, we need to restructure for DataGrid
        if (config.columns.length > 0) {
            uniqueRowKeys.forEach(rKey => {
                const rowObj: any = {};
                // Set row fields
                const rValues = rKey.split('::');
                config.rows.forEach((field, i) => {
                    rowObj[field] = rValues[i] === 'undefined' ? '(blank)' : rValues[i];
                });

                // Set value fields for each column intersection
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
            // Simple grouping without column pivoting
            uniqueRowKeys.forEach(rKey => {
                const rowObj: any = {};
                // Set row fields
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

            // Handle "Grand Total" case where no rows/cols selected but values exist
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
            case 'count': return rows.length; // Count all, not just numeric
            default: return 0;
        }
    }

    return (
        <div className="flexh-full bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ height }}>
            {/* Config Panel */}
            <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
                <div className="p-3 font-bold text-gray-700 text-sm border-b border-gray-200">Fields</div>
                <div className="p-2 space-y-1">
                    {fields.map(field => (
                        <div key={field} className="text-sm px-2 py-1 bg-white border border-gray-200 rounded cursor-move hover:bg-indigo-50 flex justify-between group">
                            <span>{field}</span>
                            <div className="hidden group-hover:flex gap-1">
                                <button onClick={() => handleAddField(field, 'rows')} className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">R</button>
                                <button onClick={() => handleAddField(field, 'columns')} className="text-[10px] bg-green-100 text-green-600 px-1 rounded">C</button>
                                <button onClick={() => handleAddField(field, 'values')} className="text-[10px] bg-red-100 text-red-600 px-1 rounded">V</button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-3 font-bold text-gray-700 text-sm border-b border-gray-200 mt-4">Row Groups</div>
                <div className="p-2 space-y-1 min-h-[50px] bg-blue-50/50">
                    {config.rows.map((field, i) => (
                        <div key={i} className="text-sm px-2 py-1 bg-blue-100 border border-blue-200 rounded flex justify-between items-center text-blue-800">
                            {field}
                            <button onClick={() => handleRemoveField(i, 'rows')} className="hover:text-red-500">×</button>
                        </div>
                    ))}
                </div>

                <div className="p-3 font-bold text-gray-700 text-sm border-b border-gray-200 mt-2">Column Groups</div>
                <div className="p-2 space-y-1 min-h-[50px] bg-green-50/50">
                    {config.columns.map((field, i) => (
                        <div key={i} className="text-sm px-2 py-1 bg-green-100 border border-green-200 rounded flex justify-between items-center text-green-800">
                            {field}
                            <button onClick={() => handleRemoveField(i, 'columns')} className="hover:text-red-500">×</button>
                        </div>
                    ))}
                </div>

                <div className="p-3 font-bold text-gray-700 text-sm border-b border-gray-200 mt-2">Values</div>
                <div className="p-2 space-y-1 min-h-[50px] bg-red-50/50">
                    {config.values.map((v, i) => (
                        <div key={i} className="flex flex-col gap-1 text-sm p-1.5 bg-red-50 border border-red-200 rounded text-red-800">
                            <div className="flex justify-between items-center">
                                <span className="font-medium truncate">{v.field}</span>
                                <button onClick={() => handleRemoveField(i, 'values')} className="hover:text-red-500">×</button>
                            </div>
                            <select
                                value={v.agg}
                                onChange={(e) => handleAggChange(i, e.target.value)}
                                className="text-xs bg-white border border-red-200 rounded px-1"
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
                <div className="p-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
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
