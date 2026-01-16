import React, { useState, useEffect, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
}

const DataPreview: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');
  const datasetId = searchParams.get('dataset');

  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (workspaceId && datasetId && token) {
      loadData();
    }
  }, [workspaceId, datasetId, token, currentPage, rowsPerPage]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/preview`,
        {
          params: {
            limit: rowsPerPage,
            offset: (currentPage - 1) * rowsPerPage
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setData(response.data.data || []);
      setColumns(response.data.columns || []);
      setTotalRows(response.data.total_rows || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      console.error('Data preview error:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const columnWidth = Math.max(150, Math.floor(1200 / columns.length));

  // Row renderer for virtualized list
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = data[index];
    if (!row) return null;

    return (
      <div
        style={style}
        className="flex border-b border-slate-200 dark:border-slate-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors"
      >
        {columns.map(col => (
          <div
            key={col.name}
            className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ minWidth: columnWidth }}
            title={String(row[col.name] ?? '')}
          >
            {row[col.name] ?? <span className="text-slate-300">NULL</span>}
          </div>
        ))}
      </div>
    );
  };

  if (!workspaceId || !datasetId) {
    return (
      <div className="p-8 text-center opacity-50">
        <p className="text-sm font-bold">Select a dataset to view preview</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Data Preview</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{totalRows.toLocaleString()} rows total</p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-2xl p-6">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <label className="text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400">
            Rows per page:
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="ml-2 px-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
            </select>
          </label>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-600 dark:text-slate-400">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            ← Previous
          </button>

          <span className="px-4">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Table Header (Sticky) */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-t-2xl border border-b-0 border-slate-200 dark:border-slate-700 flex sticky top-0 z-10 shadow-sm">
        {columns.map(col => (
          <div
            key={col.name}
            className="px-4 py-3 text-[9px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest"
            style={{ minWidth: columnWidth }}
          >
            <div>{col.name}</div>
            <div className="text-[8px] font-medium text-slate-500 dark:text-slate-400">{col.type}</div>
          </div>
        ))}
      </div>

      {/* Virtualized Table Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 rounded-b-2xl border border-t-0 border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      ) : data.length > 0 ? (
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-b-2xl border border-t-0 border-slate-200 dark:border-slate-700 overflow-hidden">
          <List
            height={Math.max(200, window.innerHeight - 400)}
            itemCount={data.length}
            itemSize={44}
            width="100%"
          >
            {Row}
          </List>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 rounded-b-2xl border border-t-0 border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-400">No data to display</p>
        </div>
      )}
    </div>
  );
};

export default DataPreview;
