import React from 'react';
import Sidebar from './Sidebar';
import WorkspaceTabs from '../WorkspaceTabs';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const [mobileOpen, setMobileOpen] = React.useState(false);

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
                </div>

                {/* Perspective Tabs Bar */}
                <WorkspaceTabs />

                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
