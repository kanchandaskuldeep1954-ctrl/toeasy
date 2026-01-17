import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useDataset, useDatasetNavigation } from '../../hooks/useDataset';
import { useTheme } from '../../hooks/useTheme';

const Sidebar: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const { activeWorkspace } = useWorkspace();
    const { activeDataset } = useDataset();
    const { theme, toggleTheme } = useTheme();
    const { buildPath } = useDatasetNavigation(); // Use the navigation hook
    const [collapsed, setCollapsed] = useState(false);

    const navGroups = [
        {
            title: 'Workspace',
            items: [
                { name: 'Home', path: '/app/workspaces', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                { name: 'Datasets', path: buildPath('/app/datasets'), icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
            ]
        },
        {
            title: 'Analysis',
            items: [
                { name: 'Clean', path: buildPath('/app/clean'), icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
                { name: 'Dashboard', path: buildPath('/app/dashboard'), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z' },
                { name: 'Report', path: buildPath('/app/report'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                { name: 'Dataflows', path: buildPath('/app/dataflows'), icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
            ]
        },
        {
            title: 'System',
            items: [
                { name: 'Billing', path: buildPath('/app/billing'), icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
                { name: 'Settings', path: buildPath('/app/profile'), icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
            ]
        }
    ];

    return (
        <aside className={`h-screen bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-50 relative ${collapsed ? 'w-20' : 'w-64'}`}>

            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg font-black shrink-0 shadow-lg shadow-indigo-500/30">
                    T
                </div>
                {!collapsed && (
                    <span className="ml-3 font-black text-xl tracking-tight text-slate-900 dark:text-white animate-in">
                        Toeasy<span className="text-indigo-600">.AI</span>
                    </span>
                )}
            </div>

            {/* Context Card (Active Workspace/Dataset) */}
            <div className="p-4 shrink-0">
                <div className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 shadow-sm ${collapsed ? 'flex justify-center' : ''}`}>
                    {!collapsed ? (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-5 h-5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-[10px] font-bold">W</div>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{activeWorkspace?.name || 'Workspace'}</p>
                            </div>
                            {activeDataset ? (
                                <div className="flex items-center gap-2 p-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                    <div className="w-4 h-4 rounded bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 flex items-center justify-center text-[8px] font-bold">D</div>
                                    <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 truncate">{activeDataset.name}</p>
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-400 italic pl-7">No dataset selected</p>
                            )}
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 font-bold text-xs" title={activeDataset?.name}>
                            {activeDataset ? 'D' : 'W'}
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6 custom-scrollbar">
                {navGroups.map((group, idx) => (
                    <div key={idx}>
                        {!collapsed && <h3 className="px-3 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{group.title}</h3>}
                        <div className="space-y-1">
                            {group.items.map(item => {
                                // Important: Check active status against absolute path (ignoring params)
                                const active = location.pathname.includes(item.path.split('?')[0]);
                                return (
                                    <NavLink
                                        key={item.name} // Use name as key since path is dynamic
                                        to={item.path}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${active
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                        title={collapsed ? item.name : ''}
                                    >
                                        <svg className={`w-5 h-5 shrink-0 ${active ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                        </svg>
                                        {!collapsed && (
                                            <span className="text-sm font-bold tracking-tight">{item.name}</span>
                                        )}
                                        {active && !collapsed && (
                                            <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white shadow-sm"></div>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* User Profile Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <button
                    onClick={toggleTheme}
                    className={`mb-4 w-full flex items-center gap-3 p-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors ${theme === 'dark'
                        ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700'
                        : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                        } ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode` : ''}
                >
                    {theme === 'dark' ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    )}
                    {!collapsed && (
                        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    )}
                </button>

                <button
                    onClick={() => navigate('/app/profile')}
                    className={`flex items-center gap-3 w-full p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center' : ''}`}
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                        {user?.email?.[0].toUpperCase() || 'U'}
                    </div>
                    {!collapsed && (
                        <div className="text-left overflow-hidden">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{user?.email?.split('@')[0]}</p>
                            <p className="text-[10px] text-slate-400 truncate">Pro Plan</p>
                        </div>
                    )}
                </button>
                {!collapsed && (
                    <button
                        onClick={logout}
                        className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold uppercase text-slate-400 hover:text-rose-500 transition-colors"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sign Out
                    </button>
                )}
            </div>

            {/* Collapse Toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-500 shadow-md hover:scale-110 transition-transform z-50 hidden md:flex"
            >
                <svg className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
        </aside>
    );
};

export default Sidebar;
