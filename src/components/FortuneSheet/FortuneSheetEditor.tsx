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

    // Color definitions for "Natural" look
    const colors = {
        bg: theme === 'dark' ? '#1e293b' : '#ffffff',   // Muted Slate for Dark, White for Light
        text: theme === 'dark' ? '#f1f5f9' : '#1e293b', // Muted White for Dark, Slate for Light
        headerBg: theme === 'dark' ? '#0f172a' : '#f1f5f9',
        headerText: theme === 'dark' ? '#94a3b8' : '#334155',
        highlights: {
            error: theme === 'dark' ? '#ef4444' : '#fee2e2',     // Stronger for Dark, Soft for Light
            warning: theme === 'dark' ? '#f59e0b' : '#fef3c7',
            info: theme === 'dark' ? '#3b82f6' : '#dbeafe',
            recovered: theme === 'dark' ? '#10b981' : '#d1fae5',
        }
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
                    bg: colors.headerBg,
                    bl: 1, // bold
                    fc: colors.headerText,
                }
            });
        });

        // 2. Create Data Rows (Row 1+)
        renderData.forEach((row, rowIndex) => {
            const sheetRowIndex = rowIndex + 1;

            headers.forEach((header, colIndex) => {
                const value = row[header];
                const displayValue = value === null || value === undefined ? '' : String(value);

                let bg = colors.bg;
                let fc = colors.text;

                // Apply highlighting
                if (row.__metadata?.recoveredFields?.includes(header)) {
                    bg = colors.highlights.recovered;
                    if (theme === 'dark') fc = '#ffffff';
                }

                if (highlightIssues) {
                    const issue = issues.find(i => i.row === rowIndex && i.columnName === header);
                    if (issue) {
                        if (issue.severity === 'error') bg = colors.highlights.error;
                        else if (issue.severity === 'warning') bg = colors.highlights.warning;
                        else bg = colors.highlights.info;

                        if (theme === 'dark') fc = '#ffffff';
                    }
                }

                cellData.push({
                    r: sheetRowIndex,
                    c: colIndex,
                    v: {
                        v: value === null || value === undefined ? '' : value,
                        m: displayValue,
                        bg,
                        fc,
                        ct: { t: 'g', fa: 'General' },
                    }
                });
            });
        });

        setSheetData(cellData);
    }, [data, headers, issues, highlightIssues, theme]); // Now depends on theme for "Natural" update

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
        getSheetData: () => currentDataRef.current,
        animateCellFix: async (row: number, col: number, oldVal: any, newVal: any) => {
            if (onCellEdit) onCellEdit(row, col, oldVal, newVal);
        },
        applyIssueHighlighting: () => { }
    }));

    // Re-mount key ensures real-time theme updates across the whole component
    const componentKey = `fs-${data.length}-${headers.length}-${theme}`;

    return (
        <div className="fortune-sheet-container w-full h-full relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <style>
                {`
                    /* Natural UI Skinning for Toolbar and UI Chrome */
                    .fortune-sheet-container .fortune-container {
                        background: ${theme === 'dark' ? '#0f172a' : '#ffffff'} !important;
                    }
                    .fortune-sheet-container .fortune-toolbar {
                        background-color: ${theme === 'dark' ? '#1e293b' : '#f8fafc'} !important;
                        border-bottom: 1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'} !important;
                    }
                `}
            </style>
            {sheetData.length > 0 ? (
                <Workbook
                    key={componentKey}
                    data={[{
                        name: "Data",
                        celldata: sheetData,
                        status: 1,
                    }]}
                />
            ) : (
                <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-900">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            )}
        </div>
    );
});

FortuneSheetEditor.displayName = 'FortuneSheetEditor';

export default FortuneSheetEditor;
