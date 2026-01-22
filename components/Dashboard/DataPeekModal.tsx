
import React from 'react';
import { ChartSpec } from '../../types';

interface DataPeekModalProps {
    chart: ChartSpec;
    data: any[];
    onClose: () => void;
}

export const DataPeekModal: React.FC<DataPeekModalProps> = ({ chart, data, onClose }) => {
    if (!data || data.length === 0) return null;

    // Extract headers dynamically from the first data row
    const headers = Object.keys(data[0]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-5xl max-h-[80vh] shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">

                {/* Header */}
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em] mb-2 block">Data Transparency Layer</span>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Source Data: {chart.title}</h3>
                        <p className="text-xs text-slate-500 mt-2 font-mono">
                            Logic: <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-indigo-600 dark:text-indigo-400">
                                {chart.aggregation?.toUpperCase() || 'SUM'}({chart.yAxis}) BY {chart.xAxis}
                            </span>
                        </p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                        ✕
                    </button>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto custom-scrollbar p-8">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                {headers.map(h => (
                                    <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {data.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    {headers.map(h => (
                                        <td key={h} className="p-4 text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
                                            {typeof row[h] === 'number' ? row[h].toLocaleString() : String(row[h])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center rounded-b-[32px]">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Showing {data.length} aggregated records
                    </div>
                    <button
                        onClick={() => {
                            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...data.map(r => headers.map(h => r[h]).join(','))].join('\n');
                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", `${chart.title}_data.csv`);
                            document.body.appendChild(link);
                            link.click();
                        }}
                        className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90"
                    >
                        Download CSV
                    </button>
                </div>
            </div>
        </div>
    );
};
