
import React, { useRef, useState } from 'react';
import { DataRow, SourceType } from '../types';

interface UploadViewProps {
  onDataLoaded: (data: DataRow[], name: string, sourceType: SourceType) => void;
}

const UploadView: React.FC<UploadViewProps> = ({ onDataLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connecting, setConnecting] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const parseLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else current += char;
      }
      result.push(current.trim());
      return result.map(v => v.replace(/^"|"$/g, ''));
    };

    const headers = parseLine(lines[0]);
    return lines.slice(1).map(line => {
      const values = parseLine(line);
      const obj: any = {};
      headers.forEach((header, i) => {
        const val = values[i];
        obj[header] = isNaN(Number(val)) || val === '' ? val : Number(val);
      });
      return obj;
    });
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);
      if (data.length > 0) onDataLoaded(data, file.name, 'csv');
    };
    reader.readAsText(file);
  };

  const connectors = [
    { id: 'csv', name: 'CSV / Excel', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'googlesheets', name: 'Google Sheets', icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'postgres', name: 'PostgreSQL', icon: 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'mysql', name: 'MySQL / SQL', icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12', color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const handleSimulate = async (type: SourceType, name: string) => {
    setConnecting(true);
    await new Promise(r => setTimeout(r, 1200));
    
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: 100 + i,
      date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
      customer: `Client ${i % 10}`,
      revenue: Math.floor(Math.random() * 5000) + 1000,
      region: ['North', 'South', 'East', 'West'][Math.floor(Math.random() * 4)],
      status: ['Paid', 'Pending', 'Overdue'][Math.floor(Math.random() * 3)]
    }));

    onDataLoaded(data, name, type);
    setConnecting(false);
  };

  return (
    <div className="max-w-5xl mx-auto py-12 space-y-16">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Welcome to Toeasy <span className="text-indigo-600">AI</span></h2>
        <p className="text-lg text-slate-500 font-medium">Connect your data source to begin cleaning, analysis, and reporting.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {connectors.map(conn => (
          <div key={conn.id} className="card p-8 flex flex-col items-center gap-6 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group" onClick={() => conn.id === 'csv' ? fileInputRef.current?.click() : handleSimulate(conn.id as any, conn.name)}>
            <div className={`w-14 h-14 rounded-2xl ${conn.bg} flex items-center justify-center ${conn.color} group-hover:scale-110 transition-transform`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={conn.icon} /></svg>
            </div>
            <div className="text-center">
              <span className="block text-base font-bold text-slate-900">{conn.name}</span>
              <span className="text-xs text-slate-400 font-medium">Automatic Sync</span>
            </div>
          </div>
        ))}
        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      <div className="card p-12 bg-white relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-12">
           <div className="flex-1 space-y-6 text-center md:text-left">
              <h3 className="text-2xl font-bold text-slate-900">Upload CSV or Drag & Drop</h3>
              <p className="text-slate-500 font-medium leading-relaxed">Simply upload your spreadsheet. Our AI will automatically detect headers, clean up formatting, and suggest insights in seconds.</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 flex items-center gap-3 mx-auto md:mx-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Select File
              </button>
           </div>
           <div className="w-full md:w-80 h-56 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-4 bg-slate-50 hover:bg-white hover:border-indigo-400 transition-all group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Drag file here</span>
           </div>
        </div>
      </div>

      {connecting && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
           <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <span className="text-sm font-bold text-slate-600">Connecting to Source...</span>
           </div>
        </div>
      )}
    </div>
  );
};

export default UploadView;
