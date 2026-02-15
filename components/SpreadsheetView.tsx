
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { Dataset, DataRow } from '../types';
import { Sheet } from "@fortune-sheet/core";
import { Save, Sparkles, Table2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { datasetAPI } from '../src/services/api';
import { MagicColumnModal } from '../src/components/Sheets/MagicColumnModal';
import { GroqService } from '../src/services/groqService';

interface SpreadsheetViewProps {
    dataset: Dataset;
    onUpdate?: (updated: Dataset) => void;
}

const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({ dataset, onUpdate }) => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [isMagicModalOpen, setIsMagicModalOpen] = useState(false);

    // Transform Dataset to FortuneSheet format
    const initialData = useMemo(() => {
        if (!dataset || (!dataset.data && !dataset.raw_data)) {
            return [{ name: "Sheet1", celldata: [], status: 1, order: 0 }];
        }

        const rawRows = dataset.data || dataset.raw_data || [];
        const headers = dataset.headers || (rawRows[0] ? Object.keys(rawRows[0]) : []);
        const celldata: any[] = [];

        if (rawRows.length === 0) {
            return [{ name: dataset.name || "Sheet1", celldata: [], status: 1, order: 0 }];
        }

        // 1. Headers
        headers.forEach((h, colIndex) => {
            celldata.push({
                r: 0,
                c: colIndex,
                v: {
                    v: h,
                    m: h,
                    bg: "#f3f4f6", // tailwind gray-100
                    bl: 1, // bold
                    ht: 0, // center align
                }
            });
        });

        // 2. Data
        rawRows.forEach((row: any, rowIndex: number) => {
            headers.forEach((h, colIndex) => {
                const val = row[h];
                celldata.push({
                    r: rowIndex + 1,
                    c: colIndex,
                    v: {
                        v: val,
                        m: String(val ?? "")
                    }
                });
            });
        });

        return [{
            name: dataset.name || "Sheet1",
            celldata: celldata,
            order: 0,
            status: 1, // active
            row: Math.max(rawRows.length + 50, 100),
            column: Math.max(headers.length + 10, 26)
        }];
    }, [dataset]);

    const [workbookData, setWorkbookData] = useState<any[]>(initialData as any);

    // Reset workbook state when switching datasets.
    useEffect(() => {
        setWorkbookData(initialData as any);
    }, [initialData]);

    const extractRowsFromWorkbook = useCallback((): { headers: string[]; rows: DataRow[] } => {
        const sheet = workbookData?.[0];
        const celldata = Array.isArray(sheet?.celldata) ? sheet.celldata : [];

        if (!celldata.length) {
            return { headers: (dataset as any)?.headers || [], rows: [] };
        }

        const rowsByIndex = new Map<number, Map<number, any>>();
        let maxRow = 0;
        let maxCol = 0;

        for (const cell of celldata) {
            const r = cell?.r;
            const c = cell?.c;
            if (typeof r !== 'number' || typeof c !== 'number') continue;
            maxRow = Math.max(maxRow, r);
            maxCol = Math.max(maxCol, c);

            const value = cell?.v?.v ?? cell?.v?.m ?? '';
            let row = rowsByIndex.get(r);
            if (!row) {
                row = new Map<number, any>();
                rowsByIndex.set(r, row);
            }
            row.set(c, value);
        }

        const headerRow = rowsByIndex.get(0) || new Map<number, any>();
        const headerCols = Array.from(headerRow.keys());
        if (headerCols.length > 0) {
            maxCol = Math.max(maxCol, ...headerCols);
        }

        const headers: string[] = [];
        const used = new Set<string>();
        for (let c = 0; c <= maxCol; c++) {
            const raw = headerRow.get(c);
            let h = raw === undefined || raw === null ? '' : String(raw).trim();
            if (!h) h = `Column${c + 1}`;

            // Enforce unique headers for object keys.
            let unique = h;
            let suffix = 2;
            while (used.has(unique)) unique = `${h}_${suffix++}`;
            used.add(unique);
            headers.push(unique);
        }

        const rows: DataRow[] = [];
        for (let r = 1; r <= maxRow; r++) {
            const rowCells = rowsByIndex.get(r) || new Map<number, any>();
            const obj: DataRow = {};
            let hasAny = false;

            for (let c = 0; c < headers.length; c++) {
                const key = headers[c];
                const val = rowCells.get(c);
                const isNonEmpty = val !== undefined && val !== null && String(val) !== '';
                if (isNonEmpty) hasAny = true;
                obj[key] = val === undefined ? '' : val;
            }

            if (hasAny) rows.push(obj);
        }

        return { headers, rows };
    }, [workbookData, dataset]);

    // Save Handler
    const handleSave = async () => {
        setSaving(true);
        try {
            const workspaceId = (dataset as any)?.workspace_id;
            const datasetId = (dataset as any)?.id;
            if (!workspaceId || !datasetId) {
                throw new Error('Missing workspace_id or dataset id; cannot save spreadsheet.');
            }

            const { headers, rows } = extractRowsFromWorkbook();

            // Persist as the dataset's raw_data + headers.
            const res = await datasetAPI.update(String(workspaceId), String(datasetId), {
                raw_data: rows,
                headers
            });

            const updated = res.data;
            const merged = {
                ...(dataset as any),
                ...(updated || {}),
                headers,
                data: rows,
                raw_data: rows
            };

            onUpdate?.(merged);
        } catch (e) {
            console.error('Spreadsheet save failed:', e);
            alert(e instanceof Error ? e.message : 'Failed to save spreadsheet changes.');
        } finally {
            setSaving(false);
        }
    };

    // Magic Column Handler
    const handleMagicColumnGeneration = async (newColName: string, instruction: string, contextCols: string[]) => {
        try {
            const { headers, rows } = extractRowsFromWorkbook();

            // Prepare batches (mocking 5 rows for demo speed, real world would be larger)
            const rowsToProcess = rows.map(r => {
                const context: any = {};
                contextCols.forEach(c => context[c] = r[c]);
                return context;
            });

            // Call AI Service
            const newValues = await GroqService.enrichData(rowsToProcess, instruction);

            // Merge new column into rows
            const updatedRows = rows.map((row, i) => ({
                ...row,
                [newColName]: newValues[i] || ""
            }));

            const updatedHeaders = [...headers, newColName];

            // Update local state immediately for UX
            // (Re-running the memoized transformation by updating dataset prop is harder, 
            // so we might need to force a refresh or update the workbook directly. 
            // For now, let's update the dataset object and trigger onUpdate)

            const workspaceId = (dataset as any)?.workspace_id;
            const datasetId = (dataset as any)?.id;

            if (workspaceId && datasetId) {
                await datasetAPI.update(String(workspaceId), String(datasetId), {
                    raw_data: updatedRows,
                    headers: updatedHeaders
                });

                onUpdate?.({
                    ...dataset,
                    headers: updatedHeaders,
                    data: updatedRows,
                    raw_data: updatedRows
                });
            }

        } catch (e) {
            console.error("Magic Column failed:", e);
            alert("Failed to generate column. See console for details.");
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-slate-950 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/app/datasets')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-400">
                            <Table2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">Spreadsheet Editor</h1>
                            <p className="font-bold text-sm text-slate-900 dark:text-white leading-none">{dataset.name}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsMagicModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                        <Sparkles className="w-4 h-4" />
                        Magic Column
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/10"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative w-full h-full bg-slate-50 dark:bg-slate-900">
                <Workbook
                    data={workbookData as any}
                    onChange={(data) => setWorkbookData(data as any)}
                    showToolbar
                    showFormulaBar
                    showSheetTabs
                />
            </div>

            <MagicColumnModal
                isOpen={isMagicModalOpen}
                onClose={() => setIsMagicModalOpen(false)}
                columns={(dataset.headers || [])}
                onGenerate={handleMagicColumnGeneration}
            />
        </div>
    );
};

export default SpreadsheetView;
