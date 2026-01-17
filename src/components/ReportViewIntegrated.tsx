import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import ReportView from '../../components/ReportView';
import { Dataset } from '../../types';

const ReportViewIntegrated: React.FC = () => {
    const { token } = useAuth();
    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace');
    const datasetId = searchParams.get('dataset');

    const [dataset, setDataset] = useState<Dataset | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

    useEffect(() => {
        if (workspaceId && datasetId && token) {
            loadDataset();
        }
    }, [workspaceId, datasetId, token]);

    const loadDataset = async () => {
        try {
            setLoading(true);
            const response = await axios.get(
                `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const data = response.data;
            const rawData = data.raw_data || data.data || [];
            const headers = data.headers || Object.keys(rawData?.[0] || {});

            // Transform backend response to Dataset format
            const transformedDataset: Dataset = {
                id: data.id || datasetId,
                name: data.name || 'Dataset',
                sourceType: data.source_type || 'csv',
                headers: headers,
                data: rawData,
                stats: data.stats || [],
                createdAt: data.created_at || new Date().toISOString(),
                rowCount: rawData.length,
                quarantinedData: [],
                cleaningActions: [],
                cleaningHistory: data.cleaning_history || [],
            };

            setDataset(transformedDataset);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load dataset');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-400 font-bold">Generating Report...</p>
                </div>
            </div>
        );
    }

    if (error || !dataset) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="text-center space-y-6 max-w-md">
                    <div>
                        <p className="text-red-400 text-lg font-bold mb-2">⚠️ Error</p>
                        <p className="text-slate-300 text-sm">{error || 'Failed to load dataset for report'}</p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return <ReportView dataset={dataset} />;
};

export default ReportViewIntegrated;
