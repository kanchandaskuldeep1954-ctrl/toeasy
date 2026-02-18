import React from 'react';
import { NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { Table2, Search, Braces, GitBranch, BarChart3, FileText, CheckSquare } from 'lucide-react';
import { useDataset } from '../../hooks/useDataset';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useTheme } from '../../hooks/useTheme';

interface ToolTab {
  panel: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const DatasetToolTabs: React.FC = () => {
  const { activeDataset } = useDataset();
  const { activeWorkspace } = useWorkspace();
  const { theme } = useTheme();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const workspaceId = activeWorkspace?.id;
  const datasetId = searchParams.get('dataset') || (activeDataset as any)?.id;

  if (!workspaceId || !datasetId) return null;

  const queryPrefix = `?workspace=${workspaceId}&dataset=${datasetId}`;
  const tools: ToolTab[] = [
    { panel: 'sheets', label: 'Sheets', icon: <Table2 className="w-4 h-4" />, path: `/app/studio${queryPrefix}&panel=sheets` },
    { panel: 'query', label: 'Query', icon: <Search className="w-4 h-4" />, path: `/app/studio${queryPrefix}&panel=query` },
    { panel: 'script', label: 'Script', icon: <Braces className="w-4 h-4" />, path: `/app/studio${queryPrefix}&panel=script` },
    { panel: 'pivot', label: 'Pivot', icon: <GitBranch className="w-4 h-4" />, path: `/app/studio${queryPrefix}&panel=pivot` },
    { panel: 'visuals', label: 'Visuals', icon: <BarChart3 className="w-4 h-4" />, path: `/app/studio${queryPrefix}&panel=visuals` },
    { panel: 'report', label: 'Report', icon: <FileText className="w-4 h-4" />, path: `/app/studio${queryPrefix}&panel=report` },
    { panel: 'actions', label: 'Actions', icon: <CheckSquare className="w-4 h-4" />, path: `/app/studio${queryPrefix}&panel=actions` }
  ];

  const isActive = (panel: string) =>
    location.pathname.includes('/app/studio') && searchParams.get('panel') === panel;

  return (
    <div className={`flex items-center gap-1 px-4 h-10 ${theme === 'dark' ? 'bg-slate-900/60' : 'bg-white'}`}>
      <div className={`flex items-center gap-2 mr-3 pr-3 border-r ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className={`text-xs font-bold truncate max-w-[150px] ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
          {(activeDataset as any)?.name || `Dataset #${datasetId}`}
        </span>
      </div>

      {tools.map((tab) => {
        const active = isActive(tab.panel);
        return (
          <NavLink
            key={tab.panel}
            to={tab.path}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              active
                ? theme === 'dark'
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
                : theme === 'dark'
                  ? 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-white'
                  : 'text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
};

export default DatasetToolTabs;
