
import React, { useRef, useState } from 'react';
import { DataRow, SourceType } from '../types';

interface UploadViewProps {
  onDataLoaded: (data: DataRow[], name: string, sourceType: SourceType) => void;
}

const UploadView: React.FC<UploadViewProps> = ({ onDataLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connecting, setConnecting] = useState(false);

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

  const handleSampleData = () => {
     setConnecting(true);
     setTimeout(() => {
        const sampleData = Array.from({ length: 150 }, (_, i) => ({
            id: 1000 + i,
            date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString().split('T')[0],
            sales_rep: ['Alice', 'Bob', 'Charlie', 'Dana'][Math.floor(Math.random() * 4)],
            region: ['North', 'South', 'East', 'West', 'International'][Math.floor(Math.random() * 5)],
            product_line: ['SaaS License', 'Consulting', 'Support Pack', 'Hardware'][Math.floor(Math.random() * 4)],
            contract_value: Math.floor(Math.random() * 15000) + 2000,
            status: ['Closed Won', 'Negotiation', 'Proposal', 'Qualified'][Math.floor(Math.random() * 4)],
            probability: Math.floor(Math.random() * 100)
        }));
        onDataLoaded(sampleData, 'Sales_Pipeline_Sample.csv', 'csv');
        setConnecting(false);
     }, 800);
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Toeasy <span className="text-indigo-600">AI</span></h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto">
            The autonomous data operating system. Connect your source to begin automated cleaning, deep analysis, and executive reporting.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Main Upload Card */}
         <div 
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-center gap-6 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
         >
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            </div>
            <div className="text-center">
               <h3 className="text-xl font-bold text-slate-900 dark:text-white">Upload CSV / Excel</h3>
               <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Drag & drop or click to browse</p>
            </div>
         </div>

         {/* Connectors Grid */}
         <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-6">Connect Source</h3>
            <div className="grid grid-cols-2 gap-4">
                {[
                    { name: 'Google Sheets', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { name: 'PostgreSQL', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { name: 'Stripe', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
                    { name: 'Salesforce', color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-900/20' },
                ].map(c => (
                    <button key={c.name} disabled className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left opacity-60 cursor-not-allowed" title="Coming Soon">
                        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center ${c.color} font-bold text-xs`}>
                            {c.name[0]}
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{c.name}</span>
                    </button>
                ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
               <button 
                onClick={handleSampleData}
                className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
               >
                  <span>🚀</span> Try with Sample Data
               </button>
            </div>
         </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

      {connecting && (
        <div className="fixed inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="text-center">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Connecting...</h3>
                  <p className="text-sm text-slate-500">Normalizing data schema</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default UploadView;
