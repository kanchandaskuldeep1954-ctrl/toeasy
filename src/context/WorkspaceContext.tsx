import React, { createContext, useState, useCallback, useEffect } from 'react';

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
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: number, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active workspace from localStorage on mount
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

  // Save active workspace to localStorage whenever it changes
  const setActiveWorkspace = useCallback((workspace: Workspace | null) => {
    setActiveWorkspaceState(workspace);
    if (workspace) {
      localStorage.setItem('active_workspace', JSON.stringify(workspace));
    } else {
      localStorage.removeItem('active_workspace');
    }
  }, []);

  const addWorkspace = useCallback((workspace: Workspace) => {
    setWorkspaces((prev) => [...prev, workspace]);
  }, []);

  const updateWorkspace = useCallback((id: number, updates: Partial<Workspace>) => {
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === id ? { ...ws, ...updates } : ws))
    );

    if (activeWorkspace?.id === id) {
      const updated = { ...activeWorkspace, ...updates };
      setActiveWorkspace(updated);
    }
  }, [activeWorkspace, setActiveWorkspace]);

  const removeWorkspace = useCallback((id: number) => {
    setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));

    if (activeWorkspace?.id === id) {
      setActiveWorkspace(null);
    }
  }, [activeWorkspace, setActiveWorkspace]);

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
        setLoading,
        setError
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
