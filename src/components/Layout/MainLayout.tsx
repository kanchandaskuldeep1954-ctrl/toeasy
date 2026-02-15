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
                    <header className={`h-16 border-b shrink-0 flex items-center justify-between px-6 gap-4 relative z-10 backdrop-blur-xl transition-all duration-300 ${theme === 'dark'
                        ? 'border-white/5 bg-slate-900/90 text-white'
                        : 'border-slate-200 bg-white/80 text-slate-900'
                        }`}>

                        {/* LEFT SECTION: Mobile Menu & Context */}
                        <div className="flex items-center gap-4">
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
                            <div className="hidden md:flex items-center gap-3 text-sm">
                                <span className={`font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{activeWorkspace?.name || 'Workspace'}</span>
                                {activeDataset && (
                                    <>
                                        <ChevronRight className="w-4 h-4 text-slate-500/50" />
                                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
                                            }`}>
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                            <span className="font-medium">{activeDataset.name}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* RIGHT SECTION: Search & Actions */}
                        <div className="flex items-center gap-3 lg:gap-4">
                            {/* Search Bar */}
                            <button
                                onClick={() => setShowPalette(true)}
                                className={`hidden md:flex items-center gap-3 px-4 py-2 rounded-xl text-sm transition-all duration-200 group border ${theme === 'dark'
                                    ? 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-600 hover:shadow-lg hover:shadow-indigo-500/10'
                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white hover:border-slate-300 hover:shadow-sm'
                                    }`}
                            >
                                <Search className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                                <span className="pr-8">Search...</span>
                                <kbd className={`hidden lg:inline px-2 py-0.5 text-xs font-mono rounded border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-500'
                                    }`}>⌘K</kbd>
                            </button>

                            <div className="h-6 w-px bg-slate-200/50 dark:bg-slate-700/50 mx-1" />

                            {/* AI Copilot Button */}
                            <button
                                onClick={() => setShowCopilot(true)}
                                className="group relative flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-200 hover:-translate-y-0.5"
                            >
                                <MessageCircle className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
                                <span className="hidden sm:inline">Ask AI</span>
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
                                </span>
                            </button>

                            {/* Notifications */}
                            <NotificationCenter />

                            {/* Activity Toggle */}
                            <button
                                onClick={() => setShowActivity(!showActivity)}
                                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${showActivity
                                    ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                                    : theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                            >
                                <Activity className="w-4 h-4" />
                            </button>

                            {/* User Avatar */}
                            <div className="w-9 h-9 ml-1 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-500/20 ring-2 ring-white/10 cursor-pointer hover:ring-indigo-500/50 transition-all duration-200">
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
