import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Univer, LocaleType, merge, IWorkbookData, ICellData } from '@univerjs/core';
import { FUniver } from '@univerjs/facade';
import { defaultTheme } from '@univerjs/design';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverUIPlugin } from '@univerjs/ui';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';

// Import Univer CSS
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';

import { DataRow } from '../../../types';

// Types for cell issues
export interface CellIssue {
    row: number;
    col: number;
    columnName: string;
    currentValue: any;
    issueType: 'missing' | 'invalid_format' | 'outlier' | 'duplicate' | 'inconsistent' | 'semantic_error';
    severity: 'error' | 'warning' | 'info';
    suggestedValue: any;
    confidence: number;
    explanation: string;
    recoveryMethod?: 'ai_infer' | 'lookup' | 'calculate' | 'pattern' | 'default' | 'remove';
}

export interface UniverEditorProps {
    data: DataRow[];
    headers: string[];
    issues?: CellIssue[];
    onCellSelect?: (row: number, col: number, value: any) => void;
    onCellEdit?: (row: number, col: number, oldValue: any, newValue: any) => void;
    onDataChange?: (data: DataRow[]) => void;
    readOnly?: boolean;
    highlightIssues?: boolean;
}

// Convert DataRow[] to Univer workbook data format
const dataToWorkbook = (data: DataRow[], headers: string[]): IWorkbookData => {
    const cellData: { [key: number]: { [key: number]: ICellData } } = {};

    // Header row
    cellData[0] = {};
    headers.forEach((header, colIndex) => {
        cellData[0][colIndex] = {
            v: header,
            s: {
                bg: { rgb: '#f1f5f9' },
                bl: 1, // bold
                cl: { rgb: '#334155' },
                fs: 12,
            },
        };
    });

    // Data rows
    data.forEach((row, rowIndex) => {
        cellData[rowIndex + 1] = {};
        headers.forEach((header, colIndex) => {
            const value = row[header];
            cellData[rowIndex + 1][colIndex] = {
                v: value === null || value === undefined ? '' : value,
                s: value === null || value === undefined || value === '' ? {
                    bg: { rgb: '#fef3c7' }, // Yellow for empty/missing
                } : row.__metadata?.recoveredFields?.includes(header) ? {
                    bg: { rgb: '#d1fae5' }, // Green for recovered
                } : undefined,
            };
        });
    });

    return {
        id: 'cleaning-workbook',
        name: 'Data Cleaning',
        appVersion: '0.1.0',
        locale: LocaleType.EN_US,
        styles: {},
        sheetOrder: ['sheet-1'],
        sheets: {
            'sheet-1': {
                id: 'sheet-1',
                name: 'Data',
                rowCount: data.length + 1,
                columnCount: headers.length,
                cellData,
                defaultColumnWidth: 120,
                defaultRowHeight: 28,
                freeze: {
                    startRow: 1,
                    startColumn: 0,
                    ySplit: 1,
                    xSplit: 0,
                },
            },
        },
    };
};

// Apply issue-based highlighting to cells
const applyIssueHighlighting = (
    univerAPI: FUniver | null,
    issues: CellIssue[],
    headers: string[]
) => {
    if (!univerAPI) return;

    try {
        const sheet = univerAPI.getActiveWorkbook()?.getActiveSheet();
        if (!sheet) return;

        issues.forEach((issue) => {
            const colIndex = headers.indexOf(issue.columnName);
            if (colIndex === -1) return;

            const range = sheet.getRange(issue.row + 1, colIndex, 1, 1);

            if (issue.severity === 'error') {
                range.setBackgroundColor('#fee2e2'); // Red background
            } else if (issue.severity === 'warning') {
                range.setBackgroundColor('#fef3c7'); // Yellow background
            } else {
                range.setBackgroundColor('#dbeafe'); // Blue background for info
            }
        });
    } catch (e) {
        console.error('Error applying issue highlighting:', e);
    }
};

const UniverEditor: React.FC<UniverEditorProps> = ({
    data,
    headers,
    issues = [],
    onCellSelect,
    onCellEdit,
    onDataChange,
    readOnly = false,
    highlightIssues = true,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const univerRef = useRef<Univer | null>(null);
    const univerAPIRef = useRef<FUniver | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize Univer
    useEffect(() => {
        if (!containerRef.current || univerRef.current) return;

        const initUniver = async () => {
            try {
                // Create Univer instance
                const univer = new Univer({
                    theme: defaultTheme,
                    locale: LocaleType.EN_US,
                });

                // Register plugins
                univer.registerPlugin(UniverRenderEnginePlugin);
                univer.registerPlugin(UniverFormulaEnginePlugin);
                univer.registerPlugin(UniverUIPlugin, {
                    container: containerRef.current!,
                    header: false, // Hide default header for cleaner look
                    footer: false,
                });
                univer.registerPlugin(UniverSheetsPlugin);
                univer.registerPlugin(UniverSheetsUIPlugin);

                // Create workbook with data
                const workbookData = dataToWorkbook(data, headers);
                univer.createUniverSheet(workbookData);

                // Get Facade API for easier interaction
                const univerAPI = FUniver.newAPI(univer);

                univerRef.current = univer;
                univerAPIRef.current = univerAPI;
                setIsInitialized(true);

                // Apply issue highlighting after initialization
                if (highlightIssues && issues.length > 0) {
                    setTimeout(() => {
                        applyIssueHighlighting(univerAPI, issues, headers);
                    }, 500);
                }

                console.log('Univer initialized successfully');
            } catch (error) {
                console.error('Failed to initialize Univer:', error);
            }
        };

        initUniver();

        // Cleanup
        return () => {
            if (univerRef.current) {
                univerRef.current.dispose();
                univerRef.current = null;
                univerAPIRef.current = null;
            }
        };
    }, []);

    // Update highlighting when issues change
    useEffect(() => {
        if (isInitialized && highlightIssues && issues.length > 0) {
            applyIssueHighlighting(univerAPIRef.current, issues, headers);
        }
    }, [issues, highlightIssues, isInitialized, headers]);

    // Update data when it changes externally
    useEffect(() => {
        if (!isInitialized || !univerAPIRef.current) return;

        try {
            const workbook = univerAPIRef.current.getActiveWorkbook();
            if (!workbook) return;

            const sheet = workbook.getActiveSheet();
            if (!sheet) return;

            // 1. Sync Row Count
            const currentDataRows = data.length;
            const sheetRowCount = sheet.getRowCount() - 1; // Exclude header

            if (currentDataRows < sheetRowCount) {
                // Garbage or removed rows exist in sheet but not in data
                const rowsToDelete = sheetRowCount - currentDataRows;
                console.log(`[UniverEditor] Syncing grid: Deleting ${rowsToDelete} rows`);
                sheet.deleteRows(currentDataRows + 1, rowsToDelete);
            }

            // 2. Sync Column Count
            const currentHeaders = headers.length;
            const sheetColCount = sheet.getColumnCount();

            if (currentHeaders < sheetColCount) {
                // If columns were removed, it's safer to re-create the data map
                // But for now, let's just update values. 
                // Note: Univer doesn't easily support column deletion by name via Facade yet
            }

            // 3. Update cell values
            data.forEach((row, rowIndex) => {
                headers.forEach((header, colIndex) => {
                    const value = row[header];
                    const range = sheet.getRange(rowIndex + 1, colIndex, 1, 1);
                    range.setValue(value === null || value === undefined ? '' : value);

                    // Clear previous highlights if any (unless it's currently a recovered field)
                    if (row.__metadata?.recoveredFields?.includes(header)) {
                        range.setBackgroundColor('#d1fae5'); // Green for recovered
                    } else {
                        // Reset background if not recovered and not highlighted as issue
                        // We reset it to plain white or default so shifting rows don't carry old styles
                        range.setBackgroundColor('#ffffff');
                    }
                });
            });
        } catch (e) {
            console.error('Error updating Univer data:', e);
        }
    }, [data, isInitialized, headers]);

    // Get current data from Univer (for export or save)
    const getSheetData = useCallback((): DataRow[] => {
        if (!univerAPIRef.current) return data;

        try {
            const workbook = univerAPIRef.current.getActiveWorkbook();
            if (!workbook) return data;

            const sheet = workbook.getActiveSheet();
            if (!sheet) return data;

            const result: DataRow[] = [];
            for (let rowIndex = 1; rowIndex <= data.length; rowIndex++) {
                const row: DataRow = {};
                headers.forEach((header, colIndex) => {
                    const range = sheet.getRange(rowIndex, colIndex, 1, 1);
                    row[header] = range.getValue();
                });
                result.push(row);
            }

            return result;
        } catch (e) {
            console.error('Error getting sheet data:', e);
            return data;
        }
    }, [data, headers]);

    // Animate cell fix (for live cleaning visualization)
    const animateCellFix = useCallback(async (
        row: number,
        col: number,
        oldValue: any,
        newValue: any,
        explanation: string
    ): Promise<void> => {
        if (!univerAPIRef.current) return;

        try {
            const sheet = univerAPIRef.current.getActiveWorkbook()?.getActiveSheet();
            if (!sheet) return;

            const range = sheet.getRange(row + 1, col, 1, 1);

            // Step 1: Flash red (processing)
            range.setBackgroundColor('#fecaca');
            await new Promise(resolve => setTimeout(resolve, 200));

            // Step 2: Flash yellow (applying)
            range.setBackgroundColor('#fef08a');
            await new Promise(resolve => setTimeout(resolve, 200));

            // Step 3: Set new value
            range.setValue(newValue);

            // Step 4: Flash green (completed)
            range.setBackgroundColor('#86efac');
            await new Promise(resolve => setTimeout(resolve, 300));

            // Step 5: Settle to light green
            range.setBackgroundColor('#d1fae5');

            // Notify parent of cell edit
            if (onCellEdit) {
                onCellEdit(row, col, oldValue, newValue);
            }
        } catch (e) {
            console.error('Error animating cell fix:', e);
        }
    }, [onCellEdit]);

    // Expose methods via ref for parent component
    React.useImperativeHandle(
        React.useRef(),
        () => ({
            getSheetData,
            animateCellFix,
            applyIssueHighlighting: (issues: CellIssue[]) =>
                applyIssueHighlighting(univerAPIRef.current, issues, headers),
        }),
        [getSheetData, animateCellFix, headers]
    );

    return (
        <div className="relative w-full h-full">
            <div
                ref={containerRef}
                className="w-full h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
                style={{ minHeight: '400px' }}
            />

            {!isInitialized && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-sm font-bold text-slate-500">Loading Excel Editor...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UniverEditor;
