
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { Dataset, DataRow } from '../types';
import { Sheet } from "@fortune-sheet/core";
import { Save, Sparkles, Table2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SpreadsheetViewProps {
    dataset: Dataset;
    onUpdate?: (updated: Dataset) => void;
}

const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({ dataset, onUpdate }) => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);

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

    // Save Handler
    const handleSave = async () => {
        setSaving(true);
        // In a real implementation, we'd extract the data from FortuneSheet
        // and send it to the backend via datasetAPI.update.
        setTimeout(() => setSaving(false), 800);
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
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-100 transition-colors">
                        <Sparkles className="w-4 h-4" />
                        AI Formulas
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

            {/* Grid Area */}
            <div className="flex-1 overflow-hidden relative w-full h-full bg-slate-50 dark:bg-slate-900">
                <Workbook
                    data={initialData}
                    onChange={(data) => {
                        // Internal changes
                    }}
                    settings={{
                        showInfobar: false,
                        showSheetTabs: true,
                    }}
                />
            </div>
        </div>
    );
};

export default SpreadsheetView;
