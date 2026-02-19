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
        const workspaceIdParam = Number(searchParams.get('workspace') || 0);
        if (!Number.isFinite(workspaceIdParam) || workspaceIdParam <= 0 || workspaces.length === 0) {
            return;
        }

        if (!activeWorkspace || activeWorkspace.id !== workspaceIdParam) {
            const workspace = workspaces.find((item) => item.id === workspaceIdParam);
            if (workspace) {
                setActiveWorkspace(workspace);
            }
        }
    }, [searchParams, workspaces, activeWorkspace, setActiveWorkspace]);

    // Sync Dataset
    useEffect(() => {
        const datasetIdParam = Number(searchParams.get('dataset') || 0);
        const workspaceIdParam = Number(searchParams.get('workspace') || activeWorkspace?.id || 0);

        if (datasetIdParam > 0 && datasets.length > 0) {
            const dataset = datasets.find((item) => item.id === datasetIdParam);
            if (dataset) {
                if (!activeDataset || activeDataset.id !== dataset.id) {
                    setActiveDataset(dataset);
                }
                return;
            }
        }

        // Avoid stale dataset context when URL/workspace changed.
        if (activeDataset) {
            if (datasetIdParam > 0 && activeDataset.id !== datasetIdParam) {
                setActiveDataset(null);
                return;
            }
            if (workspaceIdParam > 0 && Number(activeDataset.workspace_id) !== workspaceIdParam) {
                setActiveDataset(null);
            }
        }
    }, [searchParams, datasets, activeDataset, activeWorkspace, setActiveDataset]);

    return null; // Renderless component
};
