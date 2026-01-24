
import React from 'react';
import { FilterSpec } from '../../types';

interface FilterPanelProps {
    filters: FilterSpec[];
    activeFilters: Record<string, any>;
    onFilterChange: (key: string, value: any) => void;
    onClearAll: () => void;
    onAddFilter?: () => void;
    onRemoveFilter?: (id: string) => void;
    isEditMode?: boolean;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
    filters, activeFilters, onFilterChange, onClearAll, onAddFilter, onRemoveFilter, isEditMode
}) => {
    return (
        <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest mr-2">Filters:</span>

            {filters.map(filter => {
                const value = activeFilters[filter.column] || '';

                if (filter.type === 'select') {
                    return (
                        <div key={filter.id} className="relative group flex items-center gap-1.5 animate-in slide-in-from-left-2 transition-all">
                            <div className="relative">
                                <select
                                    value={value}
                                    onChange={(e) => onFilterChange(filter.column, e.target.value)}
                                    className={`appearance-none pl-3 pr-8 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border cursor-pointer transition-all outline-none ${value
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-400/50'
                                        }`}
                                >
                                    <option value="">{filter.label} (All)</option>
                                    {filter.options?.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <svg className={`w-3 h-3 ${value ? 'text-white' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                            {isEditMode && onRemoveFilter && (
                                <button
                                    onClick={() => onRemoveFilter(filter.id)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all scale-90 shadow-sm"
                                    title="Remove Filter"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    );
                }

                if (filter.type === 'date') {
                    return (
                        <div key={filter.id} className="relative group flex items-center gap-1.5 animate-in slide-in-from-left-2">
                            <input
                                type="date"
                                value={value}
                                onChange={(e) => onFilterChange(filter.column, e.target.value)}
                                className={`appearance-none pl-3 pr-2 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border cursor-pointer transition-all outline-none ${value
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-400/50'
                                    }`}
                            />
                            {isEditMode && onRemoveFilter && (
                                <button
                                    onClick={() => onRemoveFilter(filter.id)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all scale-90 shadow-sm"
                                    title="Remove Filter"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    );
                }

                return null;
            })}

            {isEditMode && onAddFilter && (
                <button
                    onClick={onAddFilter}
                    className="p-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-500 transition-all scale-90 flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/10"
                    title="Add Filter"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                </button>
            )}

            {Object.keys(activeFilters).length > 0 && (
                <button
                    onClick={onClearAll}
                    className="ml-2 p-2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-all duration-300"
                    title="Clear All Filters"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            )}
        </div>
    );
};
