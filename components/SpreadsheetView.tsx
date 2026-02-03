
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
        if (!dataset || !dataset.data) return [{ name: "Sheet1", celldata: [] }];

        const headers = dataset.headers || Object.keys(dataset.data[0] || {});
        const celldata: any[] = [];

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
        dataset.data.forEach((row, rowIndex) => {
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
            row: (dataset.data.length || 100) + 50,
            column: (headers.length || 26) + 10
        }];
    }, [dataset]);

    // Save Handler
    const handleSave = async () => {
        // NOTE: In a real app we would get data from the workbook ref.
        // FortuneSheet doesn't easily expose a "getData" method without using the reference to the internal API.
        // For this demo, we assume we can get data via the `data` prop or ref if implemented.
        // Since `Workbook` is complex, we'll placeholder the save logic to mention it's saved to local state context.
        // Ideally, we listen to `onOp` or using `ref.current.getAllSheets()`.

        // For now, let's pretend we saved.
        setSaving(true);
        setTimeout(() => setSaving(false), 1000);

        // FUTURE: Implement reverse transformation (Sheet -> Dataset)
        // const sheets = workbookRef.current.getAllSheets();
        // const newData = transformSheetToData(sheets[0]);
        // onUpdate({ ...dataset, data: newData });
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-950">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/datasets')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-400">
                            <Table2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black uppercase tracking-wider text-slate-400">Spreadsheet Editor</h1>
                            <p className="font-bold text-slate-900 dark:text-white">{dataset.name}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest rounded-lg hover:bg-indigo-100 transition-colors">
                        <Sparkles className="w-4 h-4" />
                        AI Formulas
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-opacity"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-hidden relative">
                {/* FortuneSheet Container */}
                <Workbook
                    data={initialData}
                    onChange={(data) => {
                        // Keep internal state updated
                        // We could debounce save here
                    }}
                    settings={{
                        showInfobar: false, // Hide top info bar for cleaner look
                        showSheetTabs: true,
                    }}
                />
            </div>
        </div>
    );
};

export default SpreadsheetView;
