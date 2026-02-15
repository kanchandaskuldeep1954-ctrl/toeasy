import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReportView from './ReportView';
import { Dataset } from '../context/DatasetContext';
import { reportsAPI, datasetAPI } from '../services/api';
import { useDataset } from '../hooks/useDataset';

const ReportViewIntegrated: React.FC = () => {
    const { activeDataset, setActiveDataset } = useDataset();
    const dataset = activeDataset as unknown as Dataset;
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const workspaceId = searchParams.get('workspace') || '';
    const datasetId = searchParams.get('dataset') || '';
    const reportId = searchParams.get('id') || '';

    const [reportEntity, setReportEntity] = useState<any>(null);
    const [siblings, setSiblings] = useState<any[]>([]);
    const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Versioning state
    const [versions, setVersions] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isSavingVersion, setIsSavingVersion] = useState(false);
    const [versionNote, setVersionNote] = useState('');
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);

    const handleAiSubmit = async () => {
        if (!aiPrompt.trim() || !dataset || !dataset.strategicReport) return;
        setIsAiProcessing(true);
        try {
            const reportData = reportEntity ? { ...reportEntity, sections: dataset.strategicReport.sections } : { sections: dataset.strategicReport.sections };
            const res = await reportsAPI.modify(dataset, reportData, aiPrompt);
            const modifiedReport = res.data;

            if (modifiedReport && modifiedReport.sections) {
                setActiveDataset({
                    ...dataset,
                    strategicReport: modifiedReport
                });
                setIsAIModalOpen(false);
                setAiPrompt('');
                alert('AI Adjustment applied to current draft!');
            }
        } catch (e) {
            console.error('AI Adjustment failed:', e);
            alert('AI failed to adjust the report. Please try again.');
        } finally {
            setIsAiProcessing(false);
        }
    };

    useEffect(() => {
        if (workspaceId && (datasetId || reportId)) {
            loadAll();
        }
    }, [workspaceId, datasetId, reportId]);

    const loadAll = async () => {
        try {
            setLoading(true);

            let targetDatasetId = datasetId;
            let initialReportContent = undefined;

            // 1. Fetch Report Entity
            if (reportId) {
                const rRes = await reportsAPI.get(workspaceId, reportId);
                const ent = rRes.data.data;
                setReportEntity(ent);
                targetDatasetId = ent.dataset_id || datasetId;
                initialReportContent = ent.current_content;

                // Fetch versions
                const vRes = await reportsAPI.listVersions(workspaceId, reportId);
                setVersions(vRes.data.data);
            }

            if (!targetDatasetId) throw new Error('No dataset linked.');

            // 2. Hydrate Dataset in Context if not already active
            if (!dataset || String(dataset.id) !== String(targetDatasetId)) {
                const dsRes = await datasetAPI.get(workspaceId, targetDatasetId);
                const dsData = dsRes.data;
                const safeParse = (val: any) => {
                    if (!val) return undefined;
                    if (typeof val === 'string') {
                        try {
                            const first = JSON.parse(val);
                            return typeof first === 'string' ? JSON.parse(first) : first;
                        } catch (e) { return undefined; }
                    }
                    return val;
                };

                const cleanedData = safeParse(dsData.cleaned_data);
                const rawData = cleanedData || safeParse(dsData.raw_data || dsData.data) || [];
                const headers = safeParse(dsData.headers) || (rawData[0] ? Object.keys(rawData[0]) : []);

                setActiveDataset({
                    ...dsData,
                    data: rawData,
                    headers: headers,
                    strategicReport: initialReportContent || (dsData.strategic_report ? safeParse(dsData.strategic_report) : undefined),
                });
            }

            // 3. Fetch Siblings
            const siblingsRes = await reportsAPI.list(workspaceId, targetDatasetId);
            setSiblings(Array.isArray(siblingsRes.data.data) ? siblingsRes.data.data : []);
            setError(null);
        } catch (err: any) {
            if (err.response?.status === 404) {
                console.warn('Report snapshot not found, falling back to Master Draft.');
                // Remove invalid search param without page reload
                const params = new URLSearchParams(window.location.search);
                params.delete('id');
                navigate({ search: params.toString() }, { replace: true });
                // We don't throw here, instead we'll continue to load the dataset below if possible
                // by manually setting reportId to empty for this execution
            } else {
                setError(err instanceof Error ? err.message : 'Failed to load report');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (updated: Dataset) => {
        if (!workspaceId) return;
        try {
            setActiveDataset(updated as any);

            // 1. If we are in a specific report, update its content
            if (reportId) {
                await reportsAPI.update(workspaceId, reportId, {
                    content: updated.strategicReport
                });
            } else {
                // 2. If we are in Master Draft mode, persist the report content back to the dataset
                await datasetAPI.update(workspaceId, datasetId || '', {
                    strategic_report: updated.strategicReport
                });
            }
        } catch (err) {
            console.error('Failed to persist report update:', err);
        }
    };

    const handleSaveVersion = async () => {
        if (!dataset?.strategicReport) return;
        try {
            setIsSavingVersion(true);

            let activeReportId = reportId;

            // 1. If no reportId, create the report entity first
            if (!activeReportId) {
                const createRes = await reportsAPI.create(workspaceId, {
                    name: `${dataset.name} Master`,
                    description: 'Primary strategic assessment',
                    dataset_id: datasetId || '',
                    content: dataset.strategicReport
                });
                const newReport = createRes.data.data;
                activeReportId = newReport.id;

                // Create the FIRST version immediately so history is not empty
                await reportsAPI.saveVersion(workspaceId, activeReportId, {
                    change_summary: versionNote || 'Initial Draft Snapshot'
                });

                setVersionNote('');
                setIsSavingVersion(false);

                // Redirect to the new report view to enable versioning context
                navigate(`/app/report?id=${activeReportId}&workspace=${workspaceId}&dataset=${datasetId}`);
                return;
            }

            // 2. Existing versioning logic
            await reportsAPI.saveVersion(workspaceId, activeReportId, { change_summary: versionNote });
            setVersionNote('');
            setIsSavingVersion(false);

            // Refresh versions
            const vRes = await reportsAPI.listVersions(workspaceId, activeReportId);
            setVersions(vRes.data.data);
            alert('Version snapshot saved successfully!');
        } catch (e) {
            console.error('Failed to save version:', e);
            alert('Failed to save version');
        } finally {
            setIsSavingVersion(false);
        }
    };

    const handleRestore = async (versionId: number) => {
        if (!confirm('Restore this version? current unsaved changes will be lost.')) return;
        try {
            setLoading(true);
            await reportsAPI.restoreVersion(workspaceId, reportId, versionId);
            await loadAll();
        } catch (e) { alert('Failed to restore'); } finally { setLoading(false); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-500 dark:text-slate-400 font-bold">Synchronizing Intel...</p>
                </div>
            </div>
        );
    }

    if (error || !dataset) return <div className="p-20 text-center text-red-500">{error || 'Load failed'}</div>;

    return (
        <div className="relative h-screen overflow-hidden flex flex-col bg-white dark:bg-slate-950">
            {/* Analysis Context Header */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between z-[110]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => window.location.href = `/app/reports?workspace=${workspaceId}&dataset=${datasetId}`}
                        className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                        Report Vault
                    </button>
                    <div className="h-4 w-px bg-slate-800"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{dataset?.name} /</span>
                        <div className="relative">
                            <button
                                onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                                className="flex items-center gap-2 text-white text-xs font-black uppercase tracking-tight hover:text-indigo-400 transition-colors"
                            >
                                {reportEntity?.name || 'Master Draft'}
                                <svg className={`w-3 h-3 transition-transform ${isSwitcherOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {isSwitcherOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2">
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                        {siblings.map(sib => (
                                            <button
                                                key={sib.id}
                                                onClick={() => window.location.href = `/app/report?id=${sib.id}&workspace=${workspaceId}&dataset=${datasetId}`}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-3 ${sib.id === reportId ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                            >
                                                📄 <span className="truncate">{sib.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${showHistory ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                        History ({versions.length})
                    </button>

                    {/* Cross-Module Navigation */}
                    <div className="hidden md:flex items-center gap-1.5 border-l border-slate-700 pl-3">
                        <button
                            onClick={() => navigate(`/app/sheets?workspace=${workspaceId}&dataset=${datasetId}`)}
                            className="px-2.5 py-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                            📋 Sheets
                        </button>
                        <button
                            onClick={() => navigate(`/app/dashboard?workspace=${workspaceId}&dataset=${datasetId}`)}
                            className="px-2.5 py-1 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 rounded text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                            📊 Dashboard
                        </button>
                        <button
                            onClick={() => navigate(`/app/clean?workspace=${workspaceId}&dataset=${datasetId}`)}
                            className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                            🧹 Clean
                        </button>
                        <button
                            onClick={() => navigate(`/app/playground?workspace=${workspaceId}&dataset=${datasetId}`)}
                            className="px-2.5 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                            ⚡ Playground
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Version note..."
                            value={versionNote}
                            onChange={(e) => setVersionNote(e.target.value)}
                            className="bg-slate-800 border-none rounded-lg px-3 py-1.5 text-white text-[10px] font-medium focus:ring-1 focus:ring-indigo-500 w-32"
                        />
                        <button
                            disabled={isSavingVersion}
                            onClick={handleSaveVersion}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                            {isSavingVersion ? 'Saving...' : 'Snapshot'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 relative flex overflow-hidden">
                <div className="flex-1 relative overflow-hidden">
                    <ReportView dataset={dataset} onUpdate={handleUpdate} />
                </div>

                {showHistory && (
                    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col animate-in slide-in-from-right">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-white font-black text-xs uppercase tracking-widest">Version History</h3>
                            <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {versions.length === 0 ? (
                                <p className="text-slate-500 text-center py-10 text-[10px] font-bold uppercase tracking-widest">No snapshots recorded</p>
                            ) : (
                                versions.map((v: any) => (
                                    <div key={v.id} className="p-4 bg-slate-800/50 rounded-xl border border-slate-800 hover:border-indigo-500/50 transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-indigo-400 font-bold text-[10px]">v{v.version_number}</span>
                                            <span className="text-slate-500 text-[9px] font-medium">{new Date(v.created_at).toLocaleString()}</span>
                                        </div>
                                        <p className="text-slate-300 text-[11px] mb-4 font-medium italic">"{v.change_summary || 'No summary'}"</p>
                                        <button
                                            onClick={() => handleRestore(v.id)}
                                            className="w-full py-2 bg-slate-800 group-hover:bg-indigo-600 text-[9px] font-black uppercase tracking-widest text-white rounded transition-colors"
                                        >
                                            Restore Snapshot
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportViewIntegrated;

