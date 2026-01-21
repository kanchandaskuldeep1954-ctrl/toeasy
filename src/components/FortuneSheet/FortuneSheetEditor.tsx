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

// Track cells that were recently fixed (for green flash animation)
interface PendingHighlight {
    row: number;
    col: number;
    expiresAt: number;
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
    // CORE STATE: The celldata that FortuneSheet actually renders
    const [sheetData, setSheetData] = useState<any[]>([]);
    const [pendingHighlights, setPendingHighlights] = useState<PendingHighlight[]>([]);
    const currentDataRef = useRef<DataRow[]>(data);
    const renderCountRef = useRef(0);

    // Standard light colors
    const highlightColors = {
        error: '#fca5a5',     // Soft Red
        warning: '#fcd34d',   // Soft Amber
        info: '#93c5fd',      // Soft Blue
        recovered: '#86efac', // Soft Green
        pendingFix: '#4ade80', // Bright Green (for animation)
    };

    // Build celldata from data + headers + issues + pending highlights
    const buildCellData = useCallback((
        renderData: DataRow[],
        renderHeaders: string[],
        renderIssues: CellIssue[],
        highlights: PendingHighlight[]
    ): any[] => {
        if (!renderData || renderData.length === 0 || !renderHeaders || renderHeaders.length === 0) {
            return [];
        }

        const cellData: any[] = [];
        const now = Date.now();
        const activeHighlights = highlights.filter(h => h.expiresAt > now);

        // 1. Create Headers (Row 0)
        renderHeaders.forEach((h, colIndex) => {
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

            renderHeaders.forEach((header, colIndex) => {
                const value = row[header];
                const displayValue = value === null || value === undefined ? '' : String(value);

                let bg = undefined;
                let ps = undefined;

                // Check for pending highlight (recently fixed cell - green flash)
                const isPending = activeHighlights.some(h => h.row === rowIndex && h.col === colIndex);
                if (isPending) {
                    bg = highlightColors.pendingFix;
                }

                // 1. Recovered status (Green) - but not if pending (pending takes priority for animation)
                if (!isPending && row.__metadata?.recoveredFields?.includes(header)) {
                    bg = highlightColors.recovered;
                    const explanation = row.__metadata?.recoveryExplanations?.[header] || 'Self-corrected by AI';
                    const pass = row.__metadata?.recoveryPass ? ` (Pass ${row.__metadata.recoveryPass})` : '';
                    ps = {
                        value: `🛡️ AI RECOVERED\nReason: ${explanation}${pass}\nConfidence: High`,
                        isshow: false
                    };
                }

                // 2. Active Issues (Higher priority coloring) - but not if pending or recovered
                if (!isPending && !bg && highlightIssues) {
                    const issue = renderIssues.find(i => i.row === rowIndex && i.columnName === header);
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

        return cellData;
    }, [highlightIssues, highlightColors]);

    // Rebuild celldata whenever data, headers, issues, or highlights change
    useEffect(() => {
        if (!data || data.length === 0) return;
        currentDataRef.current = data;
        renderCountRef.current++;

        const newCellData = buildCellData(data, headers, issues, pendingHighlights);
        setSheetData(newCellData);
    }, [data, headers, issues, pendingHighlights, buildCellData]);

    // Clean up expired highlights
    useEffect(() => {
        if (pendingHighlights.length === 0) return;

        const timer = setTimeout(() => {
            const now = Date.now();
            setPendingHighlights(prev => prev.filter(h => h.expiresAt > now));
        }, 1000); // Check every second

        return () => clearTimeout(timer);
    }, [pendingHighlights]);

    // Expose methods via ref - these now work by updating state!
    React.useImperativeHandle(ref, () => ({
        getSheetData: () => currentDataRef.current,

        // Animate a cell fix with a green flash
        animateCellFix: async (row: number, col: number, _oldVal: any, _newVal: any) => {
            // Add to pending highlights for 1.5 seconds
            setPendingHighlights(prev => [
                ...prev.filter(h => !(h.row === row && h.col === col)), // Remove existing for this cell
                { row, col, expiresAt: Date.now() + 1500 }
            ]);

            if (onCellEdit) onCellEdit(row, col, _oldVal, _newVal);
        },

        // Update a cell value - triggers re-render with new data
        setCellValue: (row: number, col: number, value: any) => {
            // Add pending highlight for visual feedback
            setPendingHighlights(prev => [
                ...prev.filter(h => !(h.row === row && h.col === col)),
                { row, col, expiresAt: Date.now() + 1500 }
            ]);

            // Note: The actual data update happens in the parent component
            // This just provides visual feedback
            console.log(`[FortuneSheet] setCellValue called: row=${row}, col=${col}, value=${value}`);
        },

        // Mark a row for deletion (visual feedback)
        deleteRow: (row: number) => {
            console.log(`[FortuneSheet] deleteRow called: row=${row}`);
            // The actual deletion happens in the parent via state update
            // This is just a hook for potential future animations
        },

        // Mark a column for deletion (visual feedback)
        deleteColumn: (col: number) => {
            console.log(`[FortuneSheet] deleteColumn called: col=${col}`);
        },

        // Scroll to a cell (best effort - FortuneSheet doesn't expose this directly)
        scrollToCell: (row: number, col: number) => {
            console.log(`[FortuneSheet] scrollToCell called: row=${row}, col=${col}`);
            // FortuneSheet doesn't expose scroll API, but we can add highlight
            setPendingHighlights(prev => [
                ...prev.filter(h => !(h.row === row && h.col === col)),
                { row, col, expiresAt: Date.now() + 500 } // Brief highlight to draw attention
            ]);
        },

        applyIssueHighlighting: () => {
            // Force rebuild with current issues
            const newCellData = buildCellData(currentDataRef.current, headers, issues, pendingHighlights);
            setSheetData(newCellData);
        },

        // Force a complete re-render with new data
        forceUpdate: (newData: DataRow[], newHeaders?: string[]) => {
            currentDataRef.current = newData;
            const newCellData = buildCellData(newData, newHeaders || headers, issues, pendingHighlights);
            setSheetData(newCellData);
        }
    }));

    // Use render count + data length for key to force FortuneSheet internal refresh
    const componentKey = `fs-${data?.length || 0}-${headers?.length || 0}-${renderCountRef.current}`;

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

