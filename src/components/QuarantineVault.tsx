import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import { FixedSizeList as List } from 'react-window';

interface QuarantinedRow {
  id: string;
  row_number: number;
  original_data: Record<string, any>;
  reason: string;
  severity: 'error' | 'warning';
  created_at: string;
}

const QuarantineVault: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');
  const datasetId = searchParams.get('dataset');

  const [quarantinedRows, setQuarantinedRows] = useState<QuarantinedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<QuarantinedRow | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (workspaceId && datasetId && token) {
      loadQuarantinedRows();
    }
  }, [workspaceId, datasetId, token, page, pageSize, filterSeverity]);

  const loadQuarantinedRows = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/quarantine`,
        {
          params: {
            severity: filterSeverity === 'all' ? undefined : filterSeverity,
            limit: pageSize,
            offset: (page - 1) * pageSize
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setQuarantinedRows(response.data.rows || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      setError('Failed to load quarantined rows');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const releaseRow = async (rowId: string) => {
    try {
      await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/quarantine/${rowId}/release`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setQuarantinedRows(quarantinedRows.filter(r => r.id !== rowId));
      setTotal(total - 1);
      setSelectedRow(null);
    } catch (err) {
      setError(`Failed to release row: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const deleteQuarantinedRow = async (rowId: string) => {
    try {
      await axios.delete(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/quarantine/${rowId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setQuarantinedRows(quarantinedRows.filter(r => r.id !== rowId));
      setTotal(total - 1);
      setSelectedRow(null);
    } catch (err) {
      setError(`Failed to delete row: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const exportQuarantine = async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/quarantine/export`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quarantine-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      setError('Failed to export quarantine data');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = quarantinedRows[index];
    if (!row) return null;

    return (
      <div
        style={style}
        className="flex items-center px-6 py-4 border-b border-slate-200 dark:border-slate-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors"
        onClick={() => setSelectedRow(row)}
      >
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-900 dark:text-white">Row #{row.row_number}</p>
          <p className="text-[9px] text-slate-500 mt-1">{row.reason}</p>
        </div>
        <span className={`px-3 py-1 text-[9px] font-bold rounded-full uppercase ${
          row.severity === 'error'
            ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        }`}>
          {row.severity}
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto h-full flex gap-6 p-4 overflow-hidden">
      
      {/* Main List */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Header */}
        <div className="shrink-0">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Quarantine Vault</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Review and manage quarantined data rows</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-2xl p-6">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <label className="text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400">
              Filter:
              <select
                value={filterSeverity}
                onChange={(e) => {
                  setFilterSeverity(e.target.value as any);
                  setPage(1);
                }}
                className="ml-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold"
              >
                <option value="all">All</option>
                <option value="error">Errors Only</option>
                <option value="warning">Warnings Only</option>
              </select>
            </label>
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
              Showing {quarantinedRows.length} of {total}
            </span>
          </div>
          <button
            onClick={exportQuarantine}
            disabled={total === 0}
            className="px-4 py-2 bg-indigo-600 text-white text-[9px] font-bold rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            ⬇️ Export CSV
          </button>
        </div>

        {/* List */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">Loading...</p>
            </div>
          ) : total === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">No quarantined rows</p>
            </div>
          ) : (
            <>
              <List
                height={Math.max(300, window.innerHeight - 300)}
                itemCount={quarantinedRows.length}
                itemSize={80}
                width="100%"
              >
                {Row}
              </List>
            </>
          )}
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-4 flex justify-between items-center shrink-0">
            <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-[9px] font-bold"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-[9px] font-bold"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Panel */}
      <div className="w-96 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden flex flex-col shrink-0">
        {selectedRow ? (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">
                  Row #{selectedRow.row_number}
                </h3>
                <span className={`px-3 py-1 text-[8px] font-bold rounded-full uppercase ${
                  selectedRow.severity === 'error'
                    ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                  {selectedRow.severity}
                </span>
              </div>
              <p className="text-[9px] text-slate-600 dark:text-slate-400 font-bold">Reason:</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{selectedRow.reason}</p>
              <p className="text-[8px] text-slate-500 mt-4">
                {new Date(selectedRow.created_at).toLocaleString()}
              </p>
            </div>

            {/* Data Preview */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-4">Original Data</p>
              {Object.entries(selectedRow.original_data).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-700 dark:text-slate-300">{key}</p>
                  <div className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-slate-600 dark:text-slate-400 font-mono break-all">
                    {String(value ?? 'NULL')}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <button
                onClick={() => releaseRow(selectedRow.id)}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white text-[9px] font-bold rounded-lg hover:bg-emerald-500 transition-all uppercase tracking-widest"
              >
                ✓ Release
              </button>
              <button
                onClick={() => deleteQuarantinedRow(selectedRow.id)}
                className="flex-1 px-4 py-3 bg-rose-600 text-white text-[9px] font-bold rounded-lg hover:bg-rose-500 transition-all uppercase tracking-widest"
              >
                🗑️ Delete
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-center p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest">Select a row to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuarantineVault;
