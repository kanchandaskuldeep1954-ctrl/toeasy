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

import { useTheme } from '../../hooks/useTheme';
import { useVersion } from '../../context/VersionContext';
import { VersionBadge } from '../Version/VersionBadge';
import { CommitVersionModal } from '../Version/CommitVersionModal';
import { VersionTimeline } from '../Version/VersionTimeline';
import type { Version } from '../Version/types';

const UniverCleanView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace');
    const datasetId = searchParams.get('dataset');

    const { activeDataset, updateDataset, setActiveDataset } = useDataset();
    const dataset = activeDataset as unknown as Dataset;
    const { theme } = useTheme(); // Get current theme

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
    const [quarantinedData, setQuarantinedData] = useState<DataRow[]>([]);

    // Version Control State
    const {
        versions,
        currentVersion,
        isDirty,
        loadVersions,
        commitVersion: commitVersionToApi,
        selectVersion,
        restoreVersion,
        setDirty,
        setCurrentVersion
    } = useVersion();
    const [showVersionPanel, setShowVersionPanel] = useState(false);
    const [showCommitModal, setShowCommitModal] = useState(false);
    const [isCommittingVersion, setIsCommittingVersion] = useState(false);

    // Refs
    const hasHydratedRef = useRef<string | null>(null);
    const initializedRef = useRef<number | null>(null);
    const univerEditorRef = useRef<any>(null);

    // Hydrate dataset
    useEffect(() => {
        const hydrateOnce = async () => {
            const hydrateKey = `${workspaceId}-${datasetId}`;

            // If we are already hydrated for this exact dataset, skip
            if (hasHydratedRef.current === hydrateKey) return;

            if (!workspaceId || !datasetId || workspaceId === 'null' || datasetId === 'null') return;

            try {
                // If it's the SAME dataset ID, don't reset analysis state unless it's a forced refresh
                if (initializedRef.current === parseInt(datasetId)) {
                    console.log(`[UniverCleanView] Same dataset ${datasetId}, skipping reset.`);
                    setIsLoading(false);
                    return;
                }

                // Reset previous state when switching
                hasHydratedRef.current = hydrateKey;
                setIsLoading(true);
                setLoadingStep('Loading dataset...');
                setSemantics(null); // Reset analysis
                setIssues([]); // Reset issues
                initializedRef.current = null; // Brand new dataset ID, allow one fresh analysis

                console.log(`[UniverCleanView] Hydrating dataset: ${datasetId}`);
                const res = await apiClient.get(`/workspaces/${workspaceId}/datasets/${datasetId}`);
                const fullData = res.data;

                // Robust parsing helper since DB JSON might arrive as strings in some environments
                const safeParse = (val: any) => {
                    if (!val) return null;
                    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                        try { return JSON.parse(val); } catch (e) { return val; }
                    }
                    return val;
                };

                const rawData = (fullData as any).raw_data || [];
                const headers = safeParse((fullData as any).headers) || (rawData[0] ? Object.keys(rawData[0]) : []);
                const summary = safeParse((fullData as any).cleaning_summary);
                const quarantined = safeParse((fullData as any).quarantined_data) || [];

                const hydrated = {
                    ...fullData,
                    workspace_id: workspaceId,
                    data: rawData,
                    raw_data: rawData,
                    headers: headers,
                };

                setActiveDataset(hydrated);
                setQuarantinedData(quarantined);

                // Restore persistent change history
                if (summary?.history) {
                    setChangeHistory(summary.history);
                }

                // Load versions for this dataset
                if (datasetId) {
                    loadVersions(datasetId);
                }

                if (univerEditorRef.current) {
                    // Force update if needed
                }

            } catch (e) {
                console.error('Hydration failed:', e);
                // Reset ref on failure so we can try again
                hasHydratedRef.current = null;
            } finally {
                setIsLoading(false);
            }
        };

        hydrateOnce();
    }, [datasetId, workspaceId, setActiveDataset]);

    // Initialize AI analysis when dataset loads
    useEffect(() => {
        const init = async () => {
            if (!dataset || initializedRef.current === Number(dataset.id)) {
                return;
            }
            if (!dataset || !dataset.data || dataset.data.length === 0) return;

            // If we already have rules and issues, we might not need a re-analyze unless requested
            if (validationRules.length > 0 && issues.length > 0) {
                console.log(`[UniverCleanView] Dataset ${dataset.id} already has rules/issues, skipping automatic re-analysis.`);
                initializedRef.current = Number(dataset.id);
                return;
            }

            // Critical check: don't re-run if we already did THIS dataset on THIS render cycle
            if (initializedRef.current === Number(dataset.id)) return;

            console.log(`[UniverCleanView] Starting AI Analysis for dataset: ${dataset.id}`);
            initializedRef.current = Number(dataset.id);
            setIsLoading(true);

            try {
                // Step 1: Semantic Analysis
                let semanticResult = semantics;
                if (!semanticResult) {
                    setLoadingStep('🔍 Deep Semantic Analysis...');
                    semanticResult = await analyzeDatasetSemantics(dataset);
                    setSemantics(semanticResult);
                }

                // Step 2: Generate Recovery Plans
                if (!issues || issues.length === 0) {
                    setLoadingStep('🧠 Generating Recovery Plans...');
                    const plans = generateRecoveryPlans(dataset.data, dataset.headers, semanticResult);
                    const cellIssues = recoveryPlansToCellIssues(plans, dataset.headers);
                    setIssues(cellIssues);
                }

                // Step 3: Generate Validation Rules
                setLoadingStep('⚒️ Creating Validation Rules...');
                if (!dataset.validationRules || dataset.validationRules.length === 0) {
                    const rules = await GroqService.suggestValidationRules(dataset, semanticResult);
                    setValidationRules(rules);
                    // Only update if it's genuinely missing from the DB
                    updateDataset(Number(dataset.id), { validationRules: rules } as any);
                } else if (!validationRules || validationRules.length === 0) {
                    setValidationRules(dataset.validationRules);
                }

                setLoadingStep('');
            } catch (e) {
                console.error('Initialization failed:', e);
            } finally {
                setIsLoading(false);
            }
        };

        if (dataset?.data?.length > 0) {
            init();
        }
    }, [dataset?.id, dataset?.data?.length]); // Re-run if ID stays same but data arrives

    // Display headers (exclude metadata)
    const displayHeaders = useMemo(() => {
        const baseHeaders = (dataset?.headers && Array.isArray(dataset.headers)) ? dataset.headers : [];
        if (baseHeaders.length > 0) return baseHeaders.filter(h => h !== '__metadata');

        // Fallback: derive from live data
        if (dataset?.data?.[0]) return Object.keys(dataset.data[0]).filter(k => k !== '__metadata');
        return [];
    }, [dataset?.headers, dataset?.data]);

    // Original headers (always derived from raw_data to prevent empty original view)
    const originalHeaders = useMemo(() => {
        const raw = (dataset as any)?.raw_data || [];
        if (raw[0]) return Object.keys(raw[0]).filter(h => h !== '__metadata');
        return [];
    }, [(dataset as any)?.raw_data]);

    // Handle applying a single fix
    const handleApplyFix = useCallback(async (issue: CellIssue) => {
        if (!dataset) return;

        setIsProcessing(true);
        setProcessingStatus('Applying fix...');

        try {
            let newData = [...dataset.data];
            let newHeaders = [...dataset.headers];
            let historyEntry: ChangeHistoryEntry;
            let rowToVault: DataRow | null = null;

            if (issue.recoveryMethod === 'remove_row') {
                // native removal for visual feedback
                if (univerEditorRef.current?.deleteRow) {
                    univerEditorRef.current.deleteRow(issue.row);
                }

                // Structural Removal: Row -> Vaulting
                rowToVault = { ...newData[issue.row] };
                if (!rowToVault.__metadata) rowToVault.__metadata = {};
                (rowToVault.__metadata as any).removalReason = issue.explanation || 'Integrity cleanup: Removed incomplete record';
                (rowToVault.__metadata as any).removedAt = new Date().toISOString();

                setQuarantinedData(prev => [...prev, rowToVault]);

                newData = newData.filter((_, idx) => idx !== issue.row);
                historyEntry = {
                    id: `remove-row-${issue.row}-${Date.now()}`,
                    timestamp: new Date(),
                    action: 'remove_row' as any,
                    actor: 'ai',
                    row: issue.row,
                    column: 'ALL',
                    oldValue: 'record',
                    newValue: 'vaulted',
                    explanation: `Integrity cleanup: Moved record to vault at row ${issue.row + 1}`,
                    canUndo: false
                };
            } else if (issue.recoveryMethod === 'remove_column') {
                // native removal for visual feedback
                if (univerEditorRef.current?.deleteColumn) {
                    univerEditorRef.current.deleteColumn(issue.col);
                }

                // Structural Removal: Column
                newHeaders = newHeaders.filter(h => h !== issue.columnName);
                newData = newData.map(row => {
                    const newRow = { ...row };
                    delete newRow[issue.columnName];
                    return newRow;
                });
                historyEntry = {
                    id: `remove-col-${issue.columnName}-${Date.now()}`,
                    timestamp: new Date(),
                    action: 'remove_column' as any,
                    actor: 'ai',
                    row: -1,
                    column: issue.columnName,
                    oldValue: 'column',
                    newValue: 'deleted',
                    explanation: `Structural cleanup: Deleted garbage column "${issue.columnName}"`,
                    canUndo: false
                };
            } else {
                // Standard Cell-level Fix
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

                const result = applyRecoveryPlan(dataset.data, plan);
                newData = result.data;
                historyEntry = result.historyEntry;

                // Native update for visual feedback
                if (univerEditorRef.current?.setCellValue) {
                    univerEditorRef.current.setCellValue(issue.row, issue.col, issue.suggestedValue);
                }

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
            }

            // Update state
            setChangeHistory(prev => [...prev, historyEntry]);
            setIssues(prev => prev.filter(i => !(i.row === issue.row && i.col === issue.col)));

            const updatedDataset = {
                ...dataset,
                data: newData,
                raw_data: newData, // CRITICAL FIX
                originalData: dataset.originalData || newData,
                headers: newHeaders,
                quarantined_data: (dataset.quarantinedData || []).concat(rowToVault ? [rowToVault] : []),
                quarantinedData: (dataset.quarantinedData || []).concat(rowToVault ? [rowToVault] : [])
            };

            await updateDataset(Number(dataset.id), updatedDataset as any);

            // Force FortuneSheet to re-render with the new data
            if (univerEditorRef.current?.forceUpdate) {
                univerEditorRef.current.forceUpdate(newData, newHeaders);
            }

            // Re-run semantic analysis and refresh issues if structural change occurred
            if (issue.recoveryMethod?.startsWith('remove_')) {
                const newSemantics = await analyzeDatasetSemantics(updatedDataset);
                setSemantics(newSemantics);

                const plans = generateRecoveryPlans(newData, newHeaders, newSemantics);
                const cellIssues = recoveryPlansToCellIssues(plans, newHeaders);
                setIssues(cellIssues);
            }

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

            const rowsToRemove = new Set<number>();
            const columnsToRemove = new Set<string>();

            // 1. Process all issues
            for (let i = 0; i < issues.length; i++) {
                const issue = issues[i];

                if (issue.recoveryMethod === 'remove_row') {
                    rowsToRemove.add(issue.row);
                    setProcessingStatus(`Flagging row ${issue.row + 1} for removal...`);
                } else if (issue.recoveryMethod === 'remove_column') {
                    columnsToRemove.add(issue.columnName);
                    setProcessingStatus(`Flagging column "${issue.columnName}" for removal...`);
                } else {
                    // Cell-level fix
                    setProcessingStatus(`Fixing ${i + 1}/${totalIssues}: Row ${issue.row + 1}, ${issue.columnName}`);

                    // Agentic Scrolling
                    if (univerEditorRef.current?.scrollToCell && !rowsToRemove.has(issue.row)) {
                        univerEditorRef.current.scrollToCell(issue.row, issue.col);
                        // Brief pause to allow the user to see the "Agent" arrive at the cell
                        await new Promise(resolve => setTimeout(resolve, 80));
                    }

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

                    // Real-time Native UI update
                    if (univerEditorRef.current?.setCellValue && !rowsToRemove.has(issue.row)) {
                        univerEditorRef.current.setCellValue(issue.row, issue.col, issue.suggestedValue);
                    }

                    // Animate each cell (if applicable and not removed)
                    if (univerEditorRef.current?.animateCellFix && !rowsToRemove.has(issue.row)) {
                        await univerEditorRef.current.animateCellFix(
                            issue.row,
                            issue.col,
                            issue.currentValue,
                            issue.suggestedValue,
                            issue.explanation
                        );
                    }
                }

                setCleaningProgress(Math.round(((i + 1) / totalIssues) * 100));
                // Slow down slightly for visual flair, unless it's a massive dataset
                const delay = issues.length > 50 ? 10 : 30;
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const vaultedRows: DataRow[] = [];

            // 2. Perform Structural Removals
            if (rowsToRemove.size > 0 || columnsToRemove.size > 0) {
                // Visual cleanup: Native removals
                // IMPORTANT: Delete in reverse order for rows to maintain index stability
                const sortedRowsToRemove = Array.from(rowsToRemove).sort((a, b) => b - a);
                if (univerEditorRef.current?.deleteRow) {
                    for (const rowIdx of sortedRowsToRemove) {
                        univerEditorRef.current.deleteRow(rowIdx);
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }

                // Native column removals
                if (univerEditorRef.current?.deleteColumn && columnsToRemove.size > 0) {
                    // Sort columns by their current index in reverse to maintain stability
                    const colIndexesToRemove = Array.from(columnsToRemove)
                        .map(name => displayHeaders.indexOf(name))
                        .filter(idx => idx !== -1)
                        .sort((a, b) => b - a);

                    for (const colIdx of colIndexesToRemove) {
                        univerEditorRef.current.deleteColumn(colIdx);
                        await new Promise(resolve => setTimeout(resolve, 80));
                    }
                }

                vaultedRows.push(...currentData
                    .filter((_, idx) => rowsToRemove.has(idx))
                    .map(row => ({
                        ...row,
                        __metadata: {
                            ...row.__metadata,
                            removalReason: 'Automated batch removal by AI Cleaning Engine',
                            removedAt: new Date().toISOString()
                        }
                    })));

                setQuarantinedData(prev => [...prev, ...vaultedRows]);

                // Filter rows
                currentData = currentData.filter((_, idx) => !rowsToRemove.has(idx));

                // Filter columns in each row
                if (columnsToRemove.size > 0) {
                    currentData = currentData.map(row => {
                        const newRow = { ...row };
                        columnsToRemove.forEach(col => {
                            // Add column removal to history once
                            if (!newHistory.some(h => h.action === 'remove_column' as any && h.column === col)) {
                                newHistory.push({
                                    id: `remove-col-${col}-${Date.now()}`,
                                    timestamp: new Date(),
                                    action: 'remove_column' as any,
                                    actor: 'ai',
                                    row: -1,
                                    column: col,
                                    oldValue: 'column',
                                    newValue: 'deleted',
                                    explanation: `Structural cleanup: Deleted garbage column "${col}"`,
                                    canUndo: false
                                });
                            }
                            delete newRow[col];
                        });
                        return newRow;
                    });
                }

                // Add history entries for removed rows
                rowsToRemove.forEach(rowIndex => {
                    newHistory.push({
                        id: `remove-row-${rowIndex}-${Date.now()}`,
                        timestamp: new Date(),
                        action: 'remove_row' as any,
                        actor: 'ai',
                        row: rowIndex,
                        column: 'ALL',
                        oldValue: 'record',
                        newValue: 'deleted',
                        explanation: `Integrity cleanup: Removed incomplete record at row ${rowIndex + 1}`,
                        canUndo: false
                    });
                });

                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Update all state
            setChangeHistory(prev => [...prev, ...newHistory]);
            setIssues([]);

            // Update dataset logic with fresh data
            const finalHeaders = (dataset.headers || []).filter(h => !columnsToRemove.has(h));
            const finalQuarantined = [...quarantinedData, ...vaultedRows];

            const updatedDataset = {
                ...dataset,
                data: currentData,
                raw_data: currentData, // CRITICAL FIX: explicit sync of raw_data for backend persistence
                headers: finalHeaders,
                quarantined_data: finalQuarantined, // specific backend field name
                quarantinedData: finalQuarantined
            };

            await updateDataset(Number(dataset.id), updatedDataset as any);
            setQuarantinedData(finalQuarantined);

            // Force FortuneSheet to re-render with the cleaned data
            if (univerEditorRef.current?.forceUpdate) {
                univerEditorRef.current.forceUpdate(currentData, finalHeaders);
            }

            // Re-run semantic analysis silently to update Quality Score and Insights
            // Use the UPDATED dataset context
            const newSemantics = await analyzeDatasetSemantics(updatedDataset as any);
            setSemantics(newSemantics);

            // Explicitly force state update to reflect new quality score immediately
            setActiveDataset({ ...dataset, ...updatedDataset } as any);

            setProcessingStatus('✅ Cleaning complete!');
            await new Promise(resolve => setTimeout(resolve, 1500));
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
        updateDataset(Number(dataset.id), { data: newData } as any);

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
        updateDataset(Number(dataset.id), { validationRules: updatedRules } as any);
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
            const payload = {
                name: dataset.name,
                raw_data: JSON.stringify(dataset.data),
                headers: JSON.stringify(dataset.headers),
                health_score: semantics?.qualityScore || dataset.healthScore,
                cleaning_confirmed: true,
                quarantined_data: JSON.stringify(quarantinedData),
                cleaning_summary: JSON.stringify({
                    history: changeHistory,
                    semantics: semantics,
                    finalIssueCount: issues.length,
                    timestamp: new Date().toISOString()
                })
            };

            await apiClient.put(`/workspaces/${workspaceId}/datasets/${dataset.id}`, payload);

            await apiClient.post(
                `/workspaces/${dataset.workspace_id || workspaceId}/datasets/${dataset.id}/confirm-clean`,
                { keepQuarantined: true }
            );
            alert('✅ Cleaning confirmed and saved!');
            setShowConfirmDialog(false);
            setDirty(false); // Reset dirty state after save
        } catch (e: any) {
            console.error('Save error:', e);
            alert(`Failed to save: ${e.message || 'Unknown error'}`);
        } finally {
            setIsConfirming(false);
        }
    };

    // Handle committing a new version
    const handleCommitVersion = async (name: string, description: string) => {
        if (!dataset || !datasetId || !workspaceId) return;

        setIsCommittingVersion(true);
        try {
            const newVersion = await commitVersionToApi(
                datasetId,
                name,
                description,
                dataset.data || [],
                dataset.headers || displayHeaders,
                'cleaning'
            );

            setShowCommitModal(false);
            setDirty(false);

            // Show success feedback
            alert(`✅ Version "${name}" created successfully!`);
        } catch (e: any) {
            console.error('Commit version error:', e);
            alert(`Failed to commit version: ${e.message || 'Unknown error'}`);
        } finally {
            setIsCommittingVersion(false);
        }
    };

    // Handle selecting a version from timeline
    const handleVersionSelect = async (version: Version) => {
        if (!version.id || !datasetId) return;

        try {
            setProcessingStatus('Loading version...');
            // In VersionContext, selectVersion fetches the data if not already present
            const loadedVersion = await selectVersion(version.id);

            if (loadedVersion && loadedVersion.data) {
                // Update local state
                const newData = loadedVersion.data;
                const newHeaders = loadedVersion.headers || Object.keys(newData[0] || {});

                // Update dataset context
                const updatedDataset = { ...dataset, data: newData, headers: newHeaders };
                setActiveDataset(updatedDataset as any);

                // Force FortuneSheet to re-render
                if (univerEditorRef.current?.forceUpdate) {
                    univerEditorRef.current.forceUpdate(newData, newHeaders);
                }

                // Clear old issues as they apply to the previous version
                setIssues([]);
                setProcessingStatus(`Version "${version.version_name}" loaded`);

                // Close panel
                setShowVersionPanel(false);
            }
        } catch (error) {
            console.error("Failed to load version", error);
            alert("Failed to load selected version.");
        } finally {
            setTimeout(() => setProcessingStatus(''), 2000);
        }
    };

    // Handle restoring a version
    const handleVersionRestore = async (version: Version) => {
        if (!confirm(`Are you sure you want to restore "${version.version_name}"? This will replace your current working data.`)) {
            return;
        }

        if (!datasetId) return;

        try {
            setProcessingStatus('Restoring version...');
            const data = await restoreVersion(datasetId, version.id);

            if (data) {
                const newHeaders = version.headers || Object.keys(data[0] || {});

                // Update dataset
                const updatedDataset = { ...dataset, data: data, headers: newHeaders };
                setActiveDataset(updatedDataset as any);

                // Force sheet update
                if (univerEditorRef.current?.forceUpdate) {
                    univerEditorRef.current.forceUpdate(data, newHeaders);
                }

                setIssues([]);
                setDirty(true); // Mark as dirty logic handled by VersionContext implicitly if we want, but here we mark local dirty
                setProcessingStatus(`Restored to "${version.version_name}"`);
                setShowVersionPanel(false);
            }
        } catch (error) {
            console.error("Failed to restore version", error);
            alert("Failed to restore version.");
        } finally {
            setTimeout(() => setProcessingStatus(''), 2000);
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
                        { id: 'vault', label: '🛡️ Vault', icon: '🛡️', count: (quarantinedData || []).length },
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
                    <div className="flex items-center gap-2">
                        {/* Version Badge */}
                        <VersionBadge
                            version={currentVersion}
                            isDirty={isDirty || changeHistory.length > 0}
                            onClick={() => setShowVersionPanel(true)}
                        />

                        {/* Save Version Button */}
                        <button
                            onClick={() => setShowCommitModal(true)}
                            className="px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all flex items-center gap-1.5"
                            title="Save current state as a new version"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            Save Version
                        </button>

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
                                    data={dataset?.data || []}
                                    headers={displayHeaders}
                                    issues={issues}
                                    theme={theme as any}
                                    lastUpdated={
                                        // Use either backend update timestamp OR a local tracking of changes
                                        // We can use the last entry in changeHistory or dataset.updated_at
                                        (dataset as any).updated_at || changeHistory.length
                                    }
                                    onCellEdit={(row, col, oldVal, newVal) => {
                                        if (isCleaningLive) return; // Skip updates during automated bulk cleaning
                                        const header = displayHeaders[col];
                                        if (!header) return;

                                        console.log(`[UniverCleanView] Manual edit at [${row}, ${col}] (${header}): ${oldVal} -> ${newVal}`);

                                        // 1. Update Change History
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

                                        // 2. Sync with dataset state so "Confirm & Save" sees it
                                        if (dataset && dataset.data) {
                                            const newData = [...dataset.data];
                                            if (newData[row]) {
                                                const timestamp = new Date().toISOString();
                                                const auditEntry = {
                                                    action: 'modified' as const,
                                                    field: header,
                                                    from: String(oldVal || ''),
                                                    to: String(newVal || ''),
                                                    reason: 'Manual user edit',
                                                    timestamp,
                                                    actor: 'user'
                                                };

                                                newData[row] = {
                                                    ...newData[row],
                                                    [header]: newVal,
                                                    __metadata: {
                                                        ...newData[row].__metadata,
                                                        manualEdit: true,
                                                        lastModified: timestamp,
                                                        auditLog: [
                                                            ...(newData[row].__metadata?.auditLog || []),
                                                            auditEntry
                                                        ]
                                                    }
                                                };
                                                updateDataset(Number(dataset.id), { data: newData, raw_data: newData } as any);
                                            }
                                        }
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
                                        {originalHeaders.map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {((dataset as any).raw_data || dataset.data || []).slice(0, 200).map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                                            {originalHeaders.map(h => (
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
                            {(quarantinedData || []).length === 0 ? (
                                <div className="text-center py-20 text-slate-400">
                                    <div className="text-6xl mb-4">🛡️</div>
                                    <p className="font-bold text-xl">Vault Empty</p>
                                    <p className="text-sm">No rows were quarantined during cleaning.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {(quarantinedData || []).map((row, i) => (
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

            {/* Commit Version Modal */}
            <CommitVersionModal
                isOpen={showCommitModal}
                onClose={() => setShowCommitModal(false)}
                onCommit={handleCommitVersion}
                isCommitting={isCommittingVersion}
                suggestedName={`Cleaning ${new Date().toLocaleDateString()}`}
                tool="cleaning"
            />

            {/* Version Timeline Panel - Slide in from right */}
            {showVersionPanel && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={() => setShowVersionPanel(false)}
                    />
                    <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-right duration-300 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                                Version History
                            </h3>
                            <button
                                onClick={() => setShowVersionPanel(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4 h-[calc(100%-64px)] overflow-auto">
                            <VersionTimeline
                                datasetId={datasetId || ''}
                                workspaceId={workspaceId || ''}
                                currentVersionId={currentVersion?.id}
                                onVersionSelect={handleVersionSelect}
                                onRestore={handleVersionRestore}
                            />
                        </div>
                    </div>
                </div>
            )}

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
