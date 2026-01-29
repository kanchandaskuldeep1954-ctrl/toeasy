import React from 'react';
import Sidebar from './Sidebar';
import WorkspaceTabs from '../WorkspaceTabs';
import NotificationCenter from '../NotificationCenter';

interface MainLayoutProps {
    children: React.ReactNode;
}

import { ActivityFeed } from '../Activity/ActivityFeed';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Activity, X } from 'lucide-react';

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const [showActivity, setShowActivity] = React.useState(false);
    const { activeWorkspace } = useWorkspace();

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden font-sans selection:bg-indigo-500/30">
            <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

            <main className="flex-1 overflow-hidden relative flex flex-col min-w-0">
                {/* Mobile Header */}
                <div className="lg:hidden h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center px-4 shrink-0 gap-4">
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white">
                        Toeasy
                    </span>
                    <button
                        onClick={() => setShowActivity(!showActivity)}
                        className="ml-auto p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                    >
                        <Activity className="w-5 h-5" />
                    </button>
                </div>

                {/* Perspective Tabs Bar */}
                <div className="flex items-center justify-between pr-4 bg-white border-b border-gray-200">
                    <WorkspaceTabs />
                    <div className="flex items-center gap-2">
                        <NotificationCenter />
                        <button
                            onClick={() => setShowActivity(!showActivity)}
                            className={`hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${showActivity
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <Activity className="w-4 h-4" />
                            Activity
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {children}
                    </div>

                    {/* Activity Feed Sidebar */}
                    {showActivity && (
                        <div className="w-80 border-l border-gray-200 bg-white h-full shadow-xl z-20 absolute right-0 top-0 lg:static lg:shadow-none animate-in slide-in-from-right duration-200">
                            <div className="lg:hidden absolute top-2 right-2 z-10">
                                <button onClick={() => setShowActivity(false)} className="p-1 hover:bg-gray-100 rounded">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <ActivityFeed workspaceId={String(activeWorkspace?.id || '')} />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
