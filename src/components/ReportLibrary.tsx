import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface StrategicReportEntity {
    id: string;
    workspace_id: string;
    user_id: string;
    name: string;
    description?: string;
    layout: any;
    created_at: string;
    updated_at: string;
}

export const ReportLibrary: React.FC = () => {
    const { token } = useAuth();
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

    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000/api';

    useEffect(() => {
        if (workspaceId) {
            loadAll();
        }
    }, [token, workspaceId]);

    const loadAll = async () => {
        try {
            setLoading(true);
            // We store reports in the dashboards table with a type tag in the layout
            const [dRes, dsRes] = await Promise.all([
                axios.get(`${backendUrl}/workspaces/${workspaceId}/dashboards`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${backendUrl}/workspaces/${workspaceId}/datasets`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            const allDashboards = dRes.data.data || [];
            const reportEntities = allDashboards.filter((d: any) => d.layout?.type === 'report');

            const filtered = filterDatasetId
                ? reportEntities.filter((r: any) => r.layout?.dataset_id === filterDatasetId)
                : reportEntities;

            setReports(filtered);
            setDatasets(dsRes.data || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching reports:', err);
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
            const response = await axios.post(
                `${backendUrl}/workspaces/${workspaceId}/dashboards`,
                {
                    name: formData.name.trim(),
                    description: formData.description,
                    layout: { type: 'report', dataset_id: formData.datasetId, report: null }
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const newReport = response.data;
            navigate(`/app/report?id=${newReport.id}&workspace=${workspaceId}`);
        } catch (err) {
            setError('Failed to create report');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteReport = async (id: string) => {
        if (!window.confirm('Delete this strategic report?')) return;
        try {
            await axios.delete(`${backendUrl}/workspaces/${workspaceId}/dashboards/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
                            {filterDatasetId ? `${(datasets || []).find(d => d.id === filterDatasetId)?.name || 'Dataset'} Reports` : 'Strategic Report Library'}
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
                        <form onSubmit={handleCreateReport} className="space-y-6 max-w-md">
                            <div>
                                <label className="text-sm text-slate-400 mb-2 block uppercase tracking-widest font-bold text-[10px]">Reference Dataset*</label>
                                <select
                                    value={formData.datasetId}
                                    onChange={(e) => setFormData({ ...formData, datasetId: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="">Select Dataset Source...</option>
                                    {datasets.map(ds => (
                                        <option key={ds.id} value={ds.id}>{ds.name} ({(JSON.parse(ds.raw_data || '[]').length).toLocaleString()} rows)</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-slate-400 mb-2 block uppercase tracking-widest font-bold text-[10px]">Report Title*</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Q1 Performance Review"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                    required
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex-1"
                                >
                                    {submitting ? 'Preparing vault...' : 'Initialize Analysis'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowNewForm(false)}
                                    className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold transition-all"
                                >
                                    Cancel
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
                        {reports.map((report) => (
                            <div
                                key={report.id}
                                className="group relative p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                                onClick={() => navigate(`/app/report?id=${report.id}&workspace=${workspaceId}`)}
                            >
                                <div className="flex items-start justify-between mb-8">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <span className="text-2xl">📄</span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }}
                                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
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
            </div>
        </div>
    );
};

export default ReportLibrary;
