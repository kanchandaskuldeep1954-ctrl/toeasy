import React, { createContext, useContext, useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export interface Activity {
    id: number;
    user_id: number;
    workspace_id: number;
    dataset_id?: number;
    action_type: string;
    action_category: string;
    action_detail: string;
    action_metadata: any;
    source_component: string;
    is_undoable: boolean;
    created_at: string;
    user_email?: string;
    user_name?: string;
}

interface ActivityContextType {
    activities: Activity[];
    isLoading: boolean;
    error: string | null;
    loadActivities: (workspaceId: string, filters?: any) => Promise<void>;
    logActivity: (
        workspaceId: string,
        actionType: string,
        category: string,
        detail: string,
        metadata?: any,
        datasetId?: string,
        component?: string
    ) => Promise<void>;
    refreshActivities: () => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFilters, setLastFilters] = useState<any>({});

    const loadActivities = useCallback(async (workspaceId: string, filters: any = {}) => {
        setIsLoading(true);
        setError(null);
        setLastFilters({ workspaceId, ...filters });
        try {
            const params = { workspaceId, ...filters };
            const response = await apiClient.get('/activity', { params });
            setActivities(response.data.data);
        } catch (err: any) {
            console.error('Failed to load activities', err);
            setError(err.message || 'Failed to load activities');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const refreshActivities = useCallback(async () => {
        if (lastFilters.workspaceId) {
            await loadActivities(lastFilters.workspaceId, lastFilters);
        }
    }, [loadActivities, lastFilters]);

    const logActivity = useCallback(async (
        workspaceId: string,
        actionType: string,
        category: string,
        detail: string,
        metadata: any = {},
        datasetId?: string,
        component: string = 'system'
    ) => {
        try {
            await apiClient.post('/activity', {
                workspaceId,
                datasetId,
                actionType,
                actionCategory: category,
                actionDetail: detail,
                actionMetadata: metadata,
                sourceComponent: component
            });
            // Refresh feed in background
            refreshActivities();
        } catch (err) {
            console.error('Failed to log activity', err);
        }
    }, [refreshActivities]);

    return (
        <ActivityContext.Provider value={{
            activities,
            isLoading,
            error,
            loadActivities,
            logActivity,
            refreshActivities
        }}>
            {children}
        </ActivityContext.Provider>
    );
};

export const useActivity = () => {
    const context = useContext(ActivityContext);
    if (context === undefined) {
        throw new Error('useActivity must be used within an ActivityProvider');
    }
    return context;
};
