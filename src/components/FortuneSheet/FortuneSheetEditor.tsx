import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { DataRow, CellIssue } from '../../../types';

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

    // Standard light colors (Filter will handle Dark Mode naturally)
    const highlightColors = {
        error: '#fca5a5',     // Soft Red
        warning: '#fcd34d',   // Soft Amber
        info: '#93c5fd',      // Soft Blue
        recovered: '#86efac', // Soft Green
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
                    bg: '#f1f5f9',
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
                let ps = undefined;

                // 1. Recovered status (Green)
                if (row.__metadata?.recoveredFields?.includes(header)) {
                    bg = highlightColors.recovered;
                    const explanation = row.__metadata?.recoveryExplanations?.[header] || 'Self-corrected by AI';
                    const pass = row.__metadata?.recoveryPass ? ` (Pass ${row.__metadata.recoveryPass})` : '';
                    ps = {
                        value: `🛡️ AI RECOVERED\nReason: ${explanation}${pass}\nConfidence: High`,
                        isshow: false
                    };
                }

                // 2. Active Issues (Higher priority coloring)
                if (highlightIssues) {
                    const issue = issues.find(i => i.row === rowIndex && i.columnName === header);
                    if (issue) {
                        if (issue.severity === 'error') bg = highlightColors.error;
                        else if (issue.severity === 'warning') bg = highlightColors.warning;
                        else bg = highlightColors.info;

                        ps = {
                            value: `⚠️ ISSUE DETECTED\nType: ${issue.issueType}\nExplanation: ${issue.explanation}\nConfidence: ${Math.round((issue.confidence || 0.8) * 100)}%`,
                            isshow: false
                        };
                    }
                }

                // 3. User Edits (Status indicator)
                if (row.__metadata?.manualEdit && row.__metadata?.lastModified) {
                    // Only highlight if not already highlighted by AI
                    if (!bg) bg = '#e2e8f0'; // Subtle slate for user edit
                }

                cellData.push({
                    r: sheetRowIndex,
                    c: colIndex,
                    v: {
                        v: value === null || value === undefined ? '' : value,
                        m: displayValue,
                        bg,
                        ps,
                        fc: '#000000',
                        ct: { t: 'g', fa: 'General' },
                    }
                });
            });
        });

        setSheetData(cellData);
    }, [data, headers, issues, highlightIssues]); // Use standard light mode generation

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
        <div
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                filter: theme === 'dark' ? 'invert(0.9) hue-rotate(180deg) brightness(1.1) contrast(1.1)' : 'none',
                background: theme === 'dark' ? '#000' : '#fff',
                transition: 'filter 0.3s ease'
            }}
            className="fortune-sheet-container"
        >
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
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            )}
        </div>
    );
});

FortuneSheetEditor.displayName = 'FortuneSheetEditor';

export default FortuneSheetEditor;
