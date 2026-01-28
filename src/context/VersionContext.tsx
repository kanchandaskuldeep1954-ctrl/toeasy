/**
 * VersionContext
 * Phase 1.1: Global state management for dataset versions
 * 
 * Features:
 * - Load and cache versions
 * - Track current version and dirty state
 * - Commit, restore, and compare versions
 * - Sync with DatasetContext
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
// import axios from 'axios'; // Removed
import { apiClient } from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';

export interface Version {
    id: string;
    version_name: string;
    description?: string;
    row_count: number;
    created_by_tool: string;
    parent_version_id?: string | null;
    created_at: string;
    isVirtual?: boolean;
    data?: any[];
    headers?: string[];
}

export interface VersionDiff {
    addedRows: number;
    deletedRows: number;
    modifiedRows: number;
    addedColumns: string[];
    deletedColumns: string[];
    changes: Array<{
        row: number;
        column: string;
        oldValue: any;
        newValue: any;
    }>;
}

export interface VersionContextType {
    // State
    versions: Version[];
    currentVersion: Version | null;
    isLoading: boolean;
    isDirty: boolean;
    error: string | null;

    // Actions
    loadVersions: (datasetId: string) => Promise<void>;
    selectVersion: (versionId: string) => Promise<Version | null>;
    commitVersion: (
        datasetId: string,
        name: string,
        description: string,
        data: any[],
        headers: string[],
        tool: string
    ) => Promise<Version>;
    restoreVersion: (datasetId: string, versionId: string) => Promise<any[]>;
    compareVersions: (datasetId: string, v1Id: string, v2Id: string) => Promise<VersionDiff>;

    // State setters
    setDirty: (dirty: boolean) => void;
    setCurrentVersion: (version: Version | null) => void;
    refreshVersions: () => Promise<void>;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

export const VersionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token } = useAuth();
    const { activeWorkspace } = useWorkspace();
    const [versions, setVersions] = useState<Version[]>([]);
    const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentDatasetId, setCurrentDatasetId] = useState<string | null>(null);

    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000/api';

    // Load versions for a dataset
    const loadVersions = useCallback(async (datasetId: string) => {
        if (!token || !activeWorkspace) return;

        setCurrentDatasetId(datasetId);
        setIsLoading(true);
        setError(null);

        try {
            const response = await apiClient.get(
                `/workspaces/${activeWorkspace.id}/datasets/${datasetId}/versions`,
                { params: {} } // Add params if needed
            );

            const versionList = response.data || [];
            setVersions(versionList);

            // Set current version to the latest (first in list)
            if (versionList.length > 0 && !currentVersion) {
                setCurrentVersion(versionList[0]);
            }
        } catch (err: any) {
            console.error('Failed to load versions:', err);
            setError(err.response?.data?.error || 'Failed to load versions');
        } finally {
            setIsLoading(false);
        }
    }, [token, activeWorkspace, backendUrl, currentVersion]);

    // Refresh current dataset's versions
    const refreshVersions = useCallback(async () => {
        if (currentDatasetId) {
            // Clear current version to force refresh
            await loadVersions(currentDatasetId);
        }
    }, [currentDatasetId, loadVersions]);

    // Select and load a specific version
    const selectVersion = useCallback(async (versionId: string): Promise<Version | null> => {
        if (!token || !activeWorkspace || !currentDatasetId) return null;

        setIsLoading(true);
        setError(null);

        try {
            const response = await apiClient.get(
                `/workspaces/${activeWorkspace.id}/datasets/${currentDatasetId}/versions/${versionId}`
            );

            const versionData = response.data;
            setCurrentVersion(versionData);
            setIsDirty(false);

            return versionData;
        } catch (err: any) {
            console.error('Failed to select version:', err);
            setError(err.response?.data?.error || 'Failed to load version');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [token, activeWorkspace, currentDatasetId, backendUrl]);

    // Commit a new version
    const commitVersion = useCallback(async (
        datasetId: string,
        name: string,
        description: string,
        data: any[],
        headers: string[],
        tool: string
    ): Promise<Version> => {
        if (!token || !activeWorkspace) {
            throw new Error('Not authenticated or no workspace selected');
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await apiClient.post(
                `/workspaces/${activeWorkspace.id}/datasets/${datasetId}/versions`,
                {
                    versionName: name,
                    description,
                    data,
                    headers,
                    tool,
                    parentVersionId: currentVersion?.id || 'root',
                }
            );

            // Log Version Creation Activity
            try {
                await apiClient.post('/activity', {
                    workspaceId: activeWorkspace.id,
                    datasetId: datasetId,
                    actionType: 'VERSION_CREATE',
                    actionCategory: 'data',
                    actionDetail: `Created version "${name}"`,
                    actionMetadata: { versionId: response.data.id, tool },
                    sourceComponent: tool
                });
            } catch (logErr) {
                console.error('Failed to log version creation activity', logErr);
            }

            const newVersion: Version = {
                id: response.data.id,
                version_name: name,
                description,
                row_count: data.length,
                created_by_tool: tool,
                parent_version_id: currentVersion?.id,
                created_at: response.data.created_at || new Date().toISOString(),
            };

            // Add to versions list
            setVersions(prev => [newVersion, ...prev]);
            setCurrentVersion(newVersion);
            setIsDirty(false);

            return newVersion;
        } catch (err: any) {
            console.error('Failed to commit version:', err);
            setError(err.response?.data?.error || 'Failed to commit version');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [token, activeWorkspace, backendUrl, currentVersion]);

    // Restore a version (returns the data to apply)
    const restoreVersion = useCallback(async (datasetId: string, versionId: string): Promise<any[]> => {
        if (!token || !activeWorkspace) {
            throw new Error('Not authenticated');
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await apiClient.get(
                `/workspaces/${activeWorkspace.id}/datasets/${datasetId}/versions/${versionId}`
            );

            const versionData = response.data;

            // Set as current version
            setCurrentVersion(versionData);
            setIsDirty(false);

            return versionData.data || [];
        } catch (err: any) {
            console.error('Failed to restore version:', err);
            setError(err.response?.data?.error || 'Failed to restore version');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [token, activeWorkspace, backendUrl]);

    // Compare two versions
    const compareVersions = useCallback(async (
        datasetId: string,
        v1Id: string,
        v2Id: string
    ): Promise<VersionDiff> => {
        if (!token || !activeWorkspace) {
            throw new Error('Not authenticated');
        }

        setIsLoading(true);

        try {
            // Load both versions
            const [v1Response, v2Response] = await Promise.all([
                apiClient.get(
                    `/workspaces/${activeWorkspace.id}/datasets/${datasetId}/versions/${v1Id}`
                ),
                apiClient.get(
                    `/workspaces/${activeWorkspace.id}/datasets/${datasetId}/versions/${v2Id}`
                ),
            ]);

            const v1Data = v1Response.data.data || [];
            const v2Data = v2Response.data.data || [];
            const v1Headers = v1Response.data.headers || Object.keys(v1Data[0] || {});
            const v2Headers = v2Response.data.headers || Object.keys(v2Data[0] || {});

            // Compute diff
            const diff: VersionDiff = {
                addedRows: Math.max(0, v2Data.length - v1Data.length),
                deletedRows: Math.max(0, v1Data.length - v2Data.length),
                modifiedRows: 0,
                addedColumns: v2Headers.filter((h: string) => !v1Headers.includes(h)),
                deletedColumns: v1Headers.filter((h: string) => !v2Headers.includes(h)),
                changes: [],
            };

            // Find cell-level changes (limited to first 1000 rows for performance)
            const maxRows = Math.min(Math.max(v1Data.length, v2Data.length), 1000);
            const commonHeaders = v1Headers.filter((h: string) => v2Headers.includes(h));

            for (let i = 0; i < maxRows; i++) {
                const row1 = v1Data[i] || {};
                const row2 = v2Data[i] || {};
                let rowModified = false;

                for (const col of commonHeaders) {
                    const val1 = row1[col];
                    const val2 = row2[col];

                    if (String(val1) !== String(val2)) {
                        diff.changes.push({
                            row: i + 1,
                            column: col,
                            oldValue: val1,
                            newValue: val2,
                        });
                        rowModified = true;
                    }
                }

                if (rowModified) {
                    diff.modifiedRows++;
                }
            }

            return diff;
        } catch (err: any) {
            console.error('Failed to compare versions:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [token, activeWorkspace, backendUrl]);

    // Mark dirty when external changes happen
    const setDirty = useCallback((dirty: boolean) => {
        setIsDirty(dirty);
    }, []);

    return (
        <VersionContext.Provider
            value={{
                versions,
                currentVersion,
                isLoading,
                isDirty,
                error,
                loadVersions,
                selectVersion,
                commitVersion,
                restoreVersion,
                compareVersions,
                setDirty,
                setCurrentVersion,
                refreshVersions,
            }}
        >
            {children}
        </VersionContext.Provider>
    );
};

export const useVersion = (): VersionContextType => {
    const context = useContext(VersionContext);
    if (!context) {
        throw new Error('useVersion must be used within a VersionProvider');
    }
    return context;
};

export default VersionContext;
