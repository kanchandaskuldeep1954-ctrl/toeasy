import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReportView from './ReportView';
import { Dataset } from '../types';
import { reportsAPI, datasetAPI } from '../services/api';

const ReportViewIntegrated: React.FC = () => {
    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace') || '';
    const datasetId = searchParams.get('dataset') || '';
    const reportId = searchParams.get('id') || '';

    const [dataset, setDataset] = useState<Dataset | null>(null);
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

            // 2. Fetch Dataset + Siblings
            const [dsRes, siblingsRes] = await Promise.all([
                datasetAPI.get(workspaceId, targetDatasetId),
                reportsAPI.list(workspaceId, targetDatasetId)
            ]);

            const dsData = dsRes.data;
            setSiblings(siblingsRes.data.data || []);

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
            const headers = safeParse(dsData.headers) || [];
            const finalHeaders = headers.length > 0 ? headers : Object.keys(rawData?.[0] || {});

            const transformedDataset: Dataset = {
                id: dsData.id || targetDatasetId,
                name: dsData.name || 'Dataset',
                sourceType: dsData.source_type || 'csv',
                headers: finalHeaders,
                data: rawData,
                dataQualitySource: cleanedData ? 'PRO_CLEANED' : 'RAW_ORIGINAL',
                stats: dsData.stats || [],
                createdAt: dsData.created_at || new Date().toISOString(),
                rowCount: rawData.length,
                quarantinedData: [],
                cleaningActions: [],
                cleaningHistory: dsData.cleaning_history || [],
                dashboardConfig: dsData.dashboard_config ? safeParse(dsData.dashboard_config) : undefined,
                strategicReport: initialReportContent || (dsData.strategic_report ? safeParse(dsData.strategic_report) : undefined),
            };

            setDataset(transformedDataset);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (updated: Dataset) => {
        if (!workspaceId) return;
        try {
            setDataset(updated);
            if (reportId) {
                await reportsAPI.update(workspaceId, reportId, {
                    content: updated.strategicReport
                });
            }
        } catch (err) { console.error(err); }
    };

    const handleSaveVersion = async () => {
        if (!reportId || !dataset?.strategicReport) return;
        try {
            setIsSavingVersion(true);
            await reportsAPI.saveVersion(workspaceId, reportId, { change_summary: versionNote });
            setVersionNote('');
            setIsSavingVersion(false);
            // Refresh versions
            const vRes = await reportsAPI.listVersions(workspaceId, reportId);
            setVersions(vRes.data.data);
            alert('Version snapshot saved successfully!');
        } catch (e) { alert('Failed to save version'); }
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

