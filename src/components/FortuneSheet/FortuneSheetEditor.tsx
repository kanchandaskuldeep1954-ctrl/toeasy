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
    theme = 'light',
}, ref) => {
    // Transform DataRow[] to FortuneSheet celldata format
    const [sheetData, setSheetData] = useState<any[]>([]);
    const currentDataRef = useRef<DataRow[]>(data);

    // Color definitions (Now only for Highlights)
    const highlightColors = {
        error: '#fca5a5',     // Light Red
        warning: '#fcd34d',   // Light Amber
        info: '#93c5fd',      // Light Blue
        recovered: '#86efac', // Light Green
    };

    useEffect(() => {
        if (!data || data.length === 0) return;
        currentDataRef.current = data;

        const cellData: any[] = [];
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
                    bg: '#f1f5f9', // Standard light gray header
                    bl: 1, // bold
                    fc: '#334155',
                }
            });
        });

        // 2. Create Data Rows (Row 1+)
        renderData.forEach((row, rowIndex) => {
            const sheetRowIndex = rowIndex + 1;

            headers.forEach((header, colIndex) => {
                const value = row[header];
                const displayValue = value === null || value === undefined ? '' : String(value);

                let bg = undefined;

                // Apply highlighting (Only for specific cases)
                if (row.__metadata?.recoveredFields?.includes(header)) {
                    bg = highlightColors.recovered;
                }

                if (highlightIssues) {
                    const issue = issues.find(i => i.row === rowIndex && i.columnName === header);
                    if (issue) {
                        if (issue.severity === 'error') bg = highlightColors.error;
                        else if (issue.severity === 'warning') bg = highlightColors.warning;
                        else bg = highlightColors.info;
                    }
                }

                cellData.push({
                    r: sheetRowIndex,
                    c: colIndex,
                    v: {
                        v: value === null || value === undefined ? '' : value,
                        m: displayValue,
                        bg, // Only set if highlight exists
                        fc: '#000000', // Standard black text
                        ct: { t: 'g', fa: 'General' },
                    }
                });
            });
        });

        setSheetData(cellData);
    }, [data, headers, issues, highlightIssues]); // Removed theme from dependency as filter handles it

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
        <div className="fortune-sheet-container w-full h-full relative transition-all duration-300">
            <style>
                {`
                    .fortune-sheet-container {
                        background: #ffffff;
                        filter: none;
                    }
                    /* Real-time reactivity via global class */
                    :root.dark .fortune-sheet-container {
                        filter: invert(0.9) hue-rotate(180deg) brightness(1.1) contrast(1.1);
                        background: #000000 !important;
                    }
                `}
            </style>
            {sheetData.length > 0 ? (
                <Workbook
                    key={componentKey}
                    data={[{
                        name: "Data",
                        celldata: sheetData, // Use celldata for initialization
                        status: 1,
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
