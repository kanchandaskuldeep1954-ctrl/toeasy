/**
 * CommitVersionModal Component
 * Phase 1.1: Modal for committing new dataset versions
 * 
 * Features:
 * - Version name input with auto-suggestion
 * - Description textarea
 * - Tool attribution
 * - Loading state during commit
 */

import React, { useState, useEffect, useRef } from 'react';
import { GitCommit, X, FileText, MessageSquare, Tag, Loader2 } from 'lucide-react';
import { CommitVersionModalProps } from './types';

export const CommitVersionModal: React.FC<CommitVersionModalProps> = ({
    isOpen,
    onClose,
    onCommit,
    isCommitting,
    suggestedName,
    tool,
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Auto-generate a suggested name if not provided
            const defaultName = suggestedName || `v${Date.now().toString().slice(-6)} - ${tool} changes`;
            setName(defaultName);
            setDescription('');

            // Focus the input
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, suggestedName, tool]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || isCommitting) return;

        await onCommit(name.trim(), description.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && !isCommitting && onClose()}
            onKeyDown={handleKeyDown}
        >
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <GitCommit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Commit Version</h2>
                            <p className="text-xs text-slate-500">Save current state as a new version</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isCommitting}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Version Name */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <Tag className="w-4 h-4" />
                            Version Name
                            <span className="text-red-500">*</span>
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Cleaned data v2, Fixed outliers..."
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            disabled={isCommitting}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <MessageSquare className="w-4 h-4" />
                            Description
                            <span className="text-xs text-slate-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What changes did you make? Why?"
                            rows={3}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
                            disabled={isCommitting}
                        />
                    </div>

                    {/* Tool Info */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <div className="flex-1">
                            <div className="text-xs text-slate-500">Created by</div>
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{tool}</div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isCommitting}
                            className="flex-1 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCommitting || !name.trim()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                        >
                            {isCommitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Committing...
                                </>
                            ) : (
                                <>
                                    <GitCommit className="w-4 h-4" />
                                    Commit Version
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Tips */}
                <div className="px-6 pb-6">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <h4 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">💡 Pro Tip</h4>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 leading-relaxed">
                            Use descriptive names like "Removed duplicates" or "Fixed date formats" so you can easily find and restore specific versions later.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommitVersionModal;
