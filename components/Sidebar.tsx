
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../src/hooks/useAuth';
import { useWorkspaceNavigation } from '../src/hooks/useWorkspace';
import { useDatasetNavigation } from '../src/hooks/useDataset';

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  path: string;
  alwaysEnabled?: boolean;
}

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { buildPath: buildWorkspacePath } = useWorkspaceNavigation();
  const { buildPath: buildDatasetPath } = useDatasetNavigation();

  const menuItems: MenuItem[] = [
    { id: 'workspaces', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Workspaces', path: '/app/workspaces', alwaysEnabled: true },
    { id: 'upload', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12', label: 'Import', path: '/app/upload', alwaysEnabled: true },
    { id: 'create', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4', label: 'Create', path: '/app/create', alwaysEnabled: true },
    { id: 'clean', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Logic', path: '/app/clean' },
    { id: 'explore', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', label: 'Explore', path: '/app/explore' },
    { id: 'playground', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', label: 'Playground', path: '/app/playground' },
    { id: 'dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Dashboard', path: '/app/dashboard' },
    { id: 'report', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Report', path: '/app/report' },
    { id: 'billing', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Billing', path: '/app/billing', alwaysEnabled: true },
  ];

  const getActiveMenuItem = () => {
    const currentPath = location.pathname;
    return menuItems.find(item => currentPath.includes(item.path));
  };

  const activeItem = getActiveMenuItem();

  const handleNavigate = (path: string) => {
    // Pages that require dataset context (when dataset is selected)
    const datasetDependentPaths = ['/app/clean', '/app/explore', '/app/dashboard', '/app/report', '/app/playground'];
    // Pages that only require workspace context
    const workspaceDependentPaths = ['/app/upload', '/app/create'];

    if (datasetDependentPaths.some(p => path.includes(p))) {
      navigate(buildDatasetPath(path));
    } else if (workspaceDependentPaths.some(p => path.includes(p))) {
      navigate(buildWorkspacePath(path));
    } else {
      navigate(path);
    }
  };

  return (
    <aside className="hidden lg:flex w-20 xl:w-64 flex-col bg-slate-900 border-r border-slate-800 shrink-0 transition-all duration-300">
      {/* Logo */}
      <div className="p-6 xl:p-8 flex justify-center xl:justify-start">
        <button
          onClick={() => navigate('/app/workspaces')}
          className="text-xl font-black tracking-tighter text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          T<span className="xl:inline hidden">oeasy</span>
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-2 space-y-2">
        {menuItems.map((item) => {
          const isActive = activeItem?.id === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={`w-full flex items-center justify-center xl:justify-start gap-3 px-3 py-3 xl:px-4 xl:py-2 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                }`}
              title={item.label}
            >
              <svg className="w-6 h-6 xl:w-5 xl:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={item.icon} />
              </svg>
              <span className="hidden xl:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 mt-auto border-t border-slate-800 space-y-3">
        {/* Profile Button */}
        <button
          onClick={() => navigate('/app/profile')}
          className="w-full hidden xl:flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.full_name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </button>

        {/* Mobile Profile Icon */}
        <button
          onClick={() => navigate('/app/profile')}
          className="xl:hidden w-full flex justify-center"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs hover:bg-indigo-700 transition-colors">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
