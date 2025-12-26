
import React from 'react';
import { Link } from 'react-router-dom';
import { AppView, UserUsage, PlanTier } from '../types';

interface SidebarProps {
  activeView: AppView;
  hasData: boolean;
  usage: UserUsage;
  tier: PlanTier;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, hasData, usage, tier }) => {
  const menuItems = [
    { id: 'upload', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12', label: 'Import', path: '/upload', alwaysEnabled: true },
    { id: 'clean', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Clean', path: '/clean' },
    { id: 'explore', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', label: 'Analyze', path: '/explore' },
    { id: 'playground', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', label: 'SQL', path: '/playground' },
    { id: 'dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Charts', path: '/dashboard' },
    { id: 'report', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Report', path: '/report' },
  ];

  return (
    <aside className="w-56 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0">
      <div className="p-8">
         <h1 className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">Toeasy<span className="text-slate-900 dark:text-white">AI</span></h1>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        {menuItems.map((item) => {
          const isActive = activeView === item.id;
          const isEnabled = hasData || item.alwaysEnabled;
          return (
            <Link
              key={item.id}
              to={isEnabled ? item.path : '#'}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                  : isEnabled 
                    ? 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white' 
                    : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
              }`}
            >
              <svg className={`w-5 h-5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
              {!isEnabled && <svg className="w-3 h-3 ml-auto text-slate-200 dark:text-slate-800" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase">Usage</span>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{(usage.aiQueriesUsed / 100 * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
             <div className="h-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${Math.min(100, usage.aiQueriesUsed)}%` }}></div>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Rows: {usage.rowsProcessed.toLocaleString()}</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
