/**
 * VersionCompare Component
 * Phase 1.1: Side-by-side comparison of two versions
 * 
 * Features:
 * - Visual diff showing additions, deletions, modifications
 * - Statistics summary
 * - Column-level changes
 */

import React, { useState, useEffect } from 'react';
import { GitCompare, X, ArrowRight, Plus, Minus, Edit2, Columns, Table } from 'lucide-react';
import { VersionCompareProps, VersionDiff } from './types';

export const VersionCompare: React.FC<VersionCompareProps> = ({
    version1,
    version2,
    diff,
    onClose,
}) => {
    const [viewMode, setViewMode] = useState<'summary' | 'data'>('summary');

    if (!diff) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-slate-500">Computing differences...</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-4xl h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <GitCompare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Version Comparison</h2>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-medium">{version1.version_name}</span>
                                <ArrowRight className="w-3 h-3" />
                                <span className="font-medium">{version2.version_name}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Toggle */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('summary')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'summary'
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Summary
                            </button>
                            <button
                                onClick={() => setViewMode('data')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'data'
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Details
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {viewMode === 'summary' ? (
                        <div className="space-y-6">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                            <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                            {diff.addedRows}
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Rows Added</p>
                                </div>

                                <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                                            <Minus className="w-5 h-5 text-red-600 dark:text-red-400" />
                                        </div>
                                        <div className="text-3xl font-black text-red-600 dark:text-red-400">
                                            {diff.deletedRows}
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-red-700 dark:text-red-300">Rows Removed</p>
                                </div>

                                <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                                            <Edit2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
                                            {diff.modifiedRows}
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Rows Modified</p>
                                </div>
                            </div>

                            {/* Column Changes */}
                            {(diff.addedColumns.length > 0 || diff.deletedColumns.length > 0) && (
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white mb-4">
                                        <Columns className="w-4 h-4" />
                                        Column Changes
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {diff.addedColumns.length > 0 && (
                                            <div>
                                                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                                                    Added Columns
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {diff.addedColumns.map((col) => (
                                                        <span
                                                            key={col}
                                                            className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded text-xs font-medium"
                                                        >
                                                            + {col}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {diff.deletedColumns.length > 0 && (
                                            <div>
                                                <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
                                                    Removed Columns
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {diff.deletedColumns.map((col) => (
                                                        <span
                                                            key={col}
                                                            className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-medium"
                                                        >
                                                            - {col}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Version Details Side by Side */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">From</div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{version1.version_name}</h4>
                                    <p className="text-xs text-slate-500">{version1.row_count.toLocaleString()} rows</p>
                                    <p className="text-xs text-slate-400 mt-2">{new Date(version1.created_at).toLocaleString()}</p>
                                </div>
                                <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">To</div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{version2.version_name}</h4>
                                    <p className="text-xs text-slate-500">{version2.row_count.toLocaleString()} rows</p>
                                    <p className="text-xs text-slate-400 mt-2">{new Date(version2.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Cell Changes Table */}
                            {diff.changes.length > 0 ? (
                                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 dark:bg-slate-800">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Row</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Column</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Old Value</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">New Value</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {diff.changes.slice(0, 100).map((change, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{change.row}</td>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{change.column}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                                                            {String(change.oldValue ?? 'null')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded text-xs">
                                                            {String(change.newValue ?? 'null')}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {diff.changes.length > 100 && (
                                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500">
                                            Showing first 100 of {diff.changes.length} changes
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Table className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                                    <p className="text-sm text-slate-500">No cell-level changes detected</p>
                                    <p className="text-xs text-slate-400 mt-1">Only row additions/deletions or column changes</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VersionCompare;
