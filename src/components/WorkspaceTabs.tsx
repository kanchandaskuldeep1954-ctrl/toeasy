/**
 * WorkspaceTabs - Premium Visual Overhaul
 * 
 * Consistent tab bar matching the new MainLayout premium theme.
 * Removes the "cringe" white/gray look and replaces it with
 * sleek glassmorphism and smooth interactions.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { tabsAPI } from '../services/api';
import { X, Plus, LayoutDashboard, FileText, Database, Sparkles } from 'lucide-react';

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
    const currentPanel = searchParams.get('panel') || 'sheets';
    const currentProjectId = searchParams.get('project');
    const currentRoomId = searchParams.get('room');

    const tabPanelMap: Record<Tab['tab_type'], string> = {
        dashboard: 'visuals',
        report: 'report',
        dataset: 'sheets'
    };

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

        if (currentPath.includes('/app/studio') && currentPanel === 'visuals') {
            tabType = 'dashboard';
            tabName = 'Visuals';
        } else if (currentPath.includes('/app/studio') && currentPanel === 'report') {
            tabType = 'report';
            tabName = 'Report';
        } else if (currentPath.includes('/app/studio')) {
            tabType = 'dataset';
            tabName = 'Sheets';
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
        const params = new URLSearchParams();
        params.set('workspace', String(workspaceId));
        params.set('dataset', tab.resource_id);
        params.set('panel', tabPanelMap[tab.tab_type] || 'sheets');
        if (currentProjectId) params.set('project', currentProjectId);
        if (currentRoomId) params.set('room', currentRoomId);
        navigate(`/app/studio?${params.toString()}`);
    };

    const isTabActive = (tab: Tab) => {
        return (
            currentPath.includes('/app/studio')
            && currentDatasetId === tab.resource_id
            && currentPanel === (tabPanelMap[tab.tab_type] || 'sheets')
        );
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'dashboard': return <LayoutDashboard className="w-3.5 h-3.5" />;
            case 'report': return <FileText className="w-3.5 h-3.5" />;
            case 'dataset': return <Database className="w-3.5 h-3.5" />;
            default: return <Sparkles className="w-3.5 h-3.5" />;
        }
    };

    if (!workspaceId) return null;

    return (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar h-10 px-2 select-none">
            {/* All Tabs */}
            <div className="flex items-center gap-1">
                {tabs.map((tab) => {
                    const active = isTabActive(tab);
                    return (
                        <div
                            key={tab.id}
                            onClick={() => navigateToTab(tab)}
                            className={`
                                group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 border
                                ${active
                                    ? 'bg-slate-800 border-white/10 text-white shadow-lg shadow-black/20'
                                    : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                }
                            `}
                        >
                            <span className={`${active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
                                {getIcon(tab.tab_type)}
                            </span>
                            <span className="truncate max-w-[120px]">{tab.tab_name}</span>

                            <button
                                onClick={(e) => handleRemoveTab(e, tab.id)}
                                className={`
                                    ml-1 p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-all
                                    ${active ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-700/50 text-slate-500'}
                                `}
                            >
                                <X className="w-3 h-3" />
                            </button>

                            {active && (
                                <div className="absolute -bottom-[9px] left-0 right-0 h-[1px] bg-indigo-500/50" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Add Tab Button */}
            {currentDatasetId && (
                <button
                    onClick={handleAddTab}
                    className="ml-1 p-1.5 rounded-lg text-slate-500 hover:bg-slate-800/50 hover:text-indigo-400 transition-colors"
                    title="Pin current view as tab"
                >
                    <Plus className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default WorkspaceTabs;
