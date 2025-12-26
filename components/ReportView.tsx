
import React, { useState, useEffect } from 'react';
import { Dataset } from '../types';
import { GeminiService } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface ReportViewProps {
  dataset: Dataset;
  onAIAction?: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ dataset, onAIAction }) => {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);
  const [customFocus, setCustomFocus] = useState('');

  const generate = async (focus?: string) => {
    setLoading(true);
    try {
      if (onAIAction) onAIAction();
      const content = await GeminiService.generateReport(dataset, focus);
      setReport(content);
    } catch (e) {
      console.error("Report error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
  }, [dataset.name]);

  const quickStats = [
    { label: 'Volume', value: dataset.data.length.toLocaleString(), icon: '📊' },
    { label: 'Integrity', value: 'High', icon: '💎' },
    { label: 'Dimensions', value: dataset.headers.length.toString(), icon: '📐' },
    { label: 'Analyzed', value: new Date().toLocaleDateString(), icon: '📅' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-32">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Executive Report</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Auto-synthesized strategic analysis and structural insights.</p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <input 
            className="flex-1 sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
            placeholder="Focus area (e.g. Growth)"
            value={customFocus}
            onChange={(e) => setCustomFocus(e.target.value)}
          />
          <button 
            onClick={() => generate(customFocus)}
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
          >
            Regenerate
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-4 shadow-sm">
             <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xl shadow-inner">
                {stat.icon}
             </div>
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{stat.value}</p>
             </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col min-h-[800px]">
        <div className="h-1.5 bg-indigo-600"></div>
        <div className="flex-1 p-8 md:p-16 lg:p-24 relative">
          {loading ? (
            <div className="space-y-12 animate-pulse">
              <div className="space-y-4">
                <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl w-1/2"></div>
                <div className="h-4 bg-slate-50 dark:bg-slate-800/50 rounded-full w-3/4"></div>
              </div>
              <div className="space-y-4 pt-10">
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-full"></div>
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-[95%]"></div>
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-[90%]"></div>
              </div>
              <div className="grid grid-cols-2 gap-8 pt-10">
                <div className="h-40 bg-slate-50 dark:bg-slate-800 rounded-2xl"></div>
                <div className="h-40 bg-slate-50 dark:bg-slate-800 rounded-2xl"></div>
              </div>
            </div>
          ) : (
            <article className="prose prose-slate dark:prose-invert max-w-none">
              <div className="mb-20 text-center border-b border-slate-100 dark:border-slate-800 pb-12">
                 <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.4em] block mb-4">Confidential Strategic Document</span>
                 <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Dataset Strategic Analysis</h1>
                 <div className="flex items-center justify-center gap-6 text-slate-500 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-6">
                    <span>Source: {dataset.name}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"></span>
                    <span>Ref: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                 </div>
              </div>
              
              <div className="space-y-10 leading-relaxed text-slate-600 dark:text-slate-300">
                <ReactMarkdown 
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-8 mt-16 border-l-4 border-indigo-600 pl-6" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-bold text-slate-800 dark:text-white mt-12 mb-4 uppercase tracking-wider" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-8 mb-3" {...props} />,
                    table: ({node, ...props}) => <div className="overflow-x-auto my-10 shadow-sm border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800" {...props} /></div>,
                    thead: ({node, ...props}) => <thead className="bg-slate-50 dark:bg-slate-800" {...props} />,
                    th: ({node, ...props}) => <th className="px-6 py-4 text-left text-[11px] font-bold uppercase text-slate-500 tracking-widest" {...props} />,
                    td: ({node, ...props}) => <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-6 space-y-4 my-8 marker:text-indigo-600" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-6 py-4 rounded-r-xl italic text-slate-500 dark:text-slate-400 my-10" {...props} />,
                  }}
                >
                  {report}
                </ReactMarkdown>
              </div>
              
              <div className="mt-32 pt-10 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Validated Sequence</span>
                  <span>Autonomous Engine v4.5</span>
                </div>
                <div className="flex gap-6">
                   <button className="hover:text-indigo-600 transition-colors">Methods</button>
                   <button className="hover:text-indigo-600 transition-colors">Privacy</button>
                </div>
              </div>
            </article>
          )}
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <button className="px-8 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export Official PDF
        </button>
        <button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 transition-all flex items-center justify-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          Collaborative Share
        </button>
      </div>
    </div>
  );
};

export default ReportView;
