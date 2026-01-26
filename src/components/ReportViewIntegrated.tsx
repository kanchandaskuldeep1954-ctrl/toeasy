import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import ReportView from '../../components/ReportView';
import { Dataset } from '../../types';
import datasetAPI from '../services/api';

const ReportViewIntegrated: React.FC = () => {
    const { token } = useAuth();
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

    const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:3000/api';

    useEffect(() => {
        if (workspaceId && (datasetId || reportId) && token) {
            loadAll();
        }
    }, [workspaceId, datasetId, reportId, token]);

    const loadAll = async () => {
        try {
            setLoading(true);

            let targetDatasetId = datasetId;
            let initialReport = undefined;
            let entityHasReport = false;

            // 1. If we have a report ID, fetch the specific entity
            if (reportId) {
                const response = await axios.get(
                    `${backendUrl}/workspaces/${workspaceId}/dashboards/${reportId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const ent = response.data;
                setReportEntity(ent);
                targetDatasetId = ent.layout?.dataset_id || datasetId;
                initialReport = ent.layout?.report;
                entityHasReport = true;
            }

            if (!targetDatasetId) {
                throw new Error('No dataset linked to this report.');
            }

            // 2. Fetch Dataset + Siblings
            const [dsRes, siblingsRes] = await Promise.all([
                axios.get(`${backendUrl}/workspaces/${workspaceId}/datasets/${targetDatasetId}`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${backendUrl}/workspaces/${workspaceId}/dashboards`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            const dsData = dsRes.data;
            const allDashboards = siblingsRes.data.data || [];
            const reportSiblings = allDashboards.filter((d: any) => d.layout?.dataset_id === targetDatasetId && d.layout?.type === 'report');
            setSiblings(reportSiblings);

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

            const rawData = safeParse(dsData.raw_data || dsData.data) || [];
            const headers = safeParse(dsData.headers) || [];
            const finalHeaders = headers.length > 0 ? headers : Object.keys(rawData?.[0] || {});

            const transformedDataset: Dataset = {
                id: dsData.id || targetDatasetId,
                name: dsData.name || 'Dataset',
                sourceType: dsData.source_type || 'csv',
                headers: finalHeaders,
                data: rawData,
                stats: dsData.stats || [],
                createdAt: dsData.created_at || new Date().toISOString(),
                rowCount: rawData.length,
                quarantinedData: [],
                cleaningActions: [],
                cleaningHistory: dsData.cleaning_history || [],
                dashboardConfig: dsData.dashboard_config ? safeParse(dsData.dashboard_config) : undefined,
                strategicReport: entityHasReport ? initialReport : (dsData.strategic_report ? safeParse(dsData.strategic_report) : undefined),
            };

            setDataset(transformedDataset);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load report');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (updated: Dataset) => {
        if (!workspaceId) return;
        try {
            setDataset(updated);

            if (reportId) {
                // Persist to the specific dashboard record (used as report storage)
                await axios.put(`${backendUrl}/workspaces/${workspaceId}/dashboards/${reportId}`, {
                    name: reportEntity?.name || updated.name + ' Strategic Report',
                    layout: {
                        type: 'report',
                        dataset_id: updated.id || datasetId,
                        report: updated.strategicReport
                    }
                }, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                // Fallback to updating the dataset default (Legacy)
                await datasetAPI.dataset.update(workspaceId, updated.id || datasetId, {
                    dashboard_config: updated.dashboardConfig,
                    strategic_report: updated.strategicReport
                });
            }
        } catch (err) {
            console.error('Failed to persist report update:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-500 dark:text-slate-400 font-bold">Generating Report...</p>
                </div>
            </div>
        );
    }

    if (error || !dataset) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
                <div className="text-center space-y-6 max-w-md p-6">
                    <div>
                        <p className="text-red-500 dark:text-red-400 text-lg font-bold mb-2">⚠️ Error</p>
                        <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">{error || 'Failed to load dataset for report'}</p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/20"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-screen overflow-hidden flex flex-col">
            {/* Analysis Context Header */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between z-[110]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            const path = datasetId ? `/app/reports?workspace=${workspaceId}&dataset=${datasetId}` : `/app/reports?workspace=${workspaceId}`;
                            window.location.href = path;
                        }}
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
                                {reportEntity?.name || 'Default Report'}
                                <svg className={`w-3 h-3 transition-transform ${isSwitcherOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {isSwitcherOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
                                    <p className="px-3 py-2 text-[8px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">Switch Document</p>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                        {siblings.map(sib => (
                                            <button
                                                key={sib.id}
                                                onClick={() => {
                                                    if (sib.isPrimary) {
                                                        window.location.href = `/app/report?dataset=${datasetId}&workspace=${workspaceId}`;
                                                    } else {
                                                        window.location.href = `/app/report?id=${sib.id}&workspace=${workspaceId}&dataset=${datasetId}`;
                                                    }
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-3 ${((sib.isPrimary && !reportId) || (sib.id === reportId)) ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                            >
                                                <span className="opacity-50">{sib.isPrimary ? '🧠' : '📄'}</span>
                                                <span className="truncate">{sib.name}</span>
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => window.location.href = `/app/reports?workspace=${workspaceId}&dataset=${datasetId}&new=true`}
                                            className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-600/10 transition-all mt-2 border-t border-white/5 pt-3"
                                        >
                                            + New Version
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Strategic Intelligence
                    </span>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
                <ReportView dataset={dataset} onUpdate={handleUpdate} />
            </div>
        </div>
    );
};

export default ReportViewIntegrated;
