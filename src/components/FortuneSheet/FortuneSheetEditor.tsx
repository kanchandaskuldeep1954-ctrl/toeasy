import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Workbook } from '@fortunesheet/react';
import '@fortunesheet/react/dist/index.css';
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

        // Create header row
        const headerRow = headers.map(h => ({
            v: h,
            ct: { t: 'g', fa: 'General' },
            bg: '#f1f5f9',
            bl: 1, // bold
            fc: '#334155',
        }));

        // Create data rows
        const rows = data.map((row, rowIndex) => {
            return headers.map((header, colIndex) => {
                const value = row[header];
                let bg = undefined;

                // Apply highlighting for recovered fields
                if (row.__metadata?.recoveredFields?.includes(header)) {
                    bg = '#d1fae5'; // Green for recovered
                }

                // Check for issues to highlight
                // Note: This is an initial static highlight. 
                // Dynamic updates might need ref access to the sheet instance.
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
                    bg,
                };
            });
        });

        // Combine
        setSheetData([headerRow, ...rows]);
    }, [data, headers, issues, highlightIssues]);

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
        getSheetData: () => {
            // Return current data (simplified)
            // In a real implementation, we would parse the current sheet state
            return currentDataRef.current;
        },
        animateCellFix: async (row: number, col: number, oldVal: any, newVal: any) => {
            // Visual feedback not fully implemented for FortuneSheet yet
            // Just update the data
            if (onCellEdit) onCellEdit(row, col, oldVal, newVal);
        },
        applyIssueHighlighting: () => { } // Handled via props
    }));

    // Configuration for FortuneSheet
    const settings = {
        data: sheetData,
        onChange: (d: any) => {
            // Handle data changes
        }
    };

    // Note: FortuneSheet requires a container with explicit dimensions
    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Key forces re-render when data significantly changes if needed, 
                 but ideally we handle updates via API */}
            {sheetData.length > 0 ? (
                <Workbook
                    data={[{
                        name: "Data",
                        data: sheetData, // 2D array
                        status: 1
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
