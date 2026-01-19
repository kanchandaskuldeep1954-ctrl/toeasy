import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Dataset, ValidationRule, DataRow } from '../../../types';
import { useDataset } from '../../hooks/useDataset';
import { apiClient } from '../../services/apiClient';
import { GroqService } from '../../services/groqService';
import AICleaningPanel from './AICleaningPanel';
const FortuneSheetEditor = React.lazy(() => import('../FortuneSheet/FortuneSheetEditor'));
import { CellIssue } from '../../../types';
import ExportModal from '../ExportHub/ExportModal';
import {
    analyzeDatasetSemantics,
    generateRecoveryPlans,
    recoveryPlansToCellIssues,
    applyRecoveryPlan,
    DatasetSemantics,
    RecoveryPlan,
    ChangeHistoryEntry,
} from '../../services/univerService';

const UniverCleanView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace');
    const datasetId = searchParams.get('dataset');

    const { activeDataset: dataset, updateDataset, setActiveDataset } = useDataset();

    // State
    const [activeTab, setActiveTab] = useState<'workspace' | 'original' | 'vault'>('workspace');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [semantics, setSemantics] = useState<DatasetSemantics | null>(null);
    const [issues, setIssues] = useState<CellIssue[]>([]);
    const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
    const [changeHistory, setChangeHistory] = useState<ChangeHistoryEntry[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [isCleaningLive, setIsCleaningLive] = useState(false);
    const [cleaningProgress, setCleaningProgress] = useState(0);

    // Refs
    const hasHydratedRef = useRef<string | null>(null);
    const initializedRef = useRef<number | null>(null);
    const univerEditorRef = useRef<any>(null);

    // Hydrate dataset
    useEffect(() => {
        const hydrateOnce = async () => {
            const hydrateKey = `${workspaceId}-${datasetId}`;
            if (hasHydratedRef.current === hydrateKey) return;
            if (!workspaceId || !datasetId || workspaceId === 'null' || datasetId === 'null') return;

            hasHydratedRef.current = hydrateKey;
            setIsLoading(true);
            setLoadingStep('Loading dataset...');

            try {
                const res = await apiClient.get(`/workspaces/${workspaceId}/datasets/${datasetId}`);
                const fullData = res.data;

                const hydrated = {
                    ...fullData,
                    data: fullData.raw_data || [],
                    raw_data: fullData.raw_data || [],
                    headers: fullData.raw_data?.[0] ? Object.keys(fullData.raw_data[0]) : [],
                };

                setActiveDataset(hydrated);
            } catch (e) {
                console.error('Hydration failed:', e);
            } finally {
                setIsLoading(false);
            }
        };

        hydrateOnce();
    }, [datasetId, workspaceId, setActiveDataset]);

    // Initialize AI analysis when dataset loads
    useEffect(() => {
        const init = async () => {
            if (!dataset || initializedRef.current === dataset.id) return;
            if (!dataset.data || dataset.data.length === 0) return;

            initializedRef.current = dataset.id!;
            setIsLoading(true);

            try {
                // Step 1: Semantic Analysis
                setLoadingStep('🔍 Deep Semantic Analysis...');
                const semanticResult = await analyzeDatasetSemantics(dataset);
                setSemantics(semanticResult);

                // Step 2: Generate Recovery Plans
                setLoadingStep('🧠 Generating Recovery Plans...');
                const plans = generateRecoveryPlans(dataset.data, dataset.headers, semanticResult);
                const cellIssues = recoveryPlansToCellIssues(plans, dataset.headers);
                setIssues(cellIssues);

                // Step 3: Generate Validation Rules (using existing GroqService)
                setLoadingStep('⚒️ Creating Validation Rules...');
                if (!dataset.validationRules || dataset.validationRules.length === 0) {
                    const rules = await GroqService.suggestValidationRules(dataset, semanticResult);
                    setValidationRules(rules);
                    updateDataset(dataset.id!, { validationRules: rules });
                } else {
                    setValidationRules(dataset.validationRules);
                }

                setLoadingStep('');
            } catch (e) {
                console.error('Initialization failed:', e);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [dataset?.id]);

    // Display headers (exclude metadata)
    const displayHeaders = useMemo(() => {
        return dataset?.headers?.filter(h => h !== '__metadata') || [];
    }, [dataset?.headers]);

    // Handle applying a single fix
    const handleApplyFix = useCallback(async (issue: CellIssue) => {
        if (!dataset) return;

        setIsProcessing(true);
        setProcessingStatus('Applying fix...');

        try {
            const plan: RecoveryPlan = {
                row: issue.row,
                column: issue.columnName,
                currentValue: issue.currentValue,
                suggestedValue: issue.suggestedValue,
                strategy: issue.recoveryMethod as any || 'ai_infer',
                confidence: issue.confidence,
                explanation: issue.explanation,
                dataLossRisk: issue.severity === 'error' ? 'medium' : 'low',
            };

            const { data: newData, historyEntry } = applyRecoveryPlan(dataset.data, plan);

            // Animate the cell fix
            if (univerEditorRef.current?.animateCellFix) {
                await univerEditorRef.current.animateCellFix(
                    issue.row,
                    issue.col,
                    issue.currentValue,
                    issue.suggestedValue,
                    issue.explanation
                );
            }

            // Update state
            setChangeHistory(prev => [...prev, historyEntry]);
            setIssues(prev => prev.filter(i => !(i.row === issue.row && i.col === issue.col)));
            updateDataset(dataset.id!, { data: newData });
        } catch (e) {
            console.error('Failed to apply fix:', e);
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    }, [dataset, updateDataset]);

    // Handle applying all fixes with live animation
    const handleApplyAllFixes = useCallback(async () => {
        if (!dataset || issues.length === 0) return;

        setIsCleaningLive(true);
        setProcessingStatus('🧹 Starting live cleaning...');
        setCleaningProgress(0);

        try {
            let currentData = [...dataset.data];
            const newHistory: ChangeHistoryEntry[] = [];
            const totalIssues = issues.length;

            for (let i = 0; i < issues.length; i++) {
                const issue = issues[i];
                setProcessingStatus(`Fixing ${i + 1}/${totalIssues}: Row ${issue.row + 1}, ${issue.columnName}`);
                setCleaningProgress(Math.round(((i + 1) / totalIssues) * 100));

                const plan: RecoveryPlan = {
                    row: issue.row,
                    column: issue.columnName,
                    currentValue: issue.currentValue,
                    suggestedValue: issue.suggestedValue,
                    strategy: issue.recoveryMethod as any || 'ai_infer',
                    confidence: issue.confidence,
                    explanation: issue.explanation,
                    dataLossRisk: issue.severity === 'error' ? 'medium' : 'low',
                };

                const { data: newData, historyEntry } = applyRecoveryPlan(currentData, plan);
                currentData = newData;
                newHistory.push(historyEntry);

                // Animate each cell (with small delay for visual effect)
                if (univerEditorRef.current?.animateCellFix) {
                    await univerEditorRef.current.animateCellFix(
                        issue.row,
                        issue.col,
                        issue.currentValue,
                        issue.suggestedValue,
                        issue.explanation
                    );
                }

                // Small delay between fixes for visual effect
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Update all state
            setChangeHistory(prev => [...prev, ...newHistory]);
            setIssues([]);
            updateDataset(dataset.id!, { data: currentData });

            setProcessingStatus('✅ Cleaning complete!');
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
            console.error('Failed to apply all fixes:', e);
            setProcessingStatus('❌ Error during cleaning');
        } finally {
            setIsCleaningLive(false);
            setProcessingStatus('');
            setCleaningProgress(0);
        }
    }, [dataset, issues, updateDataset]);

    // Handle undo
    const handleUndo = useCallback((historyId: string) => {
        if (!dataset) return;

        const entry = changeHistory.find(h => h.id === historyId);
        if (!entry || !entry.canUndo) return;

        const newData = [...dataset.data];
        const row = { ...newData[entry.row] };
        row[entry.column] = entry.oldValue;

        // Remove from recovered fields
        if (row.__metadata?.recoveredFields) {
            row.__metadata.recoveredFields = row.__metadata.recoveredFields.filter(
                (f: string) => f !== entry.column
            );
        }

        newData[entry.row] = row;

        // Add undo entry to history
        const undoEntry: ChangeHistoryEntry = {
            id: `undo-${historyId}`,
            timestamp: new Date(),
            action: 'undo',
            actor: 'user',
            row: entry.row,
            column: entry.column,
            oldValue: entry.newValue,
            newValue: entry.oldValue,
            explanation: `Undid: ${entry.explanation}`,
            canUndo: false,
        };

        setChangeHistory(prev => [
            ...prev.map(h => h.id === historyId ? { ...h, canUndo: false } : h),
            undoEntry,
        ]);
        updateDataset(dataset.id!, { data: newData });

        // Re-add issue
        const issue: CellIssue = {
            row: entry.row,
            col: displayHeaders.indexOf(entry.column),
            columnName: entry.column,
            currentValue: entry.oldValue,
            issueType: 'missing',
            severity: 'warning',
            suggestedValue: entry.newValue,
            confidence: 0.8,
            explanation: 'Previously fixed, now undone',
        };
        setIssues(prev => [...prev, issue]);
    }, [dataset, changeHistory, displayHeaders, updateDataset]);

    // Handle rule toggle
    const handleRuleToggle = useCallback((ruleId: string) => {
        if (!dataset) return;

        const updatedRules = validationRules.map(r =>
            r.id === ruleId ? { ...r, active: !r.active } : r
        );
        setValidationRules(updatedRules);
        updateDataset(dataset.id!, { validationRules: updatedRules });
    }, [dataset, validationRules, updateDataset]);

    // Handle AI chat
    const handleAskAI = useCallback(async (query: string): Promise<string> => {
        if (!dataset) return 'No dataset loaded.';

        try {
            const response = await GroqService.consultVerifiedAgent(
                dataset,
                query,
                { semantics, issues, rules: validationRules },
                []
            );
            return response;
        } catch (e) {
            return 'Sorry, I encountered an error. Please try again.';
        }
    }, [dataset, semantics, issues, validationRules]);

    // Confirm cleaning
    const confirmCleaning = async () => {
        if (!dataset) return;
        setIsConfirming(true);

        try {
            await apiClient.put(
                `/workspaces/${dataset.workspace_id || workspaceId}/datasets/${dataset.id}/cleaned`,
                {
                    cleanedData: dataset.data,
                    quarantinedData: dataset.quarantinedData || [],
                    healthScore: dataset.healthScore || 100,
                }
            );
            await apiClient.post(
                `/workspaces/${dataset.workspace_id || workspaceId}/datasets/${dataset.id}/confirm-clean`,
                { keepQuarantined: true }
            );
            alert('✅ Cleaning confirmed and saved!');
            setShowConfirmDialog(false);
        } catch (e: any) {
            console.error('Save error:', e);
            alert(`Failed to save: ${e.message || 'Unknown error'}`);
        } finally {
            setIsConfirming(false);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in">
                <div className="relative">
                    <div className="w-24 h-24 border-[6px] border-indigo-100 dark:border-indigo-900 rounded-full" />
                    <div className="absolute inset-0 border-[6px] border-t-indigo-600 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-3xl">📊</div>
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-widest text-indigo-600">
                        AI Analysis
                    </h3>
                    <p className="text-sm font-medium text-slate-400">{loadingStep || 'Initializing...'}</p>
                </div>
            </div>
        );
    }

    // No dataset state
    if (!dataset) {
        return (
            <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">
                No Dataset Selected
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 w-full max-w-[1900px] mx-auto overflow-hidden p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-slate-200 dark:border-slate-800 shrink-0">
                {/* Tabs */}
                <div className="flex gap-2">
                    {[
                        { id: 'workspace', label: '📊 Live Workspace', icon: '📊' },
                        { id: 'original', label: '📄 Original', icon: '📄' },
                        { id: 'vault', label: '🛡️ Vault', icon: '🛡️', count: (dataset.quarantinedData || []).length },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                                }`}
                        >
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Stats & Actions */}
                <div className="flex items-center gap-4">
                    {/* Semantic Context */}
                    {semantics && (
                        <div className="hidden lg:flex px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                            <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">
                                🎯 {semantics.businessContext}
                            </p>
                        </div>
                    )}

                    {/* Quality Score */}
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <p className="text-[9px] font-black uppercase text-slate-400">Quality</p>
                            <p className={`text-sm font-black ${(semantics?.qualityScore || 0) > 90 ? 'text-emerald-500' : 'text-amber-500'
                                }`}>
                                {semantics?.qualityScore || dataset.healthScore || 0}%
                            </p>
                        </div>
                        <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${(semantics?.qualityScore || 0) > 90 ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                style={{ width: `${semantics?.qualityScore || dataset.healthScore || 0}%` }}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                        >
                            📤 Export
                        </button>
                        <button
                            onClick={() => setShowConfirmDialog(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-500 transition-all"
                        >
                            ✓ Confirm & Save
                        </button>
                    </div>
                </div>
            </div>

            {/* Live Cleaning Progress */}
            {isCleaningLive && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-4 shadow-lg animate-in slide-in-from-top">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            <div>
                                <p className="text-white font-bold text-sm">{processingStatus}</p>
                                <p className="text-white/70 text-xs">Watch your data being cleaned in real-time!</p>
                            </div>
                        </div>
                        <div className="text-white font-black text-2xl">{cleaningProgress}%</div>
                    </div>
                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-white transition-all duration-300"
                            style={{ width: `${cleaningProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                {/* Workspace Tab */}
                {activeTab === 'workspace' && (
                    <>
                        {/* Univer Spreadsheet */}
                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                            <React.Suspense fallback={
                                <div className="flex items-center justify-center h-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            }>
                                <FortuneSheetEditor
                                    ref={univerEditorRef}
                                    data={dataset?.raw_data || []}
                                    headers={dataset?.raw_data?.[0] ? Object.keys(dataset.raw_data[0]) : []}
                                    issues={issues}
                                    onCellEdit={(row, col, oldVal, newVal) => {
                                        const header = displayHeaders[col];
                                        const entry: ChangeHistoryEntry = {
                                            id: `edit-${Date.now()}`,
                                            timestamp: new Date(),
                                            action: 'edit',
                                            actor: 'user',
                                            row,
                                            column: header,
                                            oldValue: oldVal,
                                            newValue: newVal,
                                            explanation: `Manual edit: "${oldVal}" → "${newVal}"`,
                                            canUndo: true,
                                        };
                                        setChangeHistory(prev => [...prev, entry]);
                                    }}
                                />
                            </React.Suspense>
                        </div>

                        {/* AI Panel Sidebar */}
                        <div className="w-[380px] shrink-0 hidden lg:block">
                            <AICleaningPanel
                                issues={issues}
                                rules={validationRules}
                                changeHistory={changeHistory}
                                onApplyFix={handleApplyFix}
                                onApplyAllFixes={handleApplyAllFixes}
                                onUndo={handleUndo}
                                onRuleToggle={handleRuleToggle}
                                onAskAI={handleAskAI}
                                isProcessing={isProcessing}
                                processingStatus={processingStatus}
                                headers={displayHeaders}
                            />
                        </div>
                    </>
                )}

                {/* Original Tab */}
                {activeTab === 'original' && (
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                                Original Source Data
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Read-only view of your original uploaded data
                            </p>
                        </div>
                        <div className="overflow-auto h-[calc(100%-80px)]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-400 w-16">#</th>
                                        {displayHeaders.map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {(dataset.raw_data || dataset.data || []).slice(0, 200).map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                                            {displayHeaders.map(h => (
                                                <td key={h} className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                                                    {String(row[h] ?? '')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Vault Tab */}
                {activeTab === 'vault' && (
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-rose-200 dark:border-rose-900">
                        <div className="p-6 border-b border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/10">
                            <h3 className="text-sm font-black uppercase tracking-widest text-rose-600">
                                🛡️ Quarantine Vault
                            </h3>
                            <p className="text-xs text-rose-500 mt-1">
                                Rows that couldn't be recovered and were isolated
                            </p>
                        </div>
                        <div className="overflow-auto h-[calc(100%-80px)] p-6">
                            {(dataset.quarantinedData || []).length === 0 ? (
                                <div className="text-center py-20 text-slate-400">
                                    <div className="text-6xl mb-4">🛡️</div>
                                    <p className="font-bold text-xl">Vault Empty</p>
                                    <p className="text-sm">No rows were quarantined during cleaning.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {(dataset.quarantinedData || []).map((row, i) => (
                                        <div
                                            key={i}
                                            className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800"
                                        >
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {row.__metadata?.validationErrors?.map((err: string, j: number) => (
                                                    <span
                                                        key={j}
                                                        className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded-full"
                                                    >
                                                        {err}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                {displayHeaders.slice(0, 6).map(h => (
                                                    <div key={h}>
                                                        <p className="text-[10px] uppercase text-rose-400 font-bold">{h}</p>
                                                        <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                                                            {row[h] === null || row[h] === '' ? (
                                                                <span className="text-rose-400 italic">NULL</span>
                                                            ) : (
                                                                String(row[h])
                                                            )}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm Dialog */}
            {showConfirmDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4">
                                ✓
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">
                                Confirm Cleaning
                            </h3>
                            <p className="text-sm text-slate-500 mb-6">
                                This will save your cleaned data and replace the original dataset.
                                {changeHistory.length > 0 && (
                                    <span className="block mt-2 font-bold text-indigo-600">
                                        {changeHistory.length} changes will be applied.
                                    </span>
                                )}
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    className="px-6 py-2 text-slate-500 hover:text-slate-700 font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmCleaning}
                                    disabled={isConfirming}
                                    className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 disabled:opacity-50 transition-all flex items-center gap-2"
                                >
                                    {isConfirming ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        '✓ Confirm & Save'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                exportType="dataset"
                data={dataset.data || []}
                filename={dataset.name || 'cleaned-data'}
            />

            {/* Mobile AI Panel Button */}
            <button
                onClick={() => setActiveTab('workspace')}
                className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl animate-bounce"
            >
                🤖
            </button>
        </div>
    );
};

export default UniverCleanView;
