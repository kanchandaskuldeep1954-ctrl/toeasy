import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { DataRow, CellIssue } from '../../types';

export interface FortuneSheetEditorProps {
    data: DataRow[];
    headers: string[];
    issues?: CellIssue[];
    onCellEdit?: (row: number, col: number, oldValue: any, newValue: any) => void;
    onDataChange?: (data: DataRow[]) => void;
    readOnly?: boolean;
    highlightIssues?: boolean;
}

const FortuneSheetEditor = React.forwardRef<any, FortuneSheetEditorProps>(({
    data,
    headers,
    issues = [],
    onCellEdit,
    onDataChange,
    readOnly = false,
    highlightIssues = true,
}, ref) => {
    // Transform DataRow[] to FortuneSheet cell data format
    // FortuneSheet uses a 2D array of objects or values for cell data
    // r: row, c: column, v: value
    const [sheetData, setSheetData] = useState<any[]>([]);
    const currentDataRef = useRef<DataRow[]>(data);

    useEffect(() => {
        if (!data || data.length === 0) return;
        currentDataRef.current = data;

        // PERFORMANCE: Limit to first 1000 rows for initial stable render
        // Large datasets (50k+) can freeze the DOM/Canvas on initial mount
        const renderData = data.slice(0, 1000);

        // Create header row
        const headerRow = headers.map(h => ({
            v: h,
            ct: { t: 'g', fa: 'General' },
            bg: '#f1f5f9',
            bl: 1, // bold
            fc: '#334155',
        }));

        // Create data rows
        const rows = renderData.map((row, rowIndex) => {
            return headers.map((header, colIndex) => {
                const value = row[header];
                let bg = undefined;

                // Apply highlighting for recovered fields
                if (row.__metadata?.recoveredFields?.includes(header)) {
                    bg = '#d1fae5'; // Green for recovered
                }

                // Check for issues to highlight
                if (highlightIssues) {
                    const issue = issues.find(i => i.row === rowIndex && i.columnName === header);
                    if (issue) {
                        if (issue.severity === 'error') bg = '#fee2e2';
                        else if (issue.severity === 'warning') bg = '#fef3c7';
                        else bg = '#dbeafe';
                    }
                }

                return {
                    v: value === null || value === undefined ? '' : value,
                    m: value === null || value === undefined ? '' : String(value),
                    bg,
                    fc: '#000000', // Force black text
                };
            });
        });

        // Combine
        setSheetData([headerRow, ...rows]);
    }, [data, headers, issues, highlightIssues]);

    // Expose methods via ref (unchanged...)
    React.useImperativeHandle(ref, () => ({
        getSheetData: () => currentDataRef.current,
        animateCellFix: async (row: number, col: number, oldVal: any, newVal: any) => {
            if (onCellEdit) onCellEdit(row, col, oldVal, newVal);
        },
        applyIssueHighlighting: () => { }
    }));

    const componentKey = `fs-${data.length}-${headers.length}`;

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {sheetData.length > 0 ? (
                <Workbook
                    key={componentKey}
                    data={[{
                        name: "Data",
                        data: sheetData,
                        status: 1,
                        row: sheetData.length, // Explicit row count
                        column: headers.length, // Explicit column count
                    }]}
                />
            ) : (
                <div className="flex items-center justify-center h-full">
                    Loading spreadsheet...
                </div>
            )}
        </div>
    );
});

FortuneSheetEditor.displayName = 'FortuneSheetEditor';

export default FortuneSheetEditor;
