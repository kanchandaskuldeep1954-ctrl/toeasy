import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDataset } from '../hooks/useDataset';
import { useWorkspace } from '../hooks/useWorkspace';

export const UrlSync: React.FC = () => {
    const [searchParams] = useSearchParams();
    const { datasets, activeDataset, setActiveDataset } = useDataset();
    const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();

    // Sync Workspace
    useEffect(() => {
        const workspaceId = searchParams.get('workspace');
        if (workspaceId && workspaces.length > 0) {
            if (!activeWorkspace || activeWorkspace.id !== parseInt(workspaceId)) {
                const workspace = workspaces.find(w => w.id === parseInt(workspaceId));
                if (workspace) {
                    console.log('[UrlSync] Syncing Workspace from URL:', workspace.name);
                    setActiveWorkspace(workspace);
                }
            }
        }
    }, [searchParams, workspaces, activeWorkspace, setActiveWorkspace]);

    // Sync Dataset
    useEffect(() => {
        const datasetId = searchParams.get('dataset');
        if (datasetId && datasets.length > 0) {
            if (!activeDataset || activeDataset.id !== parseInt(datasetId)) {
                const dataset = datasets.find(d => d.id === parseInt(datasetId));
                if (dataset) {
                    console.log('[UrlSync] Syncing Dataset from URL:', dataset.name);
                    setActiveDataset(dataset);
                }
            }
        }
    }, [searchParams, datasets, activeDataset, setActiveDataset]);

    return null; // Renderless component
};
