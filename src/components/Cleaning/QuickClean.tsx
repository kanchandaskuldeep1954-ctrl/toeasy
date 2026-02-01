import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dataset, CellIssue, ValidationRule } from '../../../types';

interface QuickCleanProps {
    dataset: Dataset;
    issues: CellIssue[];
    validationRules: ValidationRule[];
    semantics: any;
    onApplyFix: (issue: CellIssue) => Promise<void>;
    onApplyAll: () => Promise<void>;
    onIgnore: (issue: CellIssue) => void;
    onOpenAdvanced: () => void;
    isProcessing?: boolean;
    cleaningProgress?: number;
}

const SEVERITY_CONFIG = {
    error: { color: 'rose', icon: '🚨', label: 'Critical' },
    warning: { color: 'amber', icon: '⚠️', label: 'Warning' },
    info: { color: 'blue', icon: '💡', label: 'Suggestion' }
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
    missing: 'Missing Value',
    invalid_format: 'Invalid Format',
    outlier: 'Outlier Detected',
    duplicate: 'Duplicate Entry',
    inconsistent: 'Inconsistent Data',
    type_mismatch: 'Type Mismatch',
    structural: 'Structural Issue'
};

export const QuickClean: React.FC<QuickCleanProps> = ({
    dataset,
    issues,
    validationRules,
    semantics,
    onApplyFix,
    onApplyAll,
    onIgnore,
    onOpenAdvanced,
    isProcessing = false,
    cleaningProgress = 0
}) => {
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'critical' | 'warnings' | 'suggestions'>('all');
    const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
    const [fixingIssue, setFixingIssue] = useState<string | null>(null);

    // Group issues by type
    const groupedIssues = useMemo(() => {
        const groups: Record<string, CellIssue[]> = {};
        issues.forEach(issue => {
            const key = issue.issueType || 'other';
            if (!groups[key]) groups[key] = [];
            groups[key].push(issue);
        });
        return groups;
    }, [issues]);

    // Filter by category
    const filteredIssues = useMemo(() => {
        if (selectedCategory === 'all') return issues;
        if (selectedCategory === 'critical') return issues.filter(i => i.severity === 'error');
        if (selectedCategory === 'warnings') return issues.filter(i => i.severity === 'warning');
        if (selectedCategory === 'suggestions') return issues.filter(i => i.severity === 'info');
        return issues;
    }, [issues, selectedCategory]);

    // Stats
    const stats = useMemo(() => ({
        total: issues.length,
        critical: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        suggestions: issues.filter(i => i.severity === 'info').length,
        qualityScore: semantics?.qualityScore || 0
    }), [issues, semantics]);

    const handleQuickFix = useCallback(async (issue: CellIssue) => {
        setFixingIssue(`${issue.row}-${issue.col}`);
        try {
            await onApplyFix(issue);
        } finally {
            setFixingIssue(null);
        }
    }, [onApplyFix]);

    // If no issues, show success state
    if (issues.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 px-8"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                    <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                        <span className="text-5xl">✨</span>
                    </div>
                </div>
                <h2 className="mt-8 text-2xl font-black text-slate-900 dark:text-white">Data is Clean!</h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400 text-center max-w-md">
                    Your dataset passed all quality checks. No issues detected.
                </p>
                <div className="mt-6 flex items-center gap-3">
                    <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                            Quality Score: {Math.round(semantics?.qualityScore || 100)}%
                        </span>
                    </div>
                </div>
                <button
                    onClick={onOpenAdvanced}
                    className="mt-8 px-6 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                    Open Advanced Editor →
                </button>
            </motion.div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header with Stats */}
            <div className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">
                            QuickClean
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            AI found {stats.total} issue{stats.total !== 1 ? 's' : ''} that can be fixed
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Quality Score */}
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                            <div className={`w-3 h-3 rounded-full ${stats.qualityScore >= 80 ? 'bg-emerald-500' :
                                    stats.qualityScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                }`} />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {Math.round(stats.qualityScore)}% Quality
                            </span>
                        </div>
                        {/* Advanced Mode */}
                        <button
                            onClick={onOpenAdvanced}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-300"
                        >
                            Advanced Mode
                        </button>
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex items-center gap-2">
                    {[
                        { id: 'all', label: 'All Issues', count: stats.total },
                        { id: 'critical', label: 'Critical', count: stats.critical, color: 'rose' },
                        { id: 'warnings', label: 'Warnings', count: stats.warnings, color: 'amber' },
                        { id: 'suggestions', label: 'Suggestions', count: stats.suggestions, color: 'blue' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSelectedCategory(tab.id as any)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCategory === tab.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${selectedCategory === tab.id
                                        ? 'bg-white/20'
                                        : tab.color === 'rose' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                                            tab.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                                                tab.color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-slate-200 dark:bg-slate-700'
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Fix All Button */}
            {filteredIssues.length > 0 && (
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-indigo-500/20">
                    <button
                        onClick={onApplyAll}
                        disabled={isProcessing}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Fixing... {cleaningProgress}%</span>
                            </>
                        ) : (
                            <>
                                <span className="text-xl">🪄</span>
                                <span>Fix All {filteredIssues.length} Issues with AI</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Issue Cards */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                <AnimatePresence mode="popLayout">
                    {filteredIssues.map((issue, idx) => {
                        const config = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info;
                        const issueKey = `${issue.row}-${issue.col}`;
                        const isExpanded = expandedIssue === issueKey;
                        const isFixing = fixingIssue === issueKey;

                        return (
                            <motion.div
                                key={issueKey}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                                transition={{ delay: idx * 0.03 }}
                                className={`bg-white dark:bg-slate-900 rounded-2xl border ${issue.severity === 'error' ? 'border-rose-200 dark:border-rose-900/50' :
                                        issue.severity === 'warning' ? 'border-amber-200 dark:border-amber-900/50' :
                                            'border-slate-200 dark:border-slate-800'
                                    } overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
                            >
                                {/* Card Header */}
                                <div
                                    onClick={() => setExpandedIssue(isExpanded ? null : issueKey)}
                                    className="px-5 py-4 cursor-pointer flex items-center gap-4"
                                >
                                    {/* Severity Icon */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${issue.severity === 'error' ? 'bg-rose-100 dark:bg-rose-900/30' :
                                            issue.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30' :
                                                'bg-blue-100 dark:bg-blue-900/30'
                                        }`}>
                                        {config.icon}
                                    </div>

                                    {/* Issue Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                {issue.columnName}
                                            </span>
                                            <span className="text-xs text-slate-400">Row {issue.row + 1}</span>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                            {ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType}: {issue.explanation}
                                        </p>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleQuickFix(issue)}
                                            disabled={isFixing}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${issue.severity === 'error'
                                                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/30'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30'
                                                } disabled:opacity-50`}
                                        >
                                            {isFixing ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                'Fix'
                                            )}
                                        </button>
                                        <button
                                            onClick={() => onIgnore(issue)}
                                            className="px-3 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Ignore
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-slate-100 dark:border-slate-800"
                                        >
                                            <div className="px-5 py-4 space-y-4">
                                                {/* Before/After Preview */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
                                                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Current Value</span>
                                                        <p className="mt-1 font-mono text-sm text-rose-700 dark:text-rose-300 break-all">
                                                            {issue.currentValue === '' || issue.currentValue === null || issue.currentValue === undefined
                                                                ? <span className="italic text-rose-400">(empty)</span>
                                                                : String(issue.currentValue)
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">AI Suggestion</span>
                                                        <p className="mt-1 font-mono text-sm text-emerald-700 dark:text-emerald-300 break-all">
                                                            {issue.suggestedValue ?? <span className="italic text-emerald-400">(remove)</span>}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Confidence */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">AI Confidence</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${issue.confidence >= 0.8 ? 'bg-emerald-500' :
                                                                        issue.confidence >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'
                                                                    }`}
                                                                style={{ width: `${issue.confidence * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                            {Math.round(issue.confidence * 100)}%
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Explanation */}
                                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">AI Reasoning</span>
                                                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                                                        {issue.explanation}
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default QuickClean;
