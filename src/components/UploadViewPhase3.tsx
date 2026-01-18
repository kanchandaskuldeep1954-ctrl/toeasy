import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { datasetAPI } from '../services/api';

export const UploadViewPhase3: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace') || '';

  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (!workspaceId) {
      setError('No workspace selected. Please select a workspace first.');
    }
  }, [workspaceId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.includes('csv') || droppedFile.type.includes('json')) {
        setFile(droppedFile);
        setDatasetName(droppedFile.name.replace(/\.[^.]+$/, ''));
        setError(null);
      } else {
        setError('Please upload a CSV or JSON file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type.includes('csv') || selectedFile.type.includes('json')) {
        setFile(selectedFile);
        setDatasetName(selectedFile.name.replace(/\.[^.]+$/, ''));
        setError(null);
      } else {
        setError('Please upload a CSV or JSON file');
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!datasetName.trim()) {
      setError('Please enter a dataset name');
      return;
    }

    if (!workspaceId) {
      setError('Workspace not selected');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Parse file based on type
      const fileText = await file.text();
      let data: any[] = [];
      let headers: string[] = [];

      if (file.type.includes('csv') || file.name.endsWith('.csv')) {
        // Parse CSV
        const lines = fileText.trim().split('\n');
        if (lines.length === 0) {
          setError('CSV file is empty');
          return;
        }

        headers = lines[0].split(',').map(h => h.trim());
        data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header] = values[i] || null;
          });
          return obj;
        });
      } else if (file.type.includes('json') || file.name.endsWith('.json')) {
        // Parse JSON
        data = JSON.parse(fileText);
        if (!Array.isArray(data)) {
          data = [data];
        }
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        }
      }

      if (data.length === 0) {
        setError('File contains no data');
        return;
      }

      // Send parsed data as JSON
      const response = await axios.post(
        `${backendUrl}/workspaces/${workspaceId}/datasets`,
        {
          name: datasetName,
          data: data,
          headers: headers
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Success - redirect to explore view
      setFile(null);
      setDatasetName('');
      navigate(`/app/clean?workspace=${workspaceId}&dataset=${response.data.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload dataset';
      setError(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Upload Dataset</h1>
          <p className="text-slate-400">Import CSV or JSON files to your workspace</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200">
            {error}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
          <form onSubmit={handleUpload} className="space-y-6">
            {/* File Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive
                  ? 'border-indigo-500 bg-indigo-600/10'
                  : 'border-slate-700 hover:border-slate-600'
                }`}
            >
              {file ? (
                <div className="space-y-3">
                  <svg
                    className="w-12 h-12 mx-auto text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <p className="text-white font-semibold">{file.name}</p>
                  <p className="text-sm text-slate-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <svg
                    className="w-12 h-12 mx-auto text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <p className="text-white font-semibold">Drag and drop your file</p>
                  <p className="text-sm text-slate-400">or click to browse</p>
                  <p className="text-xs text-slate-500">CSV or JSON files up to 500MB</p>
                </div>
              )}
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Dataset Name */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Dataset Name*</label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="e.g., Customer Sales Q4"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Progress Bar */}
            {uploading && uploadProgress > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-slate-400">Upload Progress</label>
                  <span className="text-sm text-indigo-400 font-semibold">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
            >
              {uploading ? `Uploading... ${uploadProgress}%` : 'Upload Dataset'}
            </button>
          </form>

          {/* Info Box */}
          <div className="mt-8 pt-8 border-t border-slate-800 space-y-3">
            <p className="text-sm text-slate-300 font-semibold">Supported Formats:</p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• CSV with headers in first row</li>
              <li>• JSON with array of objects</li>
              <li>• Maximum file size: 500MB</li>
              <li>• Maximum rows: 10,000,000</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
