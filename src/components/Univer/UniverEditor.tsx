import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Univer, LocaleType, IWorkbookData, ICellData } from '@univerjs/core';
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

import { DataRow, CellIssue } from '../../../types';

export interface UniverEditorProps {
    data: DataRow[];
    headers: string[];
    issues?: CellIssue[];
    onCellSelect?: (row: number, col: number, value: any) => void;
    onCellEdit?: (row: number, col: number, oldValue: any, newValue: any) => void;
    onDataChange?: (data: DataRow[]) => void;
    readOnly?: boolean;
    highlightIssues?: boolean;
    theme?: 'light' | 'dark';
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
                rowCount: Math.max(data.length + 10, 100), // Add some buffer
                columnCount: Math.max(headers.length + 2, 26),
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

const UniverEditor = forwardRef<any, UniverEditorProps>(({
    data,
    headers,
    issues = [],
    onCellSelect,
    onCellEdit,
    onDataChange,
    readOnly = false,
    highlightIssues = true,
    theme = 'light'
}, ref) => {
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
                    header: false,
                    footer: false,
                });
                univer.registerPlugin(UniverSheetsPlugin);
                univer.registerPlugin(UniverSheetsUIPlugin);

                // Create workbook with data
                const workbookData = dataToWorkbook(data, headers);
                univer.createUniverSheet(workbookData);

                // Get Facade API
                const univerAPI = FUniver.newAPI(univer);
                univerRef.current = univer;
                univerAPIRef.current = univerAPI;
                setIsInitialized(true);

                console.log('[UniverEditor] Initialized');
            } catch (error) {
                console.error('Failed to initialize Univer:', error);
            }
        };

        initUniver();

        return () => {
            if (univerRef.current) {
                univerRef.current.dispose();
                univerRef.current = null;
                univerAPIRef.current = null;
            }
        };
    }, []);

    // Sync Data Efficiently (Matrix-based update)
    useEffect(() => {
        if (!isInitialized || !univerAPIRef.current || !data) return;

        try {
            const workbook = univerAPIRef.current.getActiveWorkbook();
            const sheet = workbook?.getActiveSheet();
            if (!sheet) return;

            // 1. Sync Dimensions
            const currentSheetRows = sheet.getRowCount();
            const targetRows = data.length + 1; // +1 for header

            if (targetRows < currentSheetRows) {
                // Delete excess rows from the end
                sheet.deleteRows(targetRows, currentSheetRows - targetRows);
            } else if (targetRows > currentSheetRows) {
                // Insert rows if needed
                sheet.insertRows(currentSheetRows, targetRows - currentSheetRows);
            }

            // 2. Build Matrix for SetValues (The "Excel Language" approach)
            const matrix: any[][] = [];

            // Re-sync Header just in case
            const headerRow: any[] = headers.map(h => ({
                v: h,
                s: { bg: { rgb: '#f1f5f9' }, bl: 1 }
            }));
            matrix.push(headerRow);

            // Sync Data Rows
            data.forEach((row) => {
                const rowValues = headers.map(header => {
                    const value = row[header];
                    const bg = row.__metadata?.recoveredFields?.includes(header) ? '#d1fae5' :
                        (value === null || value === undefined || value === '') ? '#fef3c7' : '#ffffff';

                    return {
                        v: value === null || value === undefined ? '' : value,
                        s: { bg: { rgb: bg } }
                    };
                });
                matrix.push(rowValues);
            });

            // Set all values in one atomic operation (Elite Performance)
            const range = sheet.getRange(0, 0, matrix.length, headers.length);
            range.setValues(matrix);

            // 3. Apply Issue Highlighting on top
            if (highlightIssues && issues.length > 0) {
                issues.forEach(issue => {
                    const colIdx = headers.indexOf(issue.columnName);
                    if (colIdx !== -1) {
                        const cellRange = sheet.getRange(issue.row + 1, colIdx, 1, 1);
                        const color = issue.severity === 'error' ? '#fee2e2' :
                            issue.severity === 'warning' ? '#fef3c7' : '#dbeafe';
                        cellRange.setBackgroundColor(color);
                    }
                });
            }

        } catch (e) {
            console.error('[UniverEditor] Sync failed:', e);
        }
    }, [data, headers, isInitialized, highlightIssues, issues]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        getSheetData: (): DataRow[] => {
            if (!univerAPIRef.current) return data;
            const sheet = univerAPIRef.current.getActiveWorkbook()?.getActiveSheet();
            if (!sheet) return data;

            const result: DataRow[] = [];
            const rowCount = data.length;
            const colCount = headers.length;

            for (let r = 1; r <= rowCount; r++) {
                const row: DataRow = { ...data[r - 1] };
                headers.forEach((h, c) => {
                    row[h] = sheet.getRange(r, c, 1, 1).getValue();
                });
                result.push(row);
            }
            return result;
        },
        animateCellFix: async (row: number, col: number, oldVal: any, newVal: any): Promise<void> => {
            if (!univerAPIRef.current) return;
            const sheet = univerAPIRef.current.getActiveWorkbook()?.getActiveSheet();
            if (!sheet) return;

            const range = sheet.getRange(row + 1, col, 1, 1);

            // Visual feedback loop
            range.setBackgroundColor('#fef08a'); // Applying
            await new Promise(r => setTimeout(r, 150));
            range.setValue(newVal);
            range.setBackgroundColor('#86efac'); // Fixed
            await new Promise(r => setTimeout(r, 200));
            range.setBackgroundColor('#d1fae5'); // Settled
        }
    }));

    return (
        <div className={`relative w-full h-full ${theme === 'dark' ? 'univer-dark' : ''}`}>
            <div
                ref={containerRef}
                className="w-full h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
                style={{ minHeight: '500px' }}
            />
            {!isInitialized && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-sm font-bold text-indigo-600">Initializing Elite Grid...</p>
                    </div>
                </div>
            )}
        </div>
    );
});

UniverEditor.displayName = 'UniverEditor';

export default UniverEditor;
