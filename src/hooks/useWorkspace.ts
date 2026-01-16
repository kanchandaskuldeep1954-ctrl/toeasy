import { useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorkspaceContext, WorkspaceContextType } from '../context/WorkspaceContext';

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

/**
 * Helper hook to build navigation paths with workspace context
 * Ensures workspace ID is preserved when navigating between tabs
 */
export const useWorkspaceNavigation = () => {
  const { activeWorkspace } = useWorkspace();
  const [searchParams] = useSearchParams();
  
  // Get workspace ID from context or URL params
  const workspaceId = activeWorkspace?.id || searchParams.get('workspace');
  
  /**
   * Build a path with workspace context preserved
   * @param basePath - The base path like '/app/dashboard'
   * @returns Path with workspace parameter if available
   */
  const buildPath = (basePath: string): string => {
    if (!workspaceId) return basePath;
    return `${basePath}?workspace=${workspaceId}`;
  };
  
  return { workspaceId, buildPath };
};
