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
    columns?: DataGridColumn[]; // If not provided, will be inferred from data
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

        // Get all unique keys from first few rows
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden" style={{ height }}>
            {/* Header Bar */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center flex-shrink-0">
                <h3 className="font-semibold text-gray-700">{title || `Data Grid (${processedData.length} rows)`}</h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort(col.key)}
                                    style={{ width: col.width }}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {sortConfig?.key === col.key && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {processedData.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                                onClick={() => onRowClick && onRowClick(row, rowIndex)}
                            >
                                {columns.map(col => (
                                    <td
                                        key={`${rowIndex}-${col.key}`}
                                        className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap"
                                        onClick={(e) => {
                                            if (editable && col.editable !== false) {
                                                e.stopPropagation(); // Prevent row click when editing
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
                                                className="w-full px-1 py-0.5 border border-indigo-500 rounded focus:outline-none"
                                            />
                                        ) : (
                                            <span className={editable && col.editable !== false ? "hover:border-b hover:border-gray-400 border-b border-transparent" : ""}>
                                                {String(row[col.key] ?? '')}
                                            </span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {processedData.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400 italic">
                                    No data found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="px-3 py-1 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
                <span>{processedData.length} rows visible</span>
                <span>{editable ? 'Double-click to edit' : 'Read only'}</span>
            </div>
        </div>
    );
};
