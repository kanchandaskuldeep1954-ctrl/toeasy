/**
 * ExportModal Component
 * Universal export dialog for datasets, dashboards, and reports
 */

import React, { useState } from 'react';

type ExportType = 'dataset' | 'dashboard' | 'report';
type ExportFormat =
    | 'csv' | 'json' | 'xlsx' | 'parquet' | 'sql'
    | 'pdf' | 'html' | 'png' | 'svg'
    | 'powerbi' | 'tableau';

interface ExportOption {
    format: ExportFormat;
    name: string;
    description: string;
    icon: string;
    available: ExportType[];
}

const EXPORT_OPTIONS: ExportOption[] = [
    // Data formats
    { format: 'csv', name: 'CSV', description: 'Comma-separated values', icon: '📄', available: ['dataset'] },
    { format: 'json', name: 'JSON', description: 'JavaScript Object Notation', icon: '{ }', available: ['dataset', 'dashboard'] },
    { format: 'xlsx', name: 'Excel', description: 'Microsoft Excel format', icon: '📊', available: ['dataset'] },
    { format: 'parquet', name: 'Parquet', description: 'Columnar storage format', icon: '🗄️', available: ['dataset'] },
    { format: 'sql', name: 'SQL', description: 'INSERT statements', icon: '💾', available: ['dataset'] },

    // Visual formats
    { format: 'pdf', name: 'PDF', description: 'Portable Document Format', icon: '📕', available: ['dashboard', 'report'] },
    { format: 'html', name: 'HTML', description: 'Standalone web page', icon: '🌐', available: ['dashboard', 'report'] },
    { format: 'png', name: 'PNG', description: 'Image format', icon: '🖼️', available: ['dashboard'] },
    { format: 'svg', name: 'SVG', description: 'Vector graphics', icon: '✨', available: ['dashboard'] },

    // BI Tools
    { format: 'powerbi', name: 'Power BI', description: '.pbix template or M Query', icon: '📈', available: ['dataset', 'dashboard'] },
    { format: 'tableau', name: 'Tableau', description: '.hyper or .twbx file', icon: '📉', available: ['dataset', 'dashboard'] },
];

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    exportType: ExportType;
    data?: any;
    filename?: string;
    onExport?: (format: ExportFormat, options: ExportOptions) => void;
}

interface ExportOptions {
    includeMetadata: boolean;
    includeHistory: boolean;
    cleaned: boolean;
}

const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    exportType,
    data,
    filename = 'export',
    onExport,
}) => {
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
    const [options, setOptions] = useState<ExportOptions>({
        includeMetadata: true,
        includeHistory: false,
        cleaned: true,
    });
    const [isExporting, setIsExporting] = useState(false);

    const availableFormats = EXPORT_OPTIONS.filter(opt => opt.available.includes(exportType));

    const handleExport = async () => {
        if (!selectedFormat) return;

        setIsExporting(true);

        try {
            // Generate export based on format
            let exportData: string | Blob;
            let mimeType: string;
            let extension: string;

            switch (selectedFormat) {
                case 'csv':
                    exportData = generateCSV(data);
                    mimeType = 'text/csv';
                    extension = 'csv';
                    break;
                case 'json':
                    exportData = JSON.stringify(data, null, 2);
                    mimeType = 'application/json';
                    extension = 'json';
                    break;
                case 'sql':
                    exportData = generateSQL(data, filename);
                    mimeType = 'text/plain';
                    extension = 'sql';
                    break;
                case 'html':
                    exportData = generateHTML(data, filename, exportType);
                    mimeType = 'text/html';
                    extension = 'html';
                    break;
                default:
                    // For complex formats, call the callback
                    if (onExport) {
                        onExport(selectedFormat, options);
                        setIsExporting(false);
                        onClose();
                        return;
                    }
                    throw new Error(`Export format ${selectedFormat} requires backend processing`);
            }

            // Trigger download
            const blob = new Blob([exportData], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}.${extension}`;
            link.click();
            URL.revokeObjectURL(url);

            onClose();
        } catch (err) {
            console.error('Export failed:', err);
            alert('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-white">Export {exportType}</h2>
                            <p className="text-sm text-slate-500 mt-1">Choose your preferred format</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Format Selection */}
                <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">
                        Select Format
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        {availableFormats.map(opt => (
                            <button
                                key={opt.format}
                                onClick={() => setSelectedFormat(opt.format)}
                                className={`
                  p-4 rounded-xl border text-left transition-all
                  ${selectedFormat === opt.format
                                        ? 'border-indigo-500 bg-indigo-500/10'
                                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                    }
                `}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{opt.icon}</span>
                                    <div>
                                        <p className="font-bold text-white">{opt.name}</p>
                                        <p className="text-xs text-slate-500">{opt.description}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Options */}
                {exportType === 'dataset' && (
                    <div className="px-6 pb-4 space-y-3">
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">
                            Options
                        </p>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={options.cleaned}
                                onChange={e => setOptions(prev => ({ ...prev, cleaned: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600"
                            />
                            <span className="text-sm text-slate-300">Export cleaned data (if available)</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={options.includeMetadata}
                                onChange={e => setOptions(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600"
                            />
                            <span className="text-sm text-slate-300">Include metadata (validation rules, etc.)</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={options.includeHistory}
                                onChange={e => setOptions(prev => ({ ...prev, includeHistory: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600"
                            />
                            <span className="text-sm text-slate-300">Include cleaning history</span>
                        </label>
                    </div>
                )}

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={!selectedFormat || isExporting}
                        className="px-6 py-2.5 text-sm font-black uppercase tracking-wide text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {isExporting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>Export</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper functions

function generateCSV(data: any[]): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]).filter(k => !k.startsWith('__'));
    const rows = data.map(row =>
        headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            const str = String(val);
            return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
        }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
}

function generateSQL(data: any[], tableName: string): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]).filter(k => !k.startsWith('__'));
    const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');

    const inserts = data.map(row => {
        const values = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');
        return `INSERT INTO ${safeTableName} (${headers.join(', ')}) VALUES (${values});`;
    });

    return `-- Generated SQL INSERT statements for ${safeTableName}\n-- Total rows: ${data.length}\n\n${inserts.join('\n')}`;
}

function generateHTML(data: any, title: string, type: ExportType): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Export</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }
    .glass { background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(12px); }
  </style>
</head>
<body class="p-8">
  <div class="max-w-6xl mx-auto">
    <header class="mb-8 pb-6 border-b border-slate-700">
      <h1 class="text-3xl font-black">${title}</h1>
      <p class="text-slate-400 mt-2">Exported on ${new Date().toLocaleString()}</p>
    </header>
    
    <div class="glass p-6 rounded-2xl">
      <pre class="text-sm text-slate-300 overflow-auto">${JSON.stringify(data, null, 2)}</pre>
    </div>
    
    <footer class="text-center mt-8 text-slate-600 text-sm">
      Generated by Toeasy Analytics OS
    </footer>
  </div>
</body>
</html>
  `;
}

export default ExportModal;
