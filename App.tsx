
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import UploadView from './components/UploadView';
import CleanView from './components/CleanView';
import ExploreView from './components/ExploreView';
import DashboardView from './components/DashboardView';
import ReportView from './components/ReportView';
import BillingView from './components/BillingView';
import PlaygroundView from './components/PlaygroundView';
import { Dataset, AppView, DataRow, ColumnStats, SourceType, Subscription, UserUsage } from './types';

const AppContent: React.FC = () => {
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [subscription, setSubscription] = useState<Subscription>({
    tier: 'pro',
    interval: 'month',
    status: 'active',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
  
  const [usage, setUsage] = useState<UserUsage>({
    rowsProcessed: 12450,
    aiQueriesUsed: 84,
    connectorsCount: 3
  });

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleDataLoaded = (data: DataRow[], name: string, sourceType: SourceType = 'csv') => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const stats: ColumnStats[] = headers.map(header => {
      const values = data.map(row => row[header]).filter(v => v !== null && v !== undefined && v !== '');
      const uniqueValues = new Set(values).size;
      const missingValues = data.length - values.length;
      const isNumeric = values.every(v => typeof v !== 'boolean' && !isNaN(Number(v)) && v !== '');
      return { column: header, type: isNumeric ? 'numeric' : 'categorical', uniqueValues, missingValues };
    });

    setActiveDataset({ name, sourceType, headers, data, originalData: [...data], stats });
    setUsage(prev => ({ ...prev, rowsProcessed: prev.rowsProcessed + data.length, connectorsCount: prev.connectorsCount + 1 }));
    navigate('/clean');
  };

  const handleUpdateDataset = (updated: Dataset) => setActiveDataset(updated);
  const trackAIUsage = () => setUsage(prev => ({ ...prev, aiQueriesUsed: prev.aiQueriesUsed + 1 }));
  const currentView = location.pathname.split('/')[1] as AppView || 'upload';

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <Sidebar activeView={currentView} hasData={!!activeDataset} usage={usage} tier={subscription.tier} />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-4">
            {activeDataset ? (
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm">DS</div>
                 <div className="flex flex-col">
                    <span className="text-sm font-bold truncate max-w-[200px]">{activeDataset.name}</span>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{activeDataset.data.length.toLocaleString()} rows</span>
                 </div>
              </div>
            ) : (
              <span className="text-sm font-bold text-slate-400 dark:text-slate-600">No active dataset</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
              title="Toggle Theme"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              )}
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
               <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
               <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">AI Online</span>
            </div>
            <button 
              onClick={() => navigate('/billing')}
              className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all"
            >
              {subscription.tier}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50 dark:bg-slate-950">
           <Routes>
             <Route path="/" element={<UploadView onDataLoaded={handleDataLoaded} />} />
             <Route path="/upload" element={<UploadView onDataLoaded={handleDataLoaded} />} />
             <Route path="/clean" element={activeDataset ? <CleanView dataset={activeDataset} onUpdate={handleUpdateDataset} onAIAction={trackAIUsage} /> : <RedirectToUpload />} />
             <Route path="/playground" element={activeDataset ? <PlaygroundView dataset={activeDataset} onAIAction={trackAIUsage} /> : <RedirectToUpload />} />
             <Route path="/explore" element={activeDataset ? <ExploreView dataset={activeDataset} onAIAction={trackAIUsage} /> : <RedirectToUpload />} />
             <Route path="/dashboard" element={activeDataset ? <DashboardView dataset={activeDataset} onAIAction={trackAIUsage} /> : <RedirectToUpload />} />
             <Route path="/report" element={activeDataset ? <ReportView dataset={activeDataset} onAIAction={trackAIUsage} /> : <RedirectToUpload />} />
             <Route path="/billing" element={<BillingView subscription={subscription} usage={usage} onUpgrade={(tier, interval) => setSubscription({ tier, interval, status: 'active', expiresAt: new Date() })} />} />
           </Routes>
        </div>
      </main>
    </div>
  );
};

const RedirectToUpload = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate('/upload'); }, [navigate]);
  return null;
};

const App: React.FC = () => <Router><AppContent /></Router>;
export default App;
