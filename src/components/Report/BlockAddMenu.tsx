import React, { useState } from 'react';
import { ReportBlockType } from '../../types';
import { Plus, Type, BarChart2, Hash, Database, Table, Columns, Divide, List, ListOrdered, Heading1, Heading2, Heading3 } from 'lucide-react';

interface BlockAddMenuProps {
    onAdd: (type: ReportBlockType, initialContent?: any) => void;
}

export const BlockAddMenu: React.FC<BlockAddMenuProps> = ({ onAdd }) => {
    const [isOpen, setIsOpen] = useState(false);

    const addItem = (type: ReportBlockType, content: any = '') => {
        onAdd(type, content);
        setIsOpen(false);
    };

    if (!isOpen) {
        return (
            <div className="group relative h-4 hover:h-8 transition-all flex items-center justify-center -my-2 z-10">
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 hover:scale-100 shadow-sm border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                    title="Add Block"
                >
                    <Plus className="w-4 h-4" />
                </button>
                <div className="absolute inset-x-0 h-px bg-indigo-500/0 group-hover:bg-indigo-500/20 transition-colors pointer-events-none"></div>
            </div>
        );
    }

    return (
        <div className="my-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg animate-in slide-in-from-top-2 fade-in relative z-20">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Add Content Block</span>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button onClick={() => addItem('text')} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                    <Type className="w-4 h-4 text-slate-400" /> Text
                </button>
                <button onClick={() => addItem('heading1')} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                    <Heading1 className="w-4 h-4 text-slate-400" /> Heading 1
                </button>
                <button onClick={() => addItem('heading2')} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                    <Heading2 className="w-4 h-4 text-slate-400" /> Heading 2
                </button>
                <button onClick={() => addItem('bullet')} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                    <List className="w-4 h-4 text-slate-400" /> Bullet List
                </button>

                <div className="col-span-full h-px bg-slate-100 dark:bg-slate-800 my-1"></div>

                <button onClick={() => addItem('chart')} className="flex items-center gap-2 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 transition-colors">
                    <BarChart2 className="w-4 h-4" /> Chart
                </button>
                <button onClick={() => addItem('kpi')} className="flex items-center gap-2 p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-colors">
                    <Hash className="w-4 h-4" /> KPI
                </button>
                <button onClick={() => addItem('table')} className="flex items-center gap-2 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 transition-colors">
                    <Database className="w-4 h-4" /> Data Table
                </button>
                <button onClick={() => addItem('pivot')} className="flex items-center gap-2 p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg text-xs font-bold text-amber-600 dark:text-amber-400 transition-colors">
                    <Columns className="w-4 h-4" /> Pivot Table
                </button>

                <div className="col-span-full h-px bg-slate-100 dark:bg-slate-800 my-1"></div>

                <button onClick={() => addItem('divider')} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-400 transition-colors">
                    <Divide className="w-4 h-4" /> Divider
                </button>
            </div>
        </div>
    );
};
