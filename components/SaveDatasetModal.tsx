import React, { useState } from 'react';
import { DataRow, SourceType } from '../types';

interface SaveDatasetModalProps {
  isOpen: boolean;
  data: DataRow[];
  topic: string;
  onSave: (name: string, description: string) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

const SaveDatasetModal: React.FC<SaveDatasetModalProps> = ({ 
  isOpen, 
  data, 
  topic, 
  onSave, 
  onCancel,
  isSaving = false 
}) => {
  const [name, setName] = useState(topic.replace(/\s+/g, '_').toLowerCase());
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Dataset name is required');
      return;
    }

    try {
      await onSave(name.trim(), description.trim());
    } catch (err: any) {
      setError(err.message || 'Failed to save dataset');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-8 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">Save Dataset</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.length} rows ready to save
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Input */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-500 tracking-widest">
              Dataset Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. real_estate_miami_2024"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              disabled={isSaving}
            />
            <p className="text-xs text-slate-400">
              Only letters, numbers, and underscores allowed
            </p>
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-500 tracking-widest">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this dataset..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
              disabled={isSaving}
            />
          </div>

          {/* Info Box */}
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
            <div className="flex gap-2">
              <div className="text-xl">ℹ️</div>
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <p className="font-semibold">Dataset will be saved with:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><strong>{data.length}</strong> rows</li>
                  <li><strong>{Object.keys(data[0] || {}).length}</strong> columns</li>
                  <li>Source: <strong>AI Generated</strong></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">❌ {error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  ✅ Save Dataset
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveDatasetModal;
