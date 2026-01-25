/**
 * WorkspaceTabs Component
 * 
 * Persistent tab bar for quick access to datasets, dashboards, and reports.
 * Users can "pin" views as tabs within a workspace context.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { tabsAPI } from '../services/api';

interface Tab {
    id: string;
    tab_type: 'dashboard' | 'report' | 'dataset';
    resource_id: string;
    tab_name: string;
    tab_order: number;
}

const WorkspaceTabs: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { activeWorkspace } = useWorkspace();

    const [tabs, setTabs] = useState<Tab[]>([]);
    const [loading, setLoading] = useState(false);

    const workspaceId = activeWorkspace?.id;
    const currentDatasetId = searchParams.get('dataset');
    const currentPath = location.pathname;

    useEffect(() => {
        if (workspaceId) {
            fetchTabs();
        }
    }, [workspaceId]);

    const fetchTabs = async () => {
        try {
            setLoading(true);
            const response = await tabsAPI.list(String(workspaceId));
            setTabs(response.data);
        } catch (err) {
            console.error('Failed to fetch tabs:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTab = async () => {
        if (!workspaceId || !currentDatasetId) return;

        let tabType: 'dashboard' | 'report' | 'dataset' = 'dataset';
        let tabName = 'New Tab';

        if (currentPath.includes('/app/dashboard')) {
            tabType = 'dashboard';
            tabName = 'Dashboard';
        } else if (currentPath.includes('/app/report')) {
            tabType = 'report';
            tabName = 'Report';
        } else if (currentPath.includes('/app/datasets') || currentPath.includes('/app/clean')) {
            tabType = 'dataset';
            tabName = 'Dataset';
        }

        try {
            const response = await tabsAPI.add({
                workspaceId: String(workspaceId),
                tabType,
                resourceId: currentDatasetId,
                tabName
            });

            setTabs(prev => [...prev, response.data]);
        } catch (err) {
            console.error('Failed to add tab:', err);
        }
    };

    const handleRemoveTab = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await tabsAPI.delete(id);
            setTabs(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            console.error('Failed to delete tab:', err);
        }
    };

    const navigateToTab = (tab: Tab) => {
        let path = '';
        switch (tab.tab_type) {
            case 'dashboard': path = '/app/dashboard'; break;
            case 'report': path = '/app/report'; break;
            case 'dataset': path = '/app/clean'; break;
        }
        navigate(`${path}?workspace=${workspaceId}&dataset=${tab.resource_id}`);
    };

    const isTabActive = (tab: Tab) => {
        return currentDatasetId === tab.resource_id && (
            (tab.tab_type === 'dashboard' && currentPath.includes('/app/dashboard')) ||
            (tab.tab_type === 'report' && currentPath.includes('/app/report')) ||
            (tab.tab_type === 'dataset' && (currentPath.includes('/app/clean') || currentPath.includes('/app/datasets')))
        );
    };

    if (!workspaceId) return null;

    return (
        <div className="bg-white dark:bg-[#080c14] border-b border-slate-200 dark:border-white/5 px-4 flex items-center gap-1 overflow-x-auto no-scrollbar h-10 shrink-0 select-none">
            {/* All Tabs */}
            <div className="flex items-center gap-1">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        onClick={() => navigateToTab(tab)}
                        className={`group flex items-center gap-2 h-8 px-3 rounded-t-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border-x border-t border-transparent relative
                            ${isTabActive(tab)
                                ? 'bg-slate-50 dark:bg-slate-900 text-indigo-600 border-slate-200 dark:border-white/10 z-10'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                            }`}
                    >
                        <span className="truncate max-w-[100px]">{tab.tab_name}</span>
                        <button
                            onClick={(e) => handleRemoveTab(e, tab.id)}
                            className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-opacity"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        {isTabActive(tab) && (
                            <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-slate-50 dark:bg-slate-900 z-20"></div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add Tab Button */}
            <button
                onClick={handleAddTab}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all ml-2"
                title="Pin Current View as Tab"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
            </button>
        </div>
    );
};

export default WorkspaceTabs;
