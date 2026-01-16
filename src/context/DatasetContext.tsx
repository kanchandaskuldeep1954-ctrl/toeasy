import React, { createContext, useState, useCallback, useEffect } from 'react';

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
  activeDataset: Dataset | null;
  isLoading: boolean;
  error: string | null;
  setDatasets: (datasets: Dataset[]) => void;
  setActiveDataset: (dataset: Dataset | null) => void;
  addDataset: (dataset: Dataset) => void;
  updateDataset: (id: number, updates: Partial<Dataset>) => void;
  removeDataset: (id: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

export const DatasetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDataset, setActiveDatasetState] = useState<Dataset | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist active dataset to localStorage
  useEffect(() => {
    if (activeDataset) {
      localStorage.setItem('activeDataset', JSON.stringify(activeDataset));
    } else {
      localStorage.removeItem('activeDataset');
    }
  }, [activeDataset]);

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
  }, []);

  const addDataset = useCallback((dataset: Dataset) => {
    setDatasets((prev) => [...prev, dataset]);
  }, []);

  const updateDataset = useCallback((id: number, updates: Partial<Dataset>) => {
    setDatasets((prev) =>
      prev.map((ds) => (ds.id === id ? { ...ds, ...updates } : ds))
    );

    if (activeDataset?.id === id) {
      setActiveDataset({ ...activeDataset, ...updates });
    }
  }, [activeDataset]);

  const removeDataset = useCallback((id: number) => {
    setDatasets((prev) => prev.filter((ds) => ds.id !== id));

    if (activeDataset?.id === id) {
      setActiveDataset(null);
    }
  }, [activeDataset]);

  return (
    <DatasetContext.Provider
      value={{
        datasets,
        activeDataset,
        isLoading,
        error,
        setDatasets,
        setActiveDataset,
        addDataset,
        updateDataset,
        removeDataset,
        setLoading,
        setError
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
};
