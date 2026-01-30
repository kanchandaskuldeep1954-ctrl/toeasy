import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { reportsAPI, datasetAPI } from '../services/api';

interface StrategicReportEntity {
    id: string;
    workspace_id: string;
    user_id: string;
    name: string;
    description?: string;
    current_content: any;
    dataset_id: string;
    version_count?: number;
    created_at: string;
    updated_at: string;
}

export const ReportLibrary: React.FC = () => {
    const { activeWorkspace } = useWorkspace();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace') || activeWorkspace?.id?.toString() || '';
    const filterDatasetId = searchParams.get('dataset') || '';

    const [reports, setReports] = useState<StrategicReportEntity[]>([]);
    const [datasets, setDatasets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '', datasetId: filterDatasetId });
    const [submitting, setSubmitting] = useState(false);

    const [pagination, setPagination] = useState({
        offset: 0,
        limit: 20,
        hasMore: true
    });

    useEffect(() => {
        if (workspaceId) {
            loadReports(true);
        }
    }, [workspaceId]);

    const loadReports = async (reset = true) => {
        try {
            setLoading(true);
            const currentOffset = reset ? 0 : pagination.offset;
            const limit = pagination.limit;

            const [rRes, dsRes] = await Promise.all([
                reportsAPI.list(workspaceId, filterDatasetId || undefined, limit, currentOffset),
                datasetAPI.list(workspaceId, limit, currentOffset)
            ]);

            const reportData = rRes.data;
            const reportEntities = reportData.data || [];

            const dsData = dsRes.data;
            const dsList = dsData.data || [];

            // Synthesis: Primary Strategic Report for every dataset
            const primaryReports = dsList.filter((ds: any) => !reportEntities.some((r: any) => String(r.dataset_id) === String(ds.id))).map((ds: any) => ({
                id: `primary-${ds.id}`,
                dataset_id: ds.id,
                name: `${ds.name} Master`,
                description: 'Initial AI-generated strategic assessment',
                isPrimary: true,
                created_at: ds.created_at,
                updated_at: ds.updated_at
            }));

            const combined = [...primaryReports, ...reportEntities];

            if (reset) {
                setReports(combined as any);
                setDatasets(dsList);
            } else {
                setReports(prev => [...prev, ...combined] as any);
                setDatasets(prev => [...prev, ...dsList]);
            }

            const hasMoreReports = reportData.hasMore;
            const hasMoreDatasets = dsData.hasMore;

            setPagination(prev => ({
                ...prev,
                offset: currentOffset + limit,
                hasMore: hasMoreReports || hasMoreDatasets
            }));

            setError(null);
        } catch (err) {
            console.error('Error fetching reports:', err);
            setError('Failed to load reports library');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.datasetId) {
            setError('Name and Dataset are required');
            return;
        }

        try {
            setSubmitting(true);
            const res = await reportsAPI.create(workspaceId, {
                name: formData.name.trim(),
                description: formData.description,
                dataset_id: formData.datasetId,
                content: {}
            });

            const newReport = res.data.data;
            navigate(`/app/report?id=${newReport.id}&workspace=${workspaceId}`);
        } catch (err) {
            console.error(err);
            setError('Failed to create report');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteReport = async (id: string) => {
        if (!window.confirm('Delete this strategic report?')) return;
        try {
            // Need to add delete to reportsAPI
            await (reportsAPI as any).delete(workspaceId, id);
            setReports(reports.filter(r => r.id !== id));
        } catch (err) {
            setError('Failed to delete report');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
                <div className="text-slate-500 dark:text-slate-400 font-medium animate-pulse uppercase tracking-widest text-xs">Accessing Intelligence Vault...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 transition-colors">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                            {filterDatasetId ? `${(Array.isArray(datasets) ? datasets : []).find(d => d.id === filterDatasetId)?.name || 'Dataset'} Reports` : 'Strategic Report Library'}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            {filterDatasetId ? 'Consolidated intelligence for this data source' : 'Organization-wide long-form analysis'}
                        </p>
                    </div>
                    {!showNewForm && (
                        <button
                            onClick={() => setShowNewForm(true)}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                        >
                            + New Strategic Draft
                        </button>
                    )}
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200">
                        {error}
                    </div>
                )}

                {showNewForm && (
                    <div className="mb-8 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] shadow-2xl animate-in fade-in slide-in-from-top-4">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Create Strategic Analysis</h2>
                        <form onSubmit={handleCreateReport} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Report Title
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder={filterDatasetId ? `${datasets.find(d => d.id === filterDatasetId)?.name} Strategy` : "e.g., Annual Growth Report"}
                                    autoFocus
                                />
                            </div>

                            {!filterDatasetId && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Source Dataset
                                    </label>
                                    <select
                                        value={formData.datasetId}
                                        onChange={(e) => setFormData({ ...formData, datasetId: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">-- Choose a dataset --</option>
                                        {datasets.map((ds) => (
                                            <option key={ds.id} value={ds.id}>
                                                {ds.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {filterDatasetId && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-500/30 flex items-center gap-2">
                                    <span className="text-lg">🧠</span>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-emerald-500 dark:text-emerald-400">Context Active</p>
                                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                                            Generating intelligence for: {datasets.find(d => d.id === filterDatasetId)?.name}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowNewForm(false)}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || (!filterDatasetId && !formData.datasetId)}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                                >
                                    {submitting ? 'Initializing...' : 'Generate Report'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {reports.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[32px] border-dashed">
                        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-600/10 text-indigo-500 rounded-[28px] flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">No Strategic Reports Yet</h2>
                        <p className="text-slate-500 max-w-sm mx-auto mb-8 font-medium">Generate your first report by selecting a dataset and starting an AI intelligence session.</p>
                        <button
                            onClick={() => setShowNewForm(true)}
                            className="px-8 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-bold transition-all hover:scale-105"
                        >
                            Initialize First Analysis
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {reports.map((report: any) => (
                            <div
                                key={report.id}
                                className={`group relative p-8 bg-white dark:bg-slate-900 border ${report.isPrimary ? 'border-emerald-500/30' : 'border-slate-200 dark:border-slate-800'} rounded-[32px] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer`}
                                onClick={() => {
                                    const path = report.isPrimary
                                        ? `/app/report?dataset=${report.dataset_id}&workspace=${workspaceId}`
                                        : `/app/report?id=${report.id}&workspace=${workspaceId}`;
                                    navigate(path);
                                }}
                            >
                                {report.isPrimary && (
                                    <div className="absolute top-0 left-0 bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-br-2xl">
                                        Core Strategy
                                    </div>
                                )}
                                <div className="flex items-start justify-between mb-8">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <span className="text-2xl">{report.isPrimary ? '🧠' : '📄'}</span>
                                    </div>
                                    {!report.isPrimary && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }}
                                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 leading-tight">{report.name}</h3>
                                <p className="text-slate-400 text-sm font-medium line-clamp-2 mb-6">Strategic insights prepared on {new Date(report.created_at).toLocaleDateString()}</p>
                                <div className="flex items-center justify-between pt-6 border-t border-slate-50 dark:border-slate-800">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">View Report</span>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">{new Date(report.created_at).getFullYear()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {pagination.hasMore && !loading && reports.length > 0 && (
                    <div className="flex justify-center mt-12">
                        <button
                            onClick={() => loadReports(false)}
                            className="px-8 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            Load More Intelligence
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportLibrary;
