import React, { useState, useEffect } from 'react';
import { Dataset, AnalysisInsight, CleaningAction, DataRow } from '../types';
import { GeminiService } from '../services/geminiService';
import { GroqService } from '../services/groqService';
import api from '../services/api';
import CleaningChat from './components/Cleaning/CleaningChat';

interface CleanViewProps {
    dataset: Dataset;
    onUpdate: (updated: Dataset) => void;
    onAIAction?: () => void;
}

const CleanView: React.FC<CleanViewProps> = ({ dataset, onUpdate, onAIAction }) => {
    const [loading, setLoading] = useState(true);
    const [pendingActions, setPendingActions] = useState<CleaningAction[]>([]);
    const [insights, setInsights] = useState<AnalysisInsight[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [previewData, setPreviewData] = useState<DataRow[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<string>('');
    const [proAnalysis, setProAnalysis] = useState<any>(null);

    // Batch selection
    const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());

    // ... (previous useEffect kept)

    const handleProAnalysis = async () => {
        setIsProcessing(true);
        setProcessingStatus('Running Deep Pro AI Analysis...');
        try {
            const workspaceId = dataset.workspace_id || 'default';
            const response = await api.cleaning.analyzePro(workspaceId, dataset.id);
            const data = response.data;

            setProAnalysis(data);

            // Convert Pro Rules to CleaningActions
            const newActions: CleaningAction[] = data.rules.map((rule: any, i: number) => ({
                id: `pro_rule_${i}`,
                title: rule.description,
                description: rule.reasoning,
                type: rule.category === 'Recovery' ? 'missing_values' : 'other',
                impactedRows: 0, // Will be calculated on apply
                status: 'pending',
                severity: rule.severity,
                applyFunction: rule.healFunction,
                rawRule: rule // Store for backend application
            }));

            setPendingActions(prev => [...newActions, ...prev]);

            // Convert Semantic Insights to AnalysisInsights
            const newInsights: AnalysisInsight[] = data.insights.semanticInsights.map((insight: string, i: number) => ({
                title: `AI Observation ${i + 1}`,
                description: insight,
                importance: 'high'
            }));

            setInsights(prev => [...newInsights, ...prev]);

            alert(`Pro Analysis Complete! Found ${data.rules.length} advanced rules and ${data.insights.semanticInsights.length} semantic insights.`);
        } catch (e) {
            console.error("Pro Analysis failed", e);
            alert("Failed to run Pro Analysis. Using standard audit as fallback.");
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const handleApplySuggestedFix = async (action: CleaningAction) => {
        if (!action.rawRule) {
            return executeCleaning([action]);
        }

        setIsProcessing(true);
        setProcessingStatus(`Applying Professional Fix: ${action.title}...`);
        try {
            const workspaceId = dataset.workspace_id || 'default';
            const res = await api.cleaning.applyFix(workspaceId, dataset.id, action.rawRule);

            // Update local preview with the sample returned from backend
            // Note: For a real app, we might want to re-fetch or use full data if small
            if (res.data.newData) {
                setPreviewData(res.data.newData);
            }

            alert(`Successfully applied fix! ${res.data.rowsAffected} rows were improved.`);

            action.status = 'applied';
            setHasChanges(true);
        } catch (e) {
            console.error("Apply pro fix failed", e);
            alert("Failed to apply pro fix.");
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    // Initialize view from dataset state (Cache Hit)
    useEffect(() => {
        setPreviewData(dataset.data);

        // CACHE LOGIC: Check if we already have suggestions in the dataset
        if (dataset.cleaningSuggestions && dataset.cleaningSuggestions.length > 0) {
            setPendingActions(dataset.cleaningSuggestions);
            setInsights(dataset.analysisInsights || []);
            setLoading(false);
            return;
        }

        // Only fetch if no cache and no actions pending
        const runAudit = async () => {
            setLoading(true);
            try {
                if (onAIAction) onAIAction();
                const auditRes = await GeminiService.auditDataset(dataset);

                // Use explicit casting to satisfy strict type checking on literal unions
                setPendingActions(auditRes.actions as CleaningAction[]);
                setInsights(auditRes.insights as AnalysisInsight[]);

                // PERSIST CACHE: Save results back to parent dataset immediately
                onUpdate({
                    ...dataset,
                    cleaningSuggestions: auditRes.actions as CleaningAction[],
                    analysisInsights: auditRes.insights as AnalysisInsight[]
                });
            } catch (e) {
                console.error("Audit failed", e);
            } finally {
                setLoading(false);
            }
        };
        runAudit();
    }, [dataset.name]);

    const handleCommit = () => {
        const appliedActions = pendingActions.filter(a => a.status === 'applied');

        // HISTORY LOGIC: Push current state before committing new state
        const historyEntry = {
            timestamp: new Date(),
            description: `Applied ${appliedActions.length} cleaning actions: ${appliedActions.map(a => a.title).join(', ')}`,
            dataSnapshot: dataset.data // Save PREVIOUS data
        };

        const newHistoryStack = [...(dataset.historyStack || []), historyEntry].slice(-5); // Keep last 5

        // Clear the cache for downstream items because data changed
        onUpdate({
            ...dataset,
            data: previewData,
            lastCleaned: new Date(),
            cleaningHistory: [...(dataset.cleaningHistory || []), ...appliedActions],
            historyStack: newHistoryStack,
            // IMPORTANT: Invalidate caches that depend on data values
            kpis: undefined,
            customCharts: undefined,
            generatedReport: undefined,
            // Keep current suggestions but remove applied ones
            cleaningSuggestions: pendingActions.filter(a => a.status !== 'applied')
        });

        setHasChanges(false);
        setPendingActions(prev => prev.filter(a => a.status !== 'applied'));
        setSelectedActionIds(new Set());
    };

    const handleUndo = () => {
        if (!dataset.historyStack || dataset.historyStack.length === 0) return;

        const lastStep = dataset.historyStack[dataset.historyStack.length - 1];
        const newStack = dataset.historyStack.slice(0, -1);

        onUpdate({
            ...dataset,
            data: lastStep.dataSnapshot,
            historyStack: newStack,
            kpis: undefined, // Invalidate derived data
            customCharts: undefined,
            generatedReport: undefined
        });

        // Reset local preview to reverted data
        setPreviewData(lastStep.dataSnapshot);
        alert(`Undid: ${lastStep.description}`);
    };

    const executeCleaning = async (actionsToApply: CleaningAction[]) => {
        setIsProcessing(true);
        let currentData = [...previewData]; // Work on copy

        try {
            if (onAIAction) onAIAction();

            for (const action of actionsToApply) {
                setProcessingStatus(`Generating code for: ${action.title}...`);

                let code = action.applyFunction;
                if (!code) {
                    // Calling generateCleaningCode from GroqService
                    code = await GroqService.generateCleaningCode({ ...dataset, data: currentData }, action);
                    action.applyFunction = code; // Cache the code
                }

                console.log(`Executing Cleaning Code for ${action.title}:`, code);
                setProcessingStatus(`Applying: ${action.title} to ${currentData.length.toLocaleString()} rows...`);

                const cleanFn = new Function('row', code);

                let errors = 0;
                currentData = currentData.map(row => {
                    try {
                        const rowCopy = { ...row };
                        const result = cleanFn(rowCopy);
                        return result || rowCopy;
                    } catch (err) {
                        errors++;
                        return row;
                    }
                });

                if (errors > 0) console.warn(`Action completed with ${errors} row errors.`);

                // Mark as applied locally
                action.status = 'applied';
                action.timestamp = new Date();
            }

            setPreviewData(currentData);
            setPendingActions(prev => prev.map(a => {
                const applied = actionsToApply.find(applied => applied.id === a.id);
                return applied ? { ...applied, status: 'applied' } : a;
            }));
            setHasChanges(true);

        } catch (e) {
            console.error("Cleaning failed", e);
            alert("Failed to apply cleaning action. Please try again.");
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const handleApplySingle = (action: CleaningAction) => {
        if (action.id.startsWith('pro_rule_')) {
            handleApplySuggestedFix(action);
        } else {
            executeCleaning([action]);
        }
    };

    const handleApplyBatch = () => {
        const actions = pendingActions.filter(a => selectedActionIds.has(a.id));
        if (actions.length === 0) return;
        executeCleaning(actions);
    };

    const toggleActionSelection = (id: string) => {
        const newSet = new Set(selectedActionIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedActionIds(newSet);
    };

    const handleExport = () => {
        const headers = dataset.headers.join(',');
        const rows = previewData.map(row => dataset.headers.map(h => {
            const val = row[h];
            return val === null || val === undefined ? '' : `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')).join('\n');
        const csvContent = `${headers}\n${rows}`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${dataset.name.replace(/\s+/g, '_')}_cleaned.csv`;
        link.click();
    };

    const isCellChanged = (rowIndex: number, col: string) => {
        if (!hasChanges) return false;
        // Compare against the last committed state (dataset.data)
        if (dataset.data[rowIndex] && dataset.data[rowIndex][col] !== previewData[rowIndex][col]) {
            return true;
        }
        return false;
    };

    return (
        <div className="h-full flex flex-col gap-6 max-w-7xl mx-auto pb-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Data Refinery</h2>
                        {hasChanges && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold uppercase rounded-full animate-pulse">
                                Unsaved Changes
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {hasChanges ? 'Review changes below before committing.' : 'Select actions to improve data quality.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {dataset.historyStack && dataset.historyStack.length > 0 && !hasChanges && (
                        <button
                            onClick={handleUndo}
                            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                            title="Undo last commit"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                            Undo
                        </button>
                    )}
                    <button
                        onClick={handleExport}
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4h14" /></svg>
                        Export CSV
                    </button>

                    <button
                        onClick={handleProAnalysis}
                        disabled={isProcessing}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 transition-all flex items-center gap-2 group"
                    >
                        <div className="relative">
                            <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                        </div>
                        Pro AI Analysis
                    </button>

                    {hasChanges && (
                        <button
                            onClick={handleCommit}
                            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 transition-all flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Commit Fixes
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-6 overflow-hidden min-h-0">

                {/* Split View: Actions & Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">

                    {/* Left Column: Actions & Insights */}
                    <div className="flex flex-col gap-6 overflow-hidden h-full min-h-0">
                        {/* Actions Panel */}
                        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                    Recommended Actions
                                </h3>
                                {selectedActionIds.size > 0 && (
                                    <button
                                        onClick={handleApplyBatch}
                                        disabled={isProcessing}
                                        className="text-[10px] font-bold bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-500 transition-colors shadow-sm"
                                    >
                                        Apply Selected ({selectedActionIds.size})
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                                {loading ? (
                                    [1, 2, 3].map(i => (
                                        <div key={i} className="h-24 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                    ))
                                ) : pendingActions.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 mb-3">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">All Clean!</p>
                                        <p className="text-xs text-slate-500">No issues found in this sample.</p>
                                    </div>
                                ) : (
                                    pendingActions.map(action => (
                                        <div
                                            key={action.id}
                                            className={`relative p-4 rounded-xl border transition-all ${action.status === 'applied'
                                                ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 opacity-75'
                                                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-3">
                                                    {action.status !== 'applied' && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedActionIds.has(action.id)}
                                                            onChange={() => toggleActionSelection(action.id)}
                                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                    )}
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${action.type === 'missing_values' ? 'bg-amber-100 text-amber-700' :
                                                        action.type === 'outliers' ? 'bg-rose-100 text-rose-700' :
                                                            'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {action.type.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                {action.status === 'applied' ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        Applied
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleApplySingle(action)}
                                                        disabled={isProcessing}
                                                        className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                                    >
                                                        Apply
                                                    </button>
                                                )}
                                            </div>

                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{action.title}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">{action.description}</p>

                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                                                Impact: {action.impactedRows} rows
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Insights Panel */}
                        <div className="h-1/3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    AI Semantic Insights
                                </h3>
                                {proAnalysis && (
                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 text-[9px] font-bold rounded-full uppercase">
                                        {proAnalysis.meta.datasetCategory}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                                {proAnalysis && (
                                    <div className="mb-4 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Dataset Purpose</p>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">"{proAnalysis.meta.datasetPurpose}"</p>
                                    </div>
                                )}
                                {insights.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-4 italic">No insights generated yet.</p>
                                ) : (
                                    insights.map((ins, i) => (
                                        <div key={i} className="flex gap-3 items-start group">
                                            <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${ins.importance === 'high' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{ins.title}</p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{ins.description}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Live Data Preview */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col shadow-sm overflow-hidden h-full">
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center backdrop-blur-sm sticky top-0 z-20">
                        <div className="flex items-center gap-2">
                            <div className="px-2 py-1 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasChanges ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${hasChanges ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                </span>
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                    {hasChanges ? 'Modified Preview' : 'Current Data'}
                                </span>
                            </div>
                            {hasChanges && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium animate-in fade-in">
                                    &bull; Changes highlighted below
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                            Showing {Math.min(100, previewData.length)} of {previewData.length} rows
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-slate-950 relative">
                        <table className="w-full text-left text-sm border-separate border-spacing-0">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-12 text-center shadow-sm">#</th>
                                    {dataset.headers.map(h => (
                                        <th key={h} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap min-w-[120px] shadow-sm">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {previewData.slice(0, 100).map((row, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                        <td className="px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-400 text-center sticky left-0 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors">
                                            {idx + 1}
                                        </td>
                                        {dataset.headers.map(h => {
                                            const changed = isCellChanged(idx, h);
                                            return (
                                                <td
                                                    key={h}
                                                    className={`px-4 py-2 text-xs truncate max-w-[200px] border-r border-transparent transition-colors ${changed
                                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200 font-medium border-l border-amber-200 dark:border-amber-800'
                                                        : 'text-slate-600 dark:text-slate-400'
                                                        }`}
                                                >
                                                    {row[h] === null || row[h] === undefined || row[h] === '' ? (
                                                        <span className="text-slate-300 italic text-[10px]">null</span>
                                                    ) : (
                                                        String(row[h])
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isProcessing && (
                <div className="absolute bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in">
                    <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 border border-slate-700 dark:border-slate-200">
                        <div className="relative w-5 h-5">
                            <div className="absolute inset-0 border-2 border-slate-500/30 rounded-full"></div>
                            <div className="absolute inset-0 border-2 border-t-indigo-500 rounded-full animate-spin"></div>
                        </div>
                        <div>
                            <p className="text-sm font-bold">Processing Dataset...</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">{processingStatus || "Running local execution"}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CleanView;
