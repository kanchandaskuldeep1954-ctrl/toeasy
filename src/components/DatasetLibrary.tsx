import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace, useWorkspaceNavigation } from '../hooks/useWorkspace';
import { useDataset, useDatasetNavigation } from '../hooks/useDataset';
import { Dataset } from '../context/DatasetContext'; // Import interface
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LayoutGrid, List as ListIcon, Search, Filter, FileSpreadsheet, Database, Clock, Star, MoreVertical, Trash2, Download, ExternalLink, FileText, Folder } from 'lucide-react';

export const DatasetLibrary: React.FC = () => {
  const { user, token } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const {
    datasets,
    total,
    setActiveDataset,
    removeDataset,
    isLoading: loading,
    error: contextError,
    fetchDatasets
  } = useDataset();
  const { buildPath: buildWorkspacePath } = useWorkspaceNavigation();
  const { buildPath: buildDatasetPath } = useDatasetNavigation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const workspaceId = activeWorkspace?.id || searchParams.get('workspace');

  const [localError, setLocalError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12); // Grid friendly
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [activeFolder, setActiveFolder] = useState('all');
  const [newDatasetId, setNewDatasetId] = useState<string | null>(searchParams.get('new'));

  const error = localError || contextError;

  useEffect(() => {
    if (!workspaceId) {
      navigate('/app/workspaces');
      return;
    }
    fetchDatasets(workspaceId.toString(), pageSize, (page - 1) * pageSize);
  }, [workspaceId, page, pageSize, fetchDatasets]);

  const handleDeleteDataset = async (id: number) => {
    if (!window.confirm('Delete this asset? This action cannot be undone.')) return;
    try {
      setLocalError(null);
      await removeDataset(id);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to delete dataset');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (filename: string | undefined, type?: string) => {
    if (!filename) return <Database className="w-8 h-8 text-slate-400" />;
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) return <FileSpreadsheet className="w-8 h-8 text-emerald-500" />;
    if (filename.endsWith('.csv')) return <FileText className="w-8 h-8 text-blue-500" />;
    if (filename.endsWith('.json')) return <Database className="w-8 h-8 text-amber-500" />;
    return <Database className="w-8 h-8 text-slate-400" />;
  };

  // Client-side filtering for search/type (since API might not support it yet)
  const filteredDatasets = datasets.filter((d: Dataset) => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.file_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' ? true :
      filterType === 'excel' ? (d.file_name?.endsWith('xlsx') || d.file_name?.endsWith('xls')) :
        filterType === 'csv' ? d.file_name?.endsWith('csv') : true;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading assets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">

      {/* Sidebar (File Manager Style) */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden md:flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">🗄️</div>
            Library
          </h2>
        </div>

        <div className="px-4 space-y-1 flex-1">
          <button onClick={() => setActiveFolder('all')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeFolder === 'all' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <Folder className="w-4 h-4" /> All Assets
          </button>
          <button onClick={() => setActiveFolder('recent')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeFolder === 'recent' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <Clock className="w-4 h-4" /> Recent
          </button>
          <button onClick={() => setActiveFolder('starred')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeFolder === 'starred' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <Star className="w-4 h-4" /> Favorites
          </button>
          <div className="pt-4 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider px-4">Tags</div>
          <button onClick={() => setFilterType('excel')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${filterType === 'excel' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'text-slate-600 dark:text-slate-400'}`}>
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Excel Sheets
          </button>
          <button onClick={() => setFilterType('csv')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${filterType === 'csv' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-slate-600 dark:text-slate-400'}`}>
            <div className="w-2 h-2 rounded-full bg-blue-500"></div> CSV Data
          </button>
        </div>

        {/* Storage Meter (Mock) */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
            <span>Storage</span>
            <span>12% used</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full" style={{ width: '12%' }}></div>
          </div>
          <button className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Top Bar */}
        <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-xl flex items-center justify-between z-10">

          {/* Search */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}>
                <ListIcon className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => navigate(buildWorkspacePath('/app/upload'))}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
            >
              + New Upload
            </button>
          </div>
        </div>

        {/* Assets Area */}
        <div className="flex-1 overflow-y-auto p-8">

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 flex items-center gap-3">
              <span>⚠️ {error}</span>
            </div>
          )}

          {filteredDatasets.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
                <Folder className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No assets found</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
                {searchQuery ? `No results for "${searchQuery}"` : "Upload a dataset to get started with your analysis"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => navigate(buildWorkspacePath('/app/upload'))}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700"
                >
                  Upload File
                </button>
              )}
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredDatasets.map((dataset: Dataset) => (
                    <div
                      key={dataset.id}
                      onClick={() => {
                        setActiveDataset(dataset);
                        const targetWorkspaceId = dataset.workspace_id || workspaceId;
                        navigate(`/app/clean?workspace=${targetWorkspaceId}&dataset=${dataset.id}`);
                      }}
                      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-xl transition-all relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                          {getFileIcon(dataset.file_name, dataset.sourceType)}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); /* Add menu logic */ }}
                          className="text-slate-300 hover:text-slate-500 dark:hover:text-slate-200 p-1"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white mb-1 truncate" title={dataset.name}>{dataset.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 truncate">{dataset.file_name}</p>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{formatBytes(dataset.file_size)}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(dataset.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Name</th>
                        <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Size</th>
                        <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Records</th>
                        <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Modified</th>
                        <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredDatasets.map((dataset: Dataset) => (
                        <tr
                          key={dataset.id}
                          onClick={() => {
                            setActiveDataset(dataset);
                            const targetWorkspaceId = dataset.workspace_id || workspaceId;
                            navigate(`/app/clean?workspace=${targetWorkspaceId}&dataset=${dataset.id}`);
                          }}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                                {getFileIcon(dataset.file_name)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{dataset.name}</p>
                                <p className="text-xs text-slate-500">{dataset.file_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                            {formatBytes(dataset.file_size)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                            {/* Safe access for rowCount or row_count */}
                            {(dataset.rowCount || dataset.row_count || 0).toLocaleString()} rows
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                            {new Date(dataset.updated_at || dataset.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDataset(dataset.id); }}
                              className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Empty state for search */}
              {filteredDatasets.length === 0 && searchQuery && (
                <div className="text-center py-12">
                  <p className="text-slate-500">No matching assets found.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
