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
  fetchWorkspaces: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

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

  const fetchWorkspaces = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await workspaceAPI.list();
      const data = response.data || [];
      setWorkspaces(data);

      // Sync active workspace using functional update to avoid circular dependency
      setActiveWorkspaceState((currentActive) => {
        if (!currentActive) return null;
        const current = data.find((ws: Workspace) => ws.id === currentActive.id);
        if (current) {
          localStorage.setItem('active_workspace', JSON.stringify(current));
          return current;
        } else {
          localStorage.removeItem('active_workspace');
          return null;
        }
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch workspaces');
      console.error('Fetch workspaces error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]); // Removed activeWorkspace dependency

  // Initial fetch when token changes
  useEffect(() => {
    if (token && !fetchedRef.current) {
      fetchWorkspaces();
      fetchedRef.current = true;
    } else if (!token) {
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
      setError(err.message || 'Failed to create workspace');
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
        setError
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

