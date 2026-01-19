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
    theme?: 'light' | 'dark';
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
    // Transform DataRow[] to FortuneSheet celldata format
    // celldata is a 1D array of objects: {r, c, v: {v, m, bg, fc, ...}}
    const [sheetData, setSheetData] = useState<any[]>([]);
    const currentDataRef = useRef<DataRow[]>(data);

    useEffect(() => {
        if (!data || data.length === 0) return;
        currentDataRef.current = data;

        const cellData: any[] = [];
        // Limit for safety check (remove later if stable)
        // const renderData = data.slice(0, 5000); 
        const renderData = data;

        // 1. Create Headers (Row 0)
        headers.forEach((h, colIndex) => {
            cellData.push({
                r: 0,
                c: colIndex,
                v: {
                    v: h,
                    m: h,
                    ct: { t: 'g', fa: 'General' },
                    bg: '#f1f5f9',
                    bl: 1, // bold
                    fc: '#000000', // Black text
                }
            });
        });

        // 2. Create Data Rows (Row 1+)
        renderData.forEach((row, rowIndex) => {
            const sheetRowIndex = rowIndex + 1; // Start at row 1 (row 0 is header)

            headers.forEach((header, colIndex) => {
                const value = row[header];
                const displayValue = value === null || value === undefined ? '' : String(value);

                let bg = undefined;

                // Apply highlighting
                if (row.__metadata?.recoveredFields?.includes(header)) {
                    bg = '#d1fae5';
                }

                if (highlightIssues) {
                    const issue = issues.find(i => i.row === rowIndex && i.columnName === header);
                    if (issue) {
                        if (issue.severity === 'error') bg = '#fee2e2';
                        else if (issue.severity === 'warning') bg = '#fef3c7';
                        else bg = '#dbeafe';
                    }
                }

                cellData.push({
                    r: sheetRowIndex,
                    c: colIndex,
                    v: {
                        v: value === null || value === undefined ? '' : value,
                        m: displayValue,
                        bg,
                        fc: '#000000',
                        ct: { t: 'g', fa: 'General' },
                    }
                });
            });
        });

        setSheetData(cellData);
    }, [data, headers, issues, highlightIssues]);

    // Expose methods via ref
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
                        celldata: sheetData, // Use celldata for initialization
                        status: 1,
                        // row: data.length + 50,  // Let it auto-expand or set reasonable default
                        // column: headers.length + 10
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
