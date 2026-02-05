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
import WorkspaceTabs from '../WorkspaceTabs';
import { ActivityFeed } from '../Activity/ActivityFeed';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useDataset } from '../../hooks/useDataset';
import { useAuth } from '../../hooks/useAuth';
import { Activity, X, Bell, Sparkles, ChevronRight, MessageCircle } from 'lucide-react';
import { FilterProvider } from '../../context/FilterContext';
import AICopilotPanel from '../AICopilot/AICopilotPanel';
import FloatingCopilot from '../AICopilot/FloatingCopilot';
import { GroqService } from '../../services/groqService';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showActivity, setShowActivity] = useState(false);
    const [showCopilot, setShowCopilot] = useState(false);
    const { activeWorkspace } = useWorkspace();
    const { activeDataset } = useDataset();
    const { user } = useAuth();

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
            <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans selection:bg-indigo-500/30">
                <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

                <main className="flex-1 overflow-hidden relative flex flex-col min-w-0">
                    {/* Premium Header Bar */}
                    <header className="h-14 border-b border-white/5 bg-gradient-to-r from-slate-900/80 via-slate-900/90 to-slate-900/80 backdrop-blur-xl flex items-center px-4 shrink-0 gap-3 relative z-10">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>

                        {/* Breadcrumb Context */}
                        <div className="hidden md:flex items-center gap-2 text-sm">
                            <span className="text-slate-500">{activeWorkspace?.name || 'Workspace'}</span>
                            {activeDataset && (
                                <>
                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                    <span className="text-white font-medium flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        {activeDataset.name}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Right Side Actions */}
                        <div className="ml-auto flex items-center gap-2">
                            {/* AI Copilot Button */}
                            <button
                                onClick={() => setShowCopilot(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-500/30 transition-all hover:scale-105"
                            >
                                <MessageCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">Ask AI</span>
                            </button>

                            {/* AI Status Indicator */}
                            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-full">
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-medium text-indigo-300">AI Ready</span>
                            </div>

                            {/* Notifications */}
                            <button className="relative p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            </button>

                            {/* Activity Toggle */}
                            <button
                                onClick={() => setShowActivity(!showActivity)}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${showActivity
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Activity className="w-4 h-4" />
                                <span className="hidden lg:inline">Activity</span>
                            </button>

                            {/* User Avatar */}
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-indigo-500/30 cursor-pointer hover:scale-105 transition-transform">
                                {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                        </div>
                    </header>

                    {/* Perspective Tabs Bar - Premium Style */}
                    <div className="flex items-center bg-slate-900/50 border-b border-white/5">
                        <WorkspaceTabs />
                    </div>

                    {/* Main Content Area with Premium Background */}
                    <div className="flex flex-1 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950">
                        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                            {/* Subtle grid pattern overlay */}
                            <div className="relative">
                                <div
                                    className="absolute inset-0 opacity-[0.02] pointer-events-none"
                                    style={{
                                        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                                        backgroundSize: '40px 40px'
                                    }}
                                />
                                {children}
                            </div>
                        </div>

                        {/* Activity Feed Sidebar - Premium Style */}
                        {showActivity && (
                            <div className="w-80 border-l border-white/5 bg-slate-900/80 backdrop-blur-xl h-full shadow-2xl z-20 absolute right-0 top-0 lg:static lg:shadow-none animate-in slide-in-from-right duration-300">
                                <div className="lg:hidden absolute top-3 right-3 z-10">
                                    <button
                                        onClick={() => setShowActivity(false)}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
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

                {/* Floating AI Copilot (enhanced, always visible) */}
                <FloatingCopilot
                    context={activeDataset ? 'sheets' : 'general'}
                    contextData={activeDataset}
                />
            </div>
        </FilterProvider>
    );
};

export default MainLayout;
