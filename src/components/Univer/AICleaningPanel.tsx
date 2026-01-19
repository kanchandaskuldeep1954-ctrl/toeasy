import React, { useState, useMemo } from 'react';
import { ValidationRule, DataRow, QualityDimension } from '../../../types';
import { CellIssue } from './UniverEditor';
import { ChangeHistoryEntry } from '../../services/univerService';

interface AICleaningPanelProps {
    issues: CellIssue[];
    rules: ValidationRule[];
    changeHistory: ChangeHistoryEntry[];
    onApplyFix: (issue: CellIssue) => void;
    onApplyAllFixes: () => void;
    onUndo: (historyId: string) => void;
    onRuleToggle: (ruleId: string) => void;
    onAskAI: (query: string) => Promise<string>;
    isProcessing: boolean;
    processingStatus?: string;
    headers: string[];
}

type PanelTab = 'issues' | 'rules' | 'history' | 'chat';

const AICleaningPanel: React.FC<AICleaningPanelProps> = ({
    issues,
    rules,
    changeHistory,
    onApplyFix,
    onApplyAllFixes,
    onUndo,
    onRuleToggle,
    onAskAI,
    isProcessing,
    processingStatus,
    headers,
}) => {
    const [activeTab, setActiveTab] = useState<PanelTab>('issues');
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [selectedDimension, setSelectedDimension] = useState<QualityDimension | 'All'>('All');

    // Group issues by severity
    const groupedIssues = useMemo(() => {
        const errors = issues.filter(i => i.severity === 'error');
        const warnings = issues.filter(i => i.severity === 'warning');
        const infos = issues.filter(i => i.severity === 'info');
        return { errors, warnings, infos };
    }, [issues]);

    // Filter rules by dimension
    const filteredRules = useMemo(() => {
        if (selectedDimension === 'All') return rules;
        return rules.filter(r => r.qualityDimension === selectedDimension);
    }, [rules, selectedDimension]);

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatLoading) return;

        const query = chatInput.trim();
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', text: query }]);
        setIsChatLoading(true);

        try {
            const response = await onAskAI(query);
            setChatHistory(prev => [...prev, { role: 'ai', text: response }]);
        } catch (e) {
            setChatHistory(prev => [...prev, {
                role: 'ai',
                text: 'Sorry, I encountered an error processing your request.'
            }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'error': return 'bg-rose-500';
            case 'warning': return 'bg-amber-500';
            case 'info': return 'bg-blue-500';
            default: return 'bg-slate-500';
        }
    };

    const getSeverityBg = (severity: string) => {
        switch (severity) {
            case 'error': return 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800';
            case 'warning': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
            case 'info': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
            default: return 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
        }
    };

    const getDimensionColor = (dim: string) => {
        switch (dim) {
            case 'Completeness': return 'text-blue-600 bg-blue-100';
            case 'Accuracy': return 'text-emerald-600 bg-emerald-100';
            case 'Consistency': return 'text-indigo-600 bg-indigo-100';
            case 'Validity': return 'text-amber-600 bg-amber-100';
            case 'Uniqueness': return 'text-rose-600 bg-rose-100';
            default: return 'text-slate-600 bg-slate-100';
        }
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                        AI Cleaning Panel
                    </h3>
                </div>

                {isProcessing && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                        <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        <span className="text-xs font-bold text-indigo-600">
                            {processingStatus || 'Processing...'}
                        </span>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-2 gap-1 bg-slate-50/50 dark:bg-slate-950/50">
                {[
                    { id: 'issues', label: 'Issues', icon: '⚠️', count: issues.length },
                    { id: 'rules', label: 'Rules', icon: '⚒️', count: rules.length },
                    { id: 'history', label: 'History', icon: '📜', count: changeHistory.length },
                    { id: 'chat', label: 'Chat', icon: '💬' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as PanelTab)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-[10px] font-bold uppercase tracking-wider transition-all relative ${activeTab === tab.id
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <span>{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-black ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}>
                                {tab.count > 99 ? '99+' : tab.count}
                            </span>
                        )}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Issues Tab */}
                {activeTab === 'issues' && (
                    <div className="space-y-4">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3 text-center">
                                <div className="text-2xl font-black text-rose-600">{groupedIssues.errors.length}</div>
                                <div className="text-[9px] font-bold uppercase text-rose-500">Errors</div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
                                <div className="text-2xl font-black text-amber-600">{groupedIssues.warnings.length}</div>
                                <div className="text-[9px] font-bold uppercase text-amber-500">Warnings</div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                                <div className="text-2xl font-black text-blue-600">{groupedIssues.infos.length}</div>
                                <div className="text-[9px] font-bold uppercase text-blue-500">Info</div>
                            </div>
                        </div>

                        {/* Auto-Fix All Button */}
                        {issues.length > 0 && (
                            <button
                                onClick={onApplyAllFixes}
                                disabled={isProcessing}
                                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ⚡ Auto-Fix All ({issues.length} issues)
                            </button>
                        )}

                        {/* Issue List */}
                        {issues.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <div className="text-5xl mb-4">✨</div>
                                <p className="font-bold">No issues detected!</p>
                                <p className="text-sm">Your data looks clean.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {issues.map((issue, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-4 rounded-xl border ${getSeverityBg(issue.severity)} transition-all hover:scale-[1.01]`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${getSeverityColor(issue.severity)}`} />
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    Row {issue.row + 1}, {issue.columnName}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-semibold text-slate-400 uppercase">
                                                {Math.round(issue.confidence * 100)}% confident
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                                            {issue.explanation}
                                        </p>

                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-[10px] text-slate-500">
                                                <span className="font-bold">"{String(issue.currentValue || 'empty')}"</span>
                                                <span className="mx-1">→</span>
                                                <span className="font-bold text-emerald-600">"{String(issue.suggestedValue || 'remove')}"</span>
                                            </div>
                                            <button
                                                onClick={() => onApplyFix(issue)}
                                                disabled={isProcessing}
                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-500 transition-all disabled:opacity-50"
                                            >
                                                Fix
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Rules Tab */}
                {activeTab === 'rules' && (
                    <div className="space-y-4">
                        {/* Dimension Filter */}
                        <div className="flex flex-wrap gap-1">
                            {['All', 'Completeness', 'Accuracy', 'Consistency', 'Validity', 'Uniqueness'].map(dim => (
                                <button
                                    key={dim}
                                    onClick={() => setSelectedDimension(dim as any)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${selectedDimension === dim
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                                        }`}
                                >
                                    {dim}
                                </button>
                            ))}
                        </div>

                        {/* Rules List */}
                        {filteredRules.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <div className="text-5xl mb-4">⚒️</div>
                                <p className="font-bold">No rules generated</p>
                                <p className="text-sm">AI will create rules on first scan.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredRules.map((rule) => (
                                    <div
                                        key={rule.id}
                                        className={`p-4 rounded-xl border transition-all ${rule.active
                                            ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                            : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getDimensionColor(rule.qualityDimension || 'Validity')}`}>
                                                {rule.qualityDimension || 'Validity'}
                                            </span>
                                            <button
                                                onClick={() => onRuleToggle(rule.id)}
                                                className={`w-10 h-5 rounded-full transition-all ${rule.active ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full mt-0.5 ml-0.5 transition-transform ${rule.active ? 'translate-x-5' : ''}`} />
                                            </button>
                                        </div>

                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                                            {rule.description || 'Unnamed Rule'}
                                        </h4>

                                        <div className="text-[10px] text-slate-500 space-y-1">
                                            <div>Target: <span className="font-bold">{rule.column}</span></div>
                                            <div className="font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-indigo-500 overflow-x-auto">
                                                {rule.expression}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="space-y-3">
                        {changeHistory.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <div className="text-5xl mb-4">📜</div>
                                <p className="font-bold">No changes yet</p>
                                <p className="text-sm">Changes will appear here.</p>
                            </div>
                        ) : (
                            changeHistory.slice().reverse().map((entry) => (
                                <div
                                    key={entry.id}
                                    className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${entry.actor === 'ai' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                                                }`}>
                                                {entry.actor === 'ai' ? '🤖 AI' : '👤 You'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(entry.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        {entry.canUndo && (
                                            <button
                                                onClick={() => onUndo(entry.id)}
                                                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[9px] font-bold uppercase hover:bg-slate-200 transition-all"
                                            >
                                                Undo
                                            </button>
                                        )}
                                    </div>

                                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                        {entry.explanation}
                                    </p>

                                    <div className="text-[10px] text-slate-500 font-mono bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded">
                                        Row {entry.row + 1}, {entry.column}: "{String(entry.oldValue || 'empty')}" → "{String(entry.newValue || 'empty')}"
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Chat Tab */}
                {activeTab === 'chat' && (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                            {chatHistory.length === 0 && (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-3">💬</div>
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                        Ask me anything about your data!
                                    </p>
                                    <div className="space-y-2">
                                        {[
                                            'What issues are most critical?',
                                            'How can I improve data quality?',
                                            'Explain the cleaning rules',
                                        ].map((suggestion, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setChatInput(suggestion)}
                                                className="block w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all text-left"
                                            >
                                                "{suggestion}"
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {chatHistory.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}

                            {isChatLoading && (
                                <div className="flex justify-start">
                                    <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleChatSubmit} className="relative">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Ask AI about your data..."
                                className="w-full px-4 py-3 pr-12 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            />
                            <button
                                type="submit"
                                disabled={isChatLoading || !chatInput.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-indigo-500 transition-all"
                            >
                                →
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AICleaningPanel;
