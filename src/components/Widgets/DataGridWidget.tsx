import React, { useState, useMemo } from 'react';
import { DataRow } from '../../../types';

interface DataGridColumn {
    key: string;
    label: string;
    type?: 'text' | 'number' | 'date' | 'boolean';
    width?: number;
    editable?: boolean;
}

interface DataGridWidgetProps {
    data: any[];
    columns?: DataGridColumn[];
    height?: number | string;
    editable?: boolean;
    onCellEdit?: (rowIndex: number, columnKey: string, newValue: any) => void;
    onRowClick?: (row: any, index: number) => void;
    title?: string;
}

export const DataGridWidget: React.FC<DataGridWidgetProps> = ({
    data = [],
    columns: propColumns,
    height = 400,
    editable = false,
    onCellEdit,
    onRowClick,
    title
}) => {
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filterText, setFilterText] = useState('');
    const [editingCell, setEditingCell] = useState<{ rowIndex: number; key: string; value: any } | null>(null);

    // Infer columns if not provided
    const columns = useMemo(() => {
        if (propColumns) return propColumns;
        if (!data || data.length === 0) return [];

        const keys = Array.from(new Set(data.slice(0, 5).flatMap(Object.keys)));
        return keys.map(key => ({
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            type: typeof data[0][key] === 'number' ? 'number' : 'text',
            editable: true
        }));
    }, [data, propColumns]);

    // Sort and Filter logic
    const processedData = useMemo(() => {
        let result = [...(data || [])];

        if (filterText) {
            const lowerFilter = filterText.toLowerCase();
            result = result.filter(row =>
                Object.values(row).some(val =>
                    String(val).toLowerCase().includes(lowerFilter)
                )
            );
        }

        if (sortConfig) {
            result.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [data, sortConfig, filterText]);

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return current.direction === 'asc'
                    ? { key, direction: 'desc' }
                    : null;
            }
            return { key, direction: 'asc' };
        });
    };

    const handleCellBlur = () => {
        if (editingCell && onCellEdit) {
            onCellEdit(editingCell.rowIndex, editingCell.key, editingCell.value);
        }
        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCellBlur();
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" style={{ height }}>
            {/* Header Bar */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center flex-shrink-0">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">{title || `Data Grid (${processedData.length} rows)`}</h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                    />
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10">
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 select-none transition-colors"
                                    onClick={() => handleSort(col.key)}
                                    style={{ width: col.width }}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {sortConfig?.key === col.key && (
                                            <span className="text-indigo-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                        {processedData.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                                onClick={() => onRowClick && onRowClick(row, rowIndex)}
                            >
                                {columns.map(col => (
                                    <td
                                        key={`${rowIndex}-${col.key}`}
                                        className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap"
                                        onClick={(e) => {
                                            if (editable && col.editable !== false) {
                                                e.stopPropagation();
                                                setEditingCell({ rowIndex, key: col.key, value: row[col.key] });
                                            }
                                        }}
                                    >
                                        {editingCell?.rowIndex === rowIndex && editingCell.key === col.key ? (
                                            <input
                                                type={col.type === 'number' ? 'number' : 'text'}
                                                value={editingCell.value}
                                                onChange={e => setEditingCell({ ...editingCell, value: col.type === 'number' ? Number(e.target.value) : e.target.value })}
                                                onBlur={handleCellBlur}
                                                onKeyDown={handleKeyDown}
                                                autoFocus
                                                className="w-full px-1 py-0.5 border border-indigo-500 rounded focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                            />
                                        ) : (
                                            <span className={editable && col.editable !== false ? "hover:border-b hover:border-slate-400 dark:hover:border-slate-500 border-b border-transparent" : ""}>
                                                {String(row[col.key] ?? '')}
                                            </span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {processedData.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 italic">
                                    No data found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500 flex justify-between">
                <span>{processedData.length} rows visible</span>
                <span>{editable ? 'Double-click to edit' : 'Read only'}</span>
            </div>
        </div>
    );
};
