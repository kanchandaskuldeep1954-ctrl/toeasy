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

            // 1. If we have a report ID, fetch the specific entity
            if (reportId) {
                const response = await axios.get(
                    `${backendUrl}/workspaces/${workspaceId}/dashboards/${reportId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setReportEntity(response.data);
                targetDatasetId = response.data.layout?.dataset_id || datasetId;
                initialReport = response.data.layout?.report;
            }

            if (!targetDatasetId) {
                throw new Error('No dataset linked to this report.');
            }

            // 2. Fetch Dataset for data source
            const dsRes = await axios.get(
                `${backendUrl}/workspaces/${workspaceId}/datasets/${targetDatasetId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

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
                strategicReport: initialReport || (dsData.strategic_report ? safeParse(dsData.strategic_report) : undefined),
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

    return <ReportView dataset={dataset} onUpdate={handleUpdate} />;
};

export default ReportViewIntegrated;
