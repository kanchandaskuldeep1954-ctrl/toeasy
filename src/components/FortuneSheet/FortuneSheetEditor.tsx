import React, { useRef, useEffect, useState, useMemo } from 'react';
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
    lastUpdated?: string | number;
}

// Static colors - defined outside component to avoid recreation
const HIGHLIGHT_COLORS = {
    error: '#fca5a5',     // Soft Red
    warning: '#fcd34d',   // Soft Amber
    info: '#93c5fd',      // Soft Blue
    recovered: '#86efac', // Soft Green
    pendingFix: '#4ade80', // Bright Green (for animation)
};

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
    lastUpdated,
}, ref) => {
    const [pendingHighlights, setPendingHighlights] = useState<PendingHighlight[]>([]);
    const currentDataRef = useRef<DataRow[]>(data);
    const [refreshTick, setRefreshTick] = useState(0);

    // Build celldata from data + headers + issues + pending highlights
    // Using useMemo instead of useState + useEffect for immediate computation
    const sheetData = useMemo(() => {
        if (!data || data.length === 0 || !headers || headers.length === 0) {
            console.log('[FortuneSheet] No data/headers, returning empty celldata');
            return [];
        }

        console.log(`[FortuneSheet] Building celldata: ${data.length} rows, ${headers.length} columns`);
        currentDataRef.current = data;

        const cellData: any[] = [];
        const now = Date.now();
        const activeHighlights = pendingHighlights.filter(h => h.expiresAt > now);

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
        data.forEach((row, rowIndex) => {
            const sheetRowIndex = rowIndex + 1;

            headers.forEach((header, colIndex) => {
                const value = row[header];
                const displayValue = value === null || value === undefined ? '' : String(value);

                let bg: string | undefined = undefined;
                let ps: any = undefined;

                // Check for pending highlight (recently fixed cell - green flash)
                const isPending = activeHighlights.some(h => h.row === rowIndex && h.col === colIndex);
                if (isPending) {
                    bg = HIGHLIGHT_COLORS.pendingFix;
                }

                // 1. Recovered status (Green) - but not if pending
                if (!isPending && row.__metadata?.recoveredFields?.includes(header)) {
                    bg = HIGHLIGHT_COLORS.recovered;
                    const explanation = row.__metadata?.recoveryExplanations?.[header] || 'Self-corrected by AI';
                    ps = {
                        value: `🛡️ AI RECOVERED\nReason: ${explanation}\nConfidence: High`,
                        isshow: false
                    };
                }

                // 2. Active Issues (Higher priority coloring)
                if (!isPending && !bg && highlightIssues) {
                    const issue = issues.find(i => i.row === rowIndex && i.columnName === header);
                    if (issue) {
                        if (issue.severity === 'error') bg = HIGHLIGHT_COLORS.error;
                        else if (issue.severity === 'warning') bg = HIGHLIGHT_COLORS.warning;
                        else bg = HIGHLIGHT_COLORS.info;

                        ps = {
                            value: `⚠️ ISSUE\nType: ${issue.issueType}\n${issue.explanation}`,
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

        console.log(`[FortuneSheet] Built ${cellData.length} cells`);
        return cellData;
    }, [data, headers, issues, highlightIssues, pendingHighlights, theme]);

    // Clean up expired highlights
    useEffect(() => {
        if (pendingHighlights.length === 0) return;

        const timer = setTimeout(() => {
            const now = Date.now();
            setPendingHighlights(prev => prev.filter(h => h.expiresAt > now));
        }, 1000);

        return () => clearTimeout(timer);
    }, [pendingHighlights]);

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
        getSheetData: () => currentDataRef.current,

        animateCellFix: async (row: number, col: number, _oldVal: any, _newVal: any) => {
            setPendingHighlights(prev => [
                ...prev.filter(h => !(h.row === row && h.col === col)),
                { row, col, expiresAt: Date.now() + 1500 }
            ]);
            if (onCellEdit) onCellEdit(row, col, _oldVal, _newVal);
        },

        setCellValue: (row: number, col: number, value: any) => {
            setPendingHighlights(prev => [
                ...prev.filter(h => !(h.row === row && h.col === col)),
                { row, col, expiresAt: Date.now() + 1500 }
            ]);
            console.log(`[FortuneSheet] setCellValue: row=${row}, col=${col}, value=${value}`);
        },

        deleteRow: (row: number) => {
            console.log(`[FortuneSheet] deleteRow: row=${row}`);
            setRefreshTick(prev => prev + 1);
        },

        deleteColumn: (col: number) => {
            console.log(`[FortuneSheet] deleteColumn: col=${col}`);
            setRefreshTick(prev => prev + 1);
        },

        scrollToCell: (row: number, col: number) => {
            console.log(`[FortuneSheet] scrollToCell: row=${row}, col=${col}`);
        },

        applyIssueHighlighting: () => {
            // Highlights are applied via useMemo already
        },

        forceUpdate: (newData: DataRow[], newHeaders?: string[]) => {
            currentDataRef.current = newData;
            console.log('[FortuneSheet] forceUpdate called, bumping refreshTick');
            setRefreshTick(prev => prev + 1);
        }
    }));

    // Generate a unique key for forcing re-renders when data changes structurally OR when explicitly requested
    const componentKey = useMemo(() => {
        // We include refreshTick here to force a clean reload of the library component
        if (lastUpdated) return `fs-${lastUpdated}-${refreshTick}`;
        return `fs-${data?.length || 0}-${headers?.length || 0}-${theme}-${refreshTick}`;
    }, [data?.length, headers?.length, theme, lastUpdated, refreshTick]);

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
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                        <p className="text-sm text-slate-500">Loading spreadsheet data...</p>
                    </div>
                </div>
            )}
        </div>
    );
});

FortuneSheetEditor.displayName = 'FortuneSheetEditor';

export default FortuneSheetEditor;
