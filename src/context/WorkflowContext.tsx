import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useDataset } from './DatasetContext';
import { useVersion } from './VersionContext';
import { useLocation, useNavigate, useBeforeUnload } from 'react-router-dom';

export interface ChangeSet {
    id: string;
    description: string;
    timestamp: number;
    component: string;
}

interface WorkflowContextType {
    currentView: string;
    isGlobalDirty: boolean;
    pendingChanges: ChangeSet[];

    // Actions
    navigateSafely: (to: string) => void;
    notifyChange: (change: ChangeSet) => void;
    clearChanges: () => void;
    setGlobalDirty: (dirty: boolean) => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export const WorkflowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();

    // We sync with other contexts
    const { isDirty: isDatasetDirty } = useDataset(); // Assuming DatasetContext has isDirty
    const { isDirty: isVersionDirty } = useVersion();

    // Local state
    const [currentView, setCurrentView] = useState(location.pathname);
    const [pendingChanges, setPendingChanges] = useState<ChangeSet[]>([]);
    const [manualDirty, setManualDirty] = useState(false);

    // Derived global dirty state
    const isGlobalDirty = isDatasetDirty || isVersionDirty || manualDirty || pendingChanges.length > 0;

    // Update current view on location change
    useEffect(() => {
        setCurrentView(location.pathname);
    }, [location]);

    // Warning on unload
    // React Router v6 doesn't have usePrompt anymore, so we use window.onbeforeunload
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isGlobalDirty) {
                e.preventDefault();
                e.returnValue = ''; // Chrome requires returnValue to be set
                return '';
            }
        };

        if (isGlobalDirty) {
            window.addEventListener('beforeunload', handleBeforeUnload);
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isGlobalDirty]);

    const navigateSafely = useCallback((to: string) => {
        if (isGlobalDirty) {
            if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                // User confirmed, clear dirty state (optional logic) and go
                navigate(to);
            }
        } else {
            navigate(to);
        }
    }, [isGlobalDirty, navigate]);

    const notifyChange = useCallback((change: ChangeSet) => {
        setPendingChanges(prev => [...prev, change]);
    }, []);

    const clearChanges = useCallback(() => {
        setPendingChanges([]);
        setManualDirty(false);
    }, []);

    const setGlobalDirty = useCallback((dirty: boolean) => {
        setManualDirty(dirty);
    }, []);

    return (
        <WorkflowContext.Provider value={{
            currentView,
            isGlobalDirty,
            pendingChanges,
            navigateSafely,
            notifyChange,
            clearChanges,
            setGlobalDirty
        }}>
            {children}
        </WorkflowContext.Provider>
    );
};

export const useWorkflow = () => {
    const context = useContext(WorkflowContext);
    if (context === undefined) {
        throw new Error('useWorkflow must be used within a WorkflowProvider');
    }
    return context;
};
