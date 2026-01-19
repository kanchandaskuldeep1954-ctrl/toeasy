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

    // Color definitions based on theme (Vibrant & Dark Mode Support)
    const colors = {
        bg: theme === 'dark' ? '#0f172a' : '#ffffff',
        text: theme === 'dark' ? '#f8fafc' : '#000000',
        headerBg: theme === 'dark' ? '#1e293b' : '#f1f5f9',
        headerText: theme === 'dark' ? '#cbd5e1' : '#334155',
        highlights: {
            error: theme === 'dark' ? '#dc2626' : '#ff0000', // Stronger Reds
            warning: theme === 'dark' ? '#d97706' : '#fbbf24', // Stronger Ambers
            info: theme === 'dark' ? '#2563eb' : '#3b82f6', // Stronger Blues
            recovered: theme === 'dark' ? '#059669' : '#10b981', // Stronger Greens
        }
    };

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
                    bg: colors.headerBg,
                    bl: 1, // bold
                    fc: colors.headerText,
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
                let fc = colors.text;

                // Apply highlighting
                if (row.__metadata?.recoveredFields?.includes(header)) {
                    bg = colors.highlights.recovered;
                    if (theme === 'dark') fc = '#ffffff'; // White text on colored backgrounds
                }

                if (highlightIssues) {
                    const issue = issues.find(i => i.row === rowIndex && i.columnName === header);
                    if (issue) {
                        if (issue.severity === 'error') bg = colors.highlights.error;
                        else if (issue.severity === 'warning') bg = colors.highlights.warning;
                        else bg = colors.highlights.info;

                        if (theme === 'dark') fc = '#ffffff'; // white text on red/amber
                    }
                }

                cellData.push({
                    r: sheetRowIndex,
                    c: colIndex,
                    v: {
                        v: value === null || value === undefined ? '' : value,
                        m: displayValue,
                        bg: bg || colors.bg,
                        fc,
                        ct: { t: 'g', fa: 'General' },
                    }
                });
            });
        });

        setSheetData(cellData);
    }, [data, headers, issues, highlightIssues, theme]);

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
        <div style={{ width: '100%', height: '100%', position: 'relative' }} className={theme === 'dark' ? 'fortune-dark-mode' : ''}>
            <style>
                {`
                    .fortune-dark-mode .fortune-container {
                        background-color: #0f172a !important;
                        color: #f8fafc !important;
                    }
                    .fortune-dark-mode .fortune-toolbar {
                        background-color: #1e293b !important;
                        border-bottom: 1px solid #334155 !important;
                    }
                    .fortune-dark-mode .fortune-toolbar-button {
                        color: #cbd5e1 !important;
                    }
                    .fortune-dark-mode .fortune-toolbar-button:hover,
                    .fortune-dark-mode .fortune-toolbar-button-active {
                        background-color: #334155 !important;
                        color: #ffffff !important;
                    }
                    .fortune-dark-mode .fortune-col-header, 
                    .fortune-dark-mode .fortune-row-header-content {
                        background-color: #1e293b !important;
                        color: #94a3b8 !important;
                        border-color: #334155 !important;
                    }
                    .fortune-dark-mode .fortune-sheet-area {
                        background-color: #1e293b !important;
                        border-top: 1px solid #334155 !important;
                        color: #94a3b8 !important;
                    }
                    .fortune-dark-mode .fortune-grid-window {
                        background-color: #0f172a !important;
                    }
                    .fortune-dark-mode .fortune-input-box-container {
                        background-color: #1e293b !important;
                    }
                    .fortune-dark-mode .fortune-input-box {
                        background-color: #0f172a !important;
                        color: #f8fafc !important;
                        border: 1px solid #334155 !important;
                    }
                    .fortune-dark-mode .fortune-sheet-selection {
                        background-color: rgba(99, 102, 241, 0.15) !important;
                        border: 1px solid #6366f1 !important;
                    }
                    .fortune-dark-mode canvas {
                        background-color: #0f172a !important;
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
