import React, { createContext, useState, useCallback, useEffect, useRef } from 'react';
import { datasetAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';

export interface Dataset {
  id: number;
  workspace_id: number;
  user_id: number;
  name: string;
  file_name?: string;
  row_count: number;
  column_count: number;
  file_size: number;
  raw_data?: any[][];
  analysis_result?: any;
  created_at: string;
  updated_at: string;
}

export interface DatasetContextType {
  datasets: Dataset[];
  total: number;
  activeDataset: Dataset | null;
  isLoading: boolean;
  error: string | null;
  setDatasets: (datasets: Dataset[]) => void;
  setActiveDataset: (dataset: Dataset | null) => void;
  addDataset: (dataset: Dataset) => void;
  updateDataset: (id: number, updates: Partial<Dataset>) => Promise<void>;
  removeDataset: (id: number) => Promise<void>;
  fetchDatasets: (workspaceId: string, limit?: number, offset?: number) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}


export const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

export const DatasetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [total, setTotal] = useState(0);
  const [activeDataset, setActiveDatasetState] = useState<Dataset | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedWorkspaceId = useRef<string | null>(null);

  const fetchDatasets = useCallback(async (workspaceId: string, limit: number = 50, offset: number = 0) => {
    if (!token || !workspaceId) return;
    try {
      setLoading(true);
      const response = await datasetAPI.list(workspaceId);
      // The API returns { data: [...], total, ... }
      const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const count = response.data?.total || data.length;
      setDatasets(data);
      setTotal(count);


      // Sync active dataset
      if (activeDataset) {
        const current = data.find((ds: Dataset) => ds.id === activeDataset.id);
        if (current) {
          // Merge current with activeDataset to preserve any raw_data already loaded
          setActiveDatasetState((prev) => prev ? { ...current, ...prev } : current);
        } else {
          // Only reset if we are in the same workspace but the dataset is gone
          if (activeDataset.workspace_id === parseInt(workspaceId)) {
            setActiveDatasetState(null);
            localStorage.removeItem('activeDataset');
          }
        }
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch datasets');
      console.error('Fetch datasets error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, activeDataset]);

  // Fetch datasets when workspace changes
  useEffect(() => {
    if (activeWorkspace?.id) {
      const wsId = activeWorkspace.id.toString();
      if (lastFetchedWorkspaceId.current !== wsId) {
        fetchDatasets(wsId);
        lastFetchedWorkspaceId.current = wsId;
      }
    } else {
      setDatasets([]);
      lastFetchedWorkspaceId.current = null;
    }
  }, [activeWorkspace, fetchDatasets]);

  // Restore active dataset from localStorage on mount
  useEffect(() => {
    const savedDataset = localStorage.getItem('activeDataset');
    if (savedDataset) {
      try {
        setActiveDatasetState(JSON.parse(savedDataset));
      } catch (e) {
        console.error('Failed to parse saved dataset:', e);
      }
    }
  }, []);

  const setActiveDataset = useCallback((dataset: Dataset | null) => {
    setActiveDatasetState(dataset);
    if (dataset) {
      localStorage.setItem('activeDataset', JSON.stringify(dataset));
    } else {
      localStorage.removeItem('activeDataset');
    }
  }, []);

  const addDataset = useCallback((dataset: Dataset) => {
    setDatasets((prev) => [dataset, ...prev]);
  }, []);

  const updateDataset = useCallback(async (id: number, updates: Partial<Dataset>) => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      const response = await datasetAPI.update(activeWorkspace.id.toString(), id.toString(), updates);
      const updated = response.data;

      setDatasets((prev) =>
        prev.map((ds) => (ds.id === id ? { ...ds, ...updated } : ds))
      );

      if (activeDataset?.id === id) {
        setActiveDataset({ ...activeDataset, ...updated });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update dataset');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeDataset, activeWorkspace, setActiveDataset]);

  const removeDataset = useCallback(async (id: number) => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      await datasetAPI.delete(activeWorkspace.id.toString(), id.toString());

      setDatasets((prev) => prev.filter((ds) => ds.id !== id));

      if (activeDataset?.id === id) {
        setActiveDataset(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete dataset');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeDataset, activeWorkspace, setActiveDataset]);

  return (
    <DatasetContext.Provider
      value={{
        datasets,
        total,
        activeDataset,
        isLoading,
        error,
        setDatasets,
        setActiveDataset,
        addDataset,
        updateDataset,
        removeDataset,
        fetchDatasets,
        setLoading,
        setError
      }}
    >

      {children}
    </DatasetContext.Provider>
  );
};

