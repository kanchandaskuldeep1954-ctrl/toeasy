
import React, { useState } from 'react';
import { Dataset, DataRow } from '../../types';

interface DataEditorModalProps {
    dataset: Dataset;
    onSave: (updatedData: DataRow[]) => void;
    onClose: () => void;
}

export const DataEditorModal: React.FC<DataEditorModalProps> = ({ dataset, onSave, onClose }) => {
    const [data, setData] = useState<DataRow[]>([...dataset.data]);
    const [searchTerm, setSearchTerm] = useState('');
    const headers = dataset.headers.filter(h => h !== '__metadata');

    const handleCellChange = (rowIndex: number, field: string, value: string) => {
        const newData = [...data];
        newData[rowIndex] = { ...newData[rowIndex], [field]: value };
        setData(newData);
    };

    const filteredData = data.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-7xl h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">

                {/* Header */}
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-2xl">📊</span>
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Data Studio Editor</h2>
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Direct Spreadsheet Control • Changes reflect instantly on all charts</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search records..."
                                className="pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 w-64"
                            />
                            <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-lg">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Grid Area */}
                <div className="flex-1 overflow-auto custom-scrollbar relative">
                    <table className="w-full text-left text-[11px] border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th className="p-4 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 font-black uppercase tracking-widest text-center w-16">#</th>
                                {headers.map(h => (
                                    <th key={h} className="p-4 border-b border-r border-slate-200 dark:border-slate-700 font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider min-w-[150px]">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.slice(0, 500).map((row, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors group">
                                    <td className="p-4 border-b border-r border-slate-100 dark:border-slate-800 text-slate-400 font-mono text-center bg-slate-50/50 dark:bg-slate-900/50">{idx + 1}</td>
                                    {headers.map(h => (
                                        <td key={h} className="p-0 border-b border-r border-slate-100 dark:border-slate-800">
                                            <input
                                                value={String(row[h] ?? '')}
                                                onChange={(e) => handleCellChange(data.indexOf(row), h, e.target.value)}
                                                className="w-full h-full p-4 bg-transparent outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-inset focus:ring-indigo-500 font-medium text-slate-700 dark:text-slate-300 transition-all"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        Showing {Math.min(filteredData.length, 500)} of {data.length} records
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className="px-8 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all"
                        >
                            Discard
                        </button>
                        <button
                            onClick={() => onSave(data)}
                            className="px-10 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
