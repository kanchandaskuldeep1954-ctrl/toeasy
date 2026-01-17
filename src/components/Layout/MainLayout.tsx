import React from 'react';
import Sidebar from './Sidebar';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden font-sans selection:bg-indigo-500/30">
            <Sidebar />
            <main className="flex-1 overflow-hidden relative flex flex-col min-w-0">
                {/* Optional TopBar could go here if needed, but Sidebar handles most context */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
