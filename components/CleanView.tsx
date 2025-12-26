
import React, { useState, useEffect } from 'react';
import { Dataset, AnalysisInsight, CleaningAction, ValidationRule, DataRow } from '../types';
import { GeminiService } from '../services/geminiService';

interface CleanViewProps {
  dataset: Dataset;
  onUpdate: (updated: Dataset) => void;
  onAIAction?: () => void;
}

const CleanView: React.FC<CleanViewProps> = ({ dataset, onUpdate, onAIAction }) => {
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<'audit' | 'rules'>('audit');
  const [pendingActions, setPendingActions] = useState<CleaningAction[]>([]);
  const [insights, setInsights] = useState<AnalysisInsight[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<DataRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setPreviewData(dataset.data);
    setHasChanges(false);
  }, [dataset.data]);

  useEffect(() => {
    const runAudit = async () => {
      setLoading(true);
      try {
        if (onAIAction) onAIAction();
        const auditRes = await GeminiService.auditDataset(dataset);
        setPendingActions(auditRes.actions);
        setInsights(auditRes.insights);

        const rules = await GeminiService.suggestValidationRules(dataset);
        setValidationRules(rules.map((r, i) => ({ ...r, id: `r-${i}`, active: true } as ValidationRule)));
      } catch (e) {
        console.error("Audit failed", e);
      } finally {
        setLoading(false);
      }
    };
    runAudit();
  }, [dataset.name]);

  const handleCommit = () => {
    onUpdate({ ...dataset, data: previewData, lastCleaned: new Date() });
    setHasChanges(false);
  };

  const handleSmartClean = async () => {
    setIsProcessing(true);
    try {
      if (onAIAction) onAIAction();
      const smartAction: CleaningAction = {
        id: 'smart-clean',
        type: 'smart_clean',
        title: 'Complete Neural Cleaning',
        description: 'Applying all suggested improvements including outlier removal, null filling, and formatting standardization.',
        impactedRows: dataset.data.length,
        status: 'pending',
        suggestion: 'Perform a comprehensive data cleaning including normalization of all columns and handling of missing values.'
      };
      const cleaned = await GeminiService.autoCleanDataset({ ...dataset, data: previewData }, [smartAction]);
      setPreviewData(cleaned);
      setPendingActions(prev => prev.map(a => ({ ...a, status: 'applied' })));
      setHasChanges(true);
    } catch (e) {
      console.error("Smart Clean failed", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyAction = async (action: CleaningAction) => {
    setIsProcessing(true);
    try {
      if (onAIAction) onAIAction();
      const cleaned = await GeminiService.autoCleanDataset({ ...dataset, data: previewData }, [action]);
      setPreviewData(cleaned);
      setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, status: 'applied' } : a));
      setHasChanges(true);
    } catch (e) {
      console.error("Action failed", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Data Refinery</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Validate integrity and resolve quality issues with AI precision.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={handleSmartClean}
            disabled={isProcessing}
            className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Smart Clean
          </button>
          {hasChanges && (
            <button 
              onClick={handleCommit}
              className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all"
            >
              Commit Changes
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-md z-10">
                <tr>
                  <th className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-16">#</th>
                  {dataset.headers.map(h => (
                    <th key={h} className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider min-w-[150px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewData.slice(0, 100).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3 border-r border-slate-100 dark:border-slate-800 text-xs font-mono text-slate-400 text-center bg-slate-50/30 dark:bg-slate-800/30">{idx + 1}</td>
                    {dataset.headers.map(h => (
                      <td key={h} className="px-6 py-3 text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 truncate max-w-[250px]">{String(row[h] ?? '-')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
             <span>Showing top 100 rows for preview</span>
             <span>Refinery Engine v4.5 Active</span>
          </div>
        </div>

        <aside className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-sm overflow-y-auto custom-scrollbar">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button onClick={() => setActivePanel('audit')} className={`flex-1 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${activePanel === 'audit' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}>Issues</button>
              <button onClick={() => setActivePanel('rules')} className={`flex-1 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${activePanel === 'rules' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}>Health</button>
            </div>

            {activePanel === 'audit' ? (
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Detected Anomalies</h3>
                {loading ? (
                  [1,2,3].map(i => <div key={i} className="h-24 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse"></div>)
                ) : pendingActions.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl">
                    <span className="text-xl">✨</span>
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 mt-2 uppercase tracking-wider">Perfect Condition</p>
                  </div>
                ) : (
                  pendingActions.map(action => (
                    <div key={action.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-400/30 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{action.title}</span>
                        {action.status === 'pending' ? (
                          <button onClick={() => handleApplyAction(action)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Apply</button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-500 uppercase">Fixed</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{action.description}</p>
                      <div className="text-[9px] font-bold text-slate-400 uppercase bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-700 inline-block">
                        {action.impactedRows} Affected Rows
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Dataset Vitality</h3>
                <div className="space-y-4">
                  {insights.map((ins, i) => (
                    <div key={i} className="flex gap-3 text-xs p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ins.importance === 'high' ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{ins.title}</p>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{ins.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {isProcessing && (
        <div className="fixed bottom-10 right-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-300 z-50">
          <div className="w-5 h-5 border-3 border-slate-400 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="flex flex-col">
            <span className="text-sm font-bold uppercase tracking-wider">Refining Workspace</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase">Executing Neural Instruction...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleanView;
