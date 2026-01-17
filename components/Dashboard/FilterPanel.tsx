
import React from 'react';
import { FilterSpec } from '../../types';

interface FilterPanelProps {
    filters: FilterSpec[];
    activeFilters: Record<string, any>;
    onFilterChange: (key: string, value: any) => void;
    onClearAll: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, activeFilters, onFilterChange, onClearAll }) => {
    if (!filters || filters.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mr-2">Filters:</span>

            {filters.map(filter => {
                const value = activeFilters[filter.column] || '';

                if (filter.type === 'select') {
                    return (
                        <div key={filter.id} className="relative group">
                            <select
                                value={value}
                                onChange={(e) => onFilterChange(filter.column, e.target.value)}
                                className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border cursor-pointer transition-all outline-none ${value
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                    }`}
                            >
                                <option value="">{filter.label} (All)</option>
                                {filter.options?.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className={`w-3 h-3 ${value ? 'text-white' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    );
                }

                if (filter.type === 'date') {
                    return (
                        <div key={filter.id} className="relative group">
                            <input
                                type="date"
                                value={value}
                                onChange={(e) => onFilterChange(filter.column, e.target.value)}
                                className={`appearance-none pl-3 pr-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border cursor-pointer transition-all outline-none ${value
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                    }`}
                            />
                        </div>
                    );
                }

                // Fallback for types not yet fully implemented
                return null;
            })}

            {Object.keys(activeFilters).length > 0 && (
                <button
                    onClick={onClearAll}
                    className="ml-2 p-1.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
                    title="Clear All"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            )}
        </div>
    );
};
