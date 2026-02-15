/**
 * MainLayout - Premium Visual Overhaul
 * 
 * A completely redesigned main layout with:
 * 1. Dark gradient header with glassmorphism
 * 2. Consistent premium dark theme
 * 3. Smooth animations and transitions
 * 4. Proactive AI alerts in header
 * 5. Modern workspace context display
 */

import React, { useState, useCallback } from 'react';
import Sidebar from './Sidebar';
import DatasetToolTabs from './DatasetToolTabs';
import { ActivityFeed } from '../Activity/ActivityFeed';
import NotificationCenter from '../Notifications/NotificationCenter';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useDataset } from '../../hooks/useDataset';
import { useAuth } from '../../hooks/useAuth';
import { Activity, X, Bell, ChevronRight, MessageCircle, Search } from 'lucide-react';
import { FilterProvider } from '../../context/FilterContext';
import AICopilotPanel from '../AICopilot/AICopilotPanel';
// FloatingCopilot removed — AI is now opt-in via "Ask AI" button only
import { GroqService } from '../../services/groqService';
import { useTheme } from '../../hooks/useTheme';
import CommandPalette from '../CommandPalette/CommandPalette';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showActivity, setShowActivity] = useState(false);
    const [showCopilot, setShowCopilot] = useState(false);
    const [showPalette, setShowPalette] = useState(false);
    const { activeWorkspace } = useWorkspace();
    const { activeDataset } = useDataset();
    const { user } = useAuth();
    const { theme } = useTheme();

    // Global Command Palette Shortcut (⌘K)
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowPalette(prev => !prev);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle AI queries
    const handleAskAI = useCallback(async (query: string): Promise<string> => {
        if (!activeDataset) {
            return "No dataset loaded. Please upload or select a dataset first.";
        }
        try {
            const response = await GroqService.consultVerifiedAgent(
                activeDataset,
                query,
                {},
                []
            );
            return response;
        } catch (error) {
            return "Sorry, I encountered an error. Please try again.";
        }
    }, [activeDataset]);

    return (
        <FilterProvider>
            <div className={`flex h-screen overflow-hidden font-sans selection:bg-indigo-500/30 ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
                <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

                <main className="flex-1 overflow-hidden relative flex flex-col min-w-0">
                    {/* Premium Header Bar */}
                    <header className={`h-14 border-b shrink-0 flex items-center px-4 gap-3 relative z-10 backdrop-blur-xl ${theme === 'dark'
                        ? 'border-white/5 bg-slate-900/90 text-white'
                        : 'border-slate-200 bg-white/80 text-slate-900'
                        }`}>
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMobileOpen(true)}
                            className={`lg:hidden p-2 -ml-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>

                        {/* Breadcrumb Context */}
                        <div className="hidden md:flex items-center gap-2 text-sm">
                            <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>{activeWorkspace?.name || 'Workspace'}</span>
                            {activeDataset && (
                                <>
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                    <span className={`font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        {activeDataset.name}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Right Side Actions */}
                        <button
                            onClick={() => setShowPalette(true)}
                            className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm mr-2 transition-colors border ${theme === 'dark'
                                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300'
                                }`}
                        >
                            <Search className="w-4 h-4" />
                            <span>Search...</span>
                            <kbd className="hidden lg:inline px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600">⌘K</kbd>
                        </button>

                        <div className="flex items-center gap-2">
                            {/* AI Copilot Button */}
                            <button
                                onClick={() => setShowCopilot(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
                            >
                                <MessageCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">Ask AI</span>
                            </button>

                            {/* AI Status Indicator — removed for cleaner header */}

                            {/* Notifications */}
                            <NotificationCenter />

                            {/* Activity Toggle */}
                            <button
                                onClick={() => setShowActivity(!showActivity)}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${showActivity
                                    ? 'bg-indigo-500/20 text-indigo-500 border border-indigo-500/30'
                                    : theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                            >
                                <Activity className="w-4 h-4" />
                                <span className="hidden lg:inline">Activity</span>
                            </button>

                            {/* User Avatar */}
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-blue-500/30 cursor-pointer hover:scale-105 transition-transform">
                                {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                        </div>
                    </header>

                    {/* Dataset Tool Tabs — shows Sheets|Dashboard|Report|Clean|Playground when a dataset is active */}
                    <div className={`border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
                        <DatasetToolTabs />
                    </div>

                    {/* Main Content Area with Premium Background */}
                    <div className={`flex flex-1 overflow-hidden ${theme === 'dark'
                        ? 'bg-slate-950'
                        : 'bg-slate-50/50'
                        }`}>
                        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
                            {/* Subtle grid pattern overlay */}
                            <div className="relative flex-1 flex flex-col">
                                <div
                                    className={`absolute inset-0 opacity-[0.02] pointer-events-none ${theme === 'dark' ? 'bg-white' : 'bg-black'}`}
                                    style={{
                                        maskImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)',
                                        WebkitMaskImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)',
                                        maskSize: '40px 40px',
                                        WebkitMaskSize: '40px 40px'
                                    }}
                                />
                                {children}
                            </div>
                        </div>

                        {/* Activity Feed Sidebar - Premium Style */}
                        {showActivity && (
                            <div className={`w-80 border-l h-full shadow-2xl z-20 absolute right-0 top-0 lg:static lg:shadow-none animate-in slide-in-from-right duration-300 backdrop-blur-xl ${theme === 'dark'
                                ? 'border-white/5 bg-slate-900/80'
                                : 'border-slate-200 bg-white/80'
                                }`}>
                                <div className="lg:hidden absolute top-3 right-3 z-10">
                                    <button
                                        onClick={() => setShowActivity(false)}
                                        className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                                            }`}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <ActivityFeed workspaceId={String(activeWorkspace?.id || '')} />
                            </div>
                        )}
                    </div>
                </main>

                {/* AI Copilot Panel */}
                <AICopilotPanel
                    isOpen={showCopilot}
                    onClose={() => setShowCopilot(false)}
                    dataset={activeDataset as any}
                    currentView="other"
                    onAsk={handleAskAI}
                />

                {/* Global Command Palette */}
                <CommandPalette
                    isOpen={showPalette}
                    onClose={() => setShowPalette(false)}
                />
            </div>
        </FilterProvider>
    );
};

export default MainLayout;
