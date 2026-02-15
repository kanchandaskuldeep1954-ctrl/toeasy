/**
 * DatasetToolTabs — Replaces WorkspaceTabs
 * 
 * When a dataset is active, shows tool tabs: Sheets | Dashboard | Report | Clean | Playground
 * Each tab navigates to the corresponding tool view with the current dataset context.
 * 
 * This is the "Tableau/Power BI" inspired approach:
 * one dataset, multiple tool views, all connected.
 */

import React from 'react';
import { NavLink, useSearchParams, useLocation } from 'react-router-dom';
import { useDataset } from '../../hooks/useDataset';
import { useWorkspace } from '../../hooks/useWorkspace';
import {
    Table2,
    BarChart3,
    FileText,
    Sparkles,
    Code2,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ToolTab {
    id: string;
    label: string;
    icon: React.ReactNode;
    path: string;
}

const DatasetToolTabs: React.FC = () => {
    const { activeDataset } = useDataset();
    const { activeWorkspace } = useWorkspace();
    const { theme } = useTheme();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const workspaceId = activeWorkspace?.id;
    const datasetId = searchParams.get('dataset') || (activeDataset as any)?.id;

    // Only show tool tabs when a dataset is active
    if (!datasetId || !workspaceId) return null;

    const queryString = `?workspace=${workspaceId}&dataset=${datasetId}`;

    const tools: ToolTab[] = [
        { id: 'sheets', label: 'Sheets', icon: <Table2 className="w-4 h-4" />, path: `/app/sheets${queryString}` },
        { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" />, path: `/app/dashboard${queryString}` },
        { id: 'report', label: 'Report', icon: <FileText className="w-4 h-4" />, path: `/app/report${queryString}` },
        { id: 'clean', label: 'Clean', icon: <Sparkles className="w-4 h-4" />, path: `/app/clean${queryString}` },
        { id: 'playground', label: 'Playground', icon: <Code2 className="w-4 h-4" />, path: `/app/playground${queryString}` },
    ];

    const isActive = (tab: ToolTab) => {
        return location.pathname.includes(`/app/${tab.id}`);
    };

    return (
        <div className={`flex items-center gap-1 px-4 h-10 select-none ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-white'
            }`}>
            {/* Dataset Name Label */}
            <div className={`flex items-center gap-2 mr-3 pr-3 border-r ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                }`}>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className={`text-xs font-bold truncate max-w-[150px] ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                    {(activeDataset as any)?.name || `Dataset #${datasetId}`}
                </span>
            </div>

            {/* Tool Tabs */}
            {tools.map((tab) => {
                const active = isActive(tab);
                return (
                    <NavLink
                        key={tab.id}
                        to={tab.path}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                            transition-all duration-200 relative
                            ${active
                                ? theme === 'dark'
                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                : theme === 'dark'
                                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                            }
                        `}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                        {active && (
                            <div className={`absolute -bottom-[11px] left-2 right-2 h-[2px] rounded-full ${theme === 'dark' ? 'bg-blue-500' : 'bg-blue-600'
                                }`} />
                        )}
                    </NavLink>
                );
            })}
        </div>
    );
};

export default DatasetToolTabs;
