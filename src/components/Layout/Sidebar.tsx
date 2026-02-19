import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useDataset } from '../../hooks/useDataset';
import { useWorkspaceNavigation } from '../../hooks/useWorkspace';
import { useTheme } from '../../hooks/useTheme';
import { StudioNavigationState, studioAPI } from '../../services/api';

interface SidebarProps {
    mobileOpen?: boolean;
    onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { logout, user } = useAuth();
    const { activeWorkspace } = useWorkspace();
    const { activeDataset } = useDataset();
    const { theme, toggleTheme } = useTheme();
    const { buildPath: buildWorkspacePath } = useWorkspaceNavigation();
    const [collapsed, setCollapsed] = useState(false);
    const [navigationState, setNavigationState] = useState<StudioNavigationState | null>(null);

    const workspaceId = activeWorkspace?.id || searchParams.get('workspace');
    const datasetId = searchParams.get('dataset') || String(activeDataset?.id || navigationState?.active?.datasetId || '');
    const projectId = searchParams.get('project') || (navigationState?.active?.projectId ? String(navigationState.active.projectId) : '');
    const roomId = searchParams.get('room') || (navigationState?.active?.roomId ? String(navigationState.active.roomId) : '');

    useEffect(() => {
        if (!workspaceId) {
            setNavigationState(null);
            return;
        }

        let cancelled = false;
        const loadNavigation = async () => {
            try {
                const response = await studioAPI.getNavigationState(String(workspaceId));
                if (!cancelled) {
                    setNavigationState(response.data || null);
                }
            } catch {
                if (!cancelled) {
                    setNavigationState(null);
                }
            }
        };

        loadNavigation();
        return () => {
            cancelled = true;
        };
    }, [workspaceId, location.pathname, location.search]);

    const activeRoom = useMemo(() => {
        if (!roomId || !navigationState?.rooms?.length) return null;
        return navigationState.rooms.find((room) => String(room.id) === String(roomId)) || null;
    }, [navigationState?.rooms, roomId]);

    const activeProject = useMemo(() => {
        if (!projectId || !navigationState?.projects?.length) return null;
        return navigationState.projects.find((project) => String(project.id) === String(projectId)) || null;
    }, [navigationState?.projects, projectId]);

    const recentRooms = useMemo(() => (navigationState?.rooms || []).slice(0, 5), [navigationState?.rooms]);

    const buildStudioPath = (panel: string = 'sheets', roomOverride?: { roomId?: number; projectId?: number }) => {
        const query = new URLSearchParams();
        if (workspaceId) query.set('workspace', String(workspaceId));
        if (datasetId) query.set('dataset', String(datasetId));
        if (roomOverride?.projectId) query.set('project', String(roomOverride.projectId));
        else if (projectId) query.set('project', String(projectId));
        if (roomOverride?.roomId) query.set('room', String(roomOverride.roomId));
        else if (roomId) query.set('room', String(roomId));
        query.set('panel', panel);
        return `/app/studio?${query.toString()}`;
    };

    const buildControlTowerPath = () => {
        const query = new URLSearchParams();
        if (workspaceId) query.set('workspace', String(workspaceId));
        if (datasetId) query.set('dataset', String(datasetId));
        if (projectId) query.set('project', String(projectId));
        if (roomId) query.set('room', String(roomId));
        return `/app/control-tower?${query.toString()}`;
    };

    const navItems = [
        { name: 'Home', path: '/app/home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { name: 'Decision Room', path: buildStudioPath('sheets'), icon: 'M4 5h7v7H4V5zm9 0h7v4h-7V5zM4 14h7v5H4v-5zm9-3h7v8h-7v-8z' },
        { name: 'Control Tower', path: buildControlTowerPath(), icon: 'M9 3h6v4H9V3zm-5 6h16v10H4V9zm3 2v6h10v-6H7z' },
        { name: 'Data', path: buildWorkspacePath('/app/datasets'), icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
        { name: 'Chat', path: buildWorkspacePath('/app/chat'), icon: 'M8 10h8M8 14h5m6 7l-4-4H6a2 2 0 01-2-2V7a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
        { name: 'Team', path: '/app/team', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
        { name: 'Settings', path: buildWorkspacePath('/app/profile'), icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    ];

    return (
        <>
            {/* Mobile Backdrop */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={`
                fixed lg:static top-0 left-0 h-full z-50
                bg-slate-950 border-r border-slate-800 
                transition-transform duration-300 ease-in-out
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                ${collapsed ? 'lg:w-20' : 'w-64 lg:w-64'}
                flex flex-col
            `}>

                {/* Logo Area */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-lg font-black shrink-0">
                            T
                        </div>
                        {(!collapsed || mobileOpen) && (
                            <span className="ml-3 font-black text-xl tracking-tight text-slate-900 dark:text-white animate-in">
                                Toeasy
                            </span>
                        )}
                    </div>
                    {/* Mobile Close Button */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 -mr-2 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
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
                                <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 space-y-1 pl-7">
                                    <div>Project: {activeProject?.name || 'Not selected'}</div>
                                    <div>Room: {activeRoom?.name || 'Not selected'}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 font-bold text-xs" title={activeDataset?.name}>
                                {activeDataset ? 'D' : 'W'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation — Clean & Focused */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
                    {/* Primary Nav */}
                    <div className="space-y-1">
                        {navItems.map(item => {
                            const pathBase = (item.path || '').split('?')[0];
                            const active = pathBase && location.pathname.includes(pathBase);
                            return (
                                <NavLink
                                    key={item.name}
                                    to={item.path}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${active
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    title={collapsed ? item.name : ''}
                                >
                                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                    {/* Divider */}
                    {!collapsed && (
                        <div className="my-4 mx-3 border-t border-slate-800"></div>
                    )}

                    {/* Pinned Section */}
                    {!collapsed && (
                        <div>
                            <h3 className="px-3 text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                                Pinned
                            </h3>
                            <p className="px-3 text-[10px] text-slate-600 italic">No pinned items yet</p>
                        </div>
                    )}

                    {!collapsed && (
                        <div className="mt-4">
                            <h3 className="px-3 text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">
                                Recent Rooms
                            </h3>
                            <div className="space-y-1">
                                {recentRooms.length === 0 && (
                                    <p className="px-3 text-[10px] text-slate-600 italic">No rooms yet</p>
                                )}
                                {recentRooms.map((room) => (
                                    <button
                                        key={room.id}
                                        onClick={() => navigate(buildStudioPath('sheets', { roomId: room.id, projectId: room.projectId }))}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                                            String(room.id) === String(roomId)
                                                ? 'bg-slate-800 text-white'
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className="font-semibold truncate">{room.name}</div>
                                        <div className="text-[10px] text-slate-500 uppercase">{room.stage}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
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
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                            {user?.email?.[0].toUpperCase() || 'U'}
                        </div>
                        {!collapsed && (
                            <div className="text-left overflow-hidden">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{user?.email?.split('@')[0]}</p>
                                <p className="text-[10px] text-slate-400 truncate capitalize">{user?.tier === 'basic' ? 'Starter' : user?.tier} Plan</p>
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
            </aside >
        </>
    );
};

export default Sidebar;
