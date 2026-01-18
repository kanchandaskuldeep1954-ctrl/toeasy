import { useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DatasetContext, DatasetContextType } from '../context/DatasetContext';
import { useWorkspaceNavigation } from './useWorkspace';

export const useDataset = (): DatasetContextType => {
  const context = useContext(DatasetContext);
  if (!context) {
    throw new Error('useDataset must be used within a DatasetProvider');
  }
  return context;
};

/**
 * Helper hook to build navigation paths with dataset context
 * Ensures both workspace and dataset IDs are preserved when navigating between tabs
 */
export const useDatasetNavigation = () => {
  const { activeDataset } = useDataset();
  const { workspaceId, buildPath: buildWorkspacePath } = useWorkspaceNavigation();
  const [searchParams] = useSearchParams();

  // Get dataset ID from context or URL params
  const datasetId = activeDataset?.id || searchParams.get('dataset');

  /**
   * Build a path with workspace and dataset context preserved
   * @param basePath - The base path like '/app/clean'
   * @returns Path with workspace and dataset parameters if available
   */
  const buildPath = (basePath: string): string => {
    if (!workspaceId) return basePath;
    if (!datasetId) return buildWorkspacePath(basePath);

    return `${basePath}?workspace=${workspaceId}&dataset=${datasetId}`;
  };

  return { workspaceId, datasetId, buildPath };
};
