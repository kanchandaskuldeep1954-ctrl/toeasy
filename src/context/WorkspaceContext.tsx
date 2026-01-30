import React, { createContext, useState, useCallback, useEffect, useRef } from 'react';
import { workspaceAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export interface Workspace {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  addWorkspace: (workspace: { name: string; description?: string }) => Promise<void>;
  updateWorkspace: (id: number, updates: { name?: string; description?: string }) => Promise<void>;
  removeWorkspace: (id: number) => Promise<void>;
  fetchWorkspaces: (reset?: boolean) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  hasMore: boolean;
  loadMoreWorkspaces: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Pagination State
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 100,
    total: 0,
    hasMore: true
  });

  // Load active workspace from localStorage on mount (as a hint)
  useEffect(() => {
    const saved = localStorage.getItem('active_workspace');
    if (saved) {
      try {
        const workspace = JSON.parse(saved);
        setActiveWorkspaceState(workspace);
      } catch (e) {
        localStorage.removeItem('active_workspace');
      }
    }
  }, []);

  const fetchWorkspaces = useCallback(async (reset = true) => {
    if (!token) return;
    try {
      setLoading(true);
      const currentOffset = reset ? 0 : pagination.offset;
      const response = await workspaceAPI.list(pagination.limit, currentOffset);

      const data = response.data.data || []; // API returns { data, total, limit, offset, hasMore }
      const meta = response.data;

      if (reset) {
        setWorkspaces(data);
      } else {
        setWorkspaces(prev => [...prev, ...data]);
      }

      setPagination(prev => ({
        ...prev,
        offset: meta.offset + meta.limit,
        total: meta.total,
        hasMore: meta.hasMore
      }));

      // Sync active workspace (only on initial load/reset)
      if (reset) {
        setActiveWorkspaceState((currentActive) => {
          if (!currentActive) return null;
          const current = data.find((ws: Workspace) => ws.id === currentActive.id);
          if (current) {
            localStorage.setItem('active_workspace', JSON.stringify(current));
            return current;
          } else {
            // Keep it if it's not in the first page? Or clear it? 
            // For now, let's keep it in local state even if not in first page list
            return currentActive;
          }
        });
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch workspaces');
      console.error('Fetch workspaces error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, pagination.limit, pagination.offset]); // Added pagination deps

  const loadMoreWorkspaces = useCallback(() => {
    if (!isLoading && pagination.hasMore) {
      fetchWorkspaces(false);
    }
  }, [isLoading, pagination.hasMore, fetchWorkspaces]);

  // Initial fetch when token changes
  useEffect(() => {
    if (token && !fetchedRef.current) {
      fetchWorkspaces(true);
      fetchedRef.current = true;
    }
    else if (!token) {
      setWorkspaces([]);
      setActiveWorkspaceState(null);
      fetchedRef.current = false;
    }
  }, [token, fetchWorkspaces]);

  const setActiveWorkspace = useCallback((workspace: Workspace | null) => {
    setActiveWorkspaceState(workspace);
    if (workspace) {
      localStorage.setItem('active_workspace', JSON.stringify(workspace));
    } else {
      localStorage.removeItem('active_workspace');
    }
  }, []);

  const addWorkspace = useCallback(async (data: { name: string; description?: string }) => {
    try {
      setLoading(true);
      const response = await workspaceAPI.create(data);
      const newWs = response.data;
      setWorkspaces((prev) => [newWs, ...prev]);
      setError(null);
    } catch (err: any) {
      const { getErrorMessage } = await import('../services/api');
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWorkspace = useCallback(async (id: number, updates: { name?: string; description?: string }) => {
    try {
      setLoading(true);
      const response = await workspaceAPI.update(id.toString(), updates);
      const updatedWs = response.data;

      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === id ? updatedWs : ws))
      );

      // Use functional update to avoid dependency on activeWorkspace
      setActiveWorkspaceState((currentActive) => {
        if (currentActive?.id === id) {
          localStorage.setItem('active_workspace', JSON.stringify(updatedWs));
          return updatedWs;
        }
        return currentActive;
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update workspace');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []); // Removed activeWorkspace and setActiveWorkspace dependencies

  const removeWorkspace = useCallback(async (id: number) => {
    try {
      setLoading(true);
      await workspaceAPI.delete(id.toString());

      setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));

      // Use functional update to avoid dependency on activeWorkspace
      setActiveWorkspaceState((currentActive) => {
        if (currentActive?.id === id) {
          localStorage.removeItem('active_workspace');
          return null;
        }
        return currentActive;
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete workspace');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []); // Removed activeWorkspace and setActiveWorkspace dependencies

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        error,
        setWorkspaces,
        setActiveWorkspace,
        addWorkspace,
        updateWorkspace,
        removeWorkspace,
        fetchWorkspaces,
        setLoading,
        setError,
        hasMore: pagination.hasMore,
        loadMoreWorkspaces
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

