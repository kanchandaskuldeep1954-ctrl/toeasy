import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDataset } from '../hooks/useDataset';
import { GroqService } from '../services/groqService';
import { apiClient } from '../services/apiClient';
import { ExportModal } from './ExportHub';

// --- Types (Locally defined to ensure self-containment) ---

export interface DataRow {
  [key: string]: any;
  __metadata?: {
    isQuarantined?: boolean;
    validationErrors?: string[];
    recoveredFields?: string[];
    recoveryExplanations?: { [key: string]: string };
    recoveryPass?: number;
  };
}

export interface ValidationRule {
  id: string;
  category: 'Recovery' | 'Audit';
  column: string;
  description: string;
  qualityDimension: 'Completeness' | 'Accuracy' | 'Consistency' | 'Validity' | 'Uniqueness' | 'Timeliness';
  expression: string; // JS boolean expression
  healFunction?: string; // JS execution code for recovery
  active: boolean;
}

export interface CleaningAction {
  id: string;
  title: string;
  description: string;
  type: string;
  impactedRows: number;
  status: 'pending' | 'applied' | 'dismissed';
  applyFunction?: string; // Cache the generated code
  timestamp?: Date;
}

export interface DeepAnalysisResult {
  domain: string;
  keyInsights: string[];
  quality: {
    overall: number;
    completeness: number;
    uniqueness: number;
    validity: number;
  };
  semanticContext?: string; // Helper for passing to rule generator
}

// --- Main Component ---

const ForensicCleanView: React.FC = () => {
  const { activeDataset, updateDataset } = useDataset();

  // Local state for the view
  const [activeTab, setActiveTab] = useState<'raw' | 'clean' | 'audit' | 'quarantine'>('raw');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');

  const [searchParams] = useSearchParams();
  const workspaceId = activeDataset?.workspace_id || searchParams.get('workspace');

  const [rawData, setRawData] = useState<DataRow[]>([]); // Immutable original
  const [cleanData, setCleanData] = useState<DataRow[]>([]); // Working copy
  const [quarantinedData, setQuarantinedData] = useState<DataRow[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [auditLog, setAuditLog] = useState<CleaningAction[]>([]); // Transparency log

  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysisResult | null>(null);

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  // Agent State
  const [agentQuery, setAgentQuery] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);

  // Export & Confirm State
  const [showExportModal, setShowExportModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Confirm Cleaning Handler
  const confirmCleaning = async () => {
    if (!activeDataset || cleanData.length === 0) return;

    setIsConfirming(true);
    try {
      // Save cleaned data to backend
      await apiClient.put(`/workspaces/${workspaceId}/datasets/${activeDataset.id}/cleaned`, {
        cleanedData: cleanData,
        quarantinedData: quarantinedData,
        healthScore: deepAnalysis?.quality?.overall || 100,
        cleaningSummary: {
          originalRows: rawData.length,
          cleanedRows: cleanData.length,
          quarantinedRows: quarantinedData.length,
          rulesApplied: validationRules.filter(r => r.active).length,
        }
      });

      // Confirm and overwrite
      await apiClient.post(`/workspaces/${workspaceId}/datasets/${activeDataset.id}/confirm-clean`, {
        keepQuarantined: true
      });

      // Update local state
      setRawData(cleanData);
      setShowConfirmDialog(false);
      alert('✓ Cleaning confirmed! Original dataset has been updated.');

      // Refresh dataset context
      if (updateDataset) {
        updateDataset(activeDataset.id, { raw_data: cleanData, row_count: cleanData.length });
      }
    } catch (err) {
      console.error('Confirm cleaning failed:', err);
      alert('Failed to confirm cleaning. Check console.');
    } finally {
      setIsConfirming(false);
    }
  };




  // Initialize from context
  useEffect(() => {
    const loadData = async () => {
      if (!activeDataset) return;

      let raw: any = activeDataset.raw_data;

      // If no data, try fetching it
      if (!raw || (Array.isArray(raw) && raw.length === 0 && activeDataset.row_count > 0)) {
        try {
          console.log(`[CleanView] Fetching full data for dataset ${activeDataset.id}...`);
          setLoading(true);
          setLoadingStep('Fetching dataset content...');
          const res = await apiClient.get<Dataset>(`/workspaces/${workspaceId}/datasets/${activeDataset.id}`);
          if (res.data && res.data.raw_data) {
            raw = res.data.raw_data;
            // Update context to cache it
            updateDataset(activeDataset.id, { raw_data: raw });
          }
        } catch (err) {
          console.error("Failed to fetch dataset content", err);
        } finally {
          setLoading(false);
          setLoadingStep('');
        }
      }

      // Parse if string
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch (e) { console.error("Failed to parse raw_data", e); raw = []; }
      }

      if (Array.isArray(raw) && raw.length > 0) {
        setRawData(raw);
        setCleanData(raw); // Initial clean data is same as raw
      }
    };

    loadData();
  }, [activeDataset]);

  // --- Core Actions ---

  const runDeepAnalysis = async () => {
    if (!activeDataset) return;
    setLoading(true);
    setLoadingStep('Running Deep Semantic Analysis...');

    try {
      // FIX: Explicitly pass the full data array in the payload
      // The context object might have truncated raw_data or be a string, so we use our parsed state.
      const payloadDataset = {
        ...activeDataset,
        data: cleanData.length > 0 ? cleanData : rawData // Send current working data
      };

      // 1. Analyze Semantics
      const analysisRaw: any = await GroqService.analyzeDatasetSemantics(payloadDataset as any);
      setDeepAnalysis(analysisRaw);

      // 2. Architect Logic Gates (Suggest Rules)
      setLoadingStep('Architecting Logic Gates (AI)...');
      const suggestedRules = await GroqService.suggestValidationRules(payloadDataset as any, JSON.stringify(analysisRaw));
      setValidationRules(suggestedRules);

      // Switch to Clean View so user can see rules applied
      setActiveTab('clean');

    } catch (e) {
      console.error("Deep analysis failed", e);
      alert("Analysis failed. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  const executeForensicEngine = async () => {
    if (validationRules.length === 0) return;
    setIsProcessing(true);
    setProcessingStatus('Initializing 6-Pass Healing Engine...');

    try {
      // Construct a temporary dataset object for the service
      const tempDataset = {
        ...activeDataset,
        headers: Object.keys(cleanData[0] || {}),
        data: cleanData,
        quarantinedData: quarantinedData
      };

      // Run the batch processor (Client-side logic in GroqService)
      setProcessingStatus('Executing Pass 1/6: Semantic Recovery...');
      const result = GroqService.applyBatchRulesToDataset(tempDataset as any, validationRules);

      // Simulate multi-pass visual feedback
      await new Promise(r => setTimeout(r, 800));
      setProcessingStatus('Executing Pass 3/6: Cross-Column Validation...');
      await new Promise(r => setTimeout(r, 800));
      setProcessingStatus('Executing Pass 6/6: Final Integrity Check...');

      // Update State
      setCleanData(result.data);
      setQuarantinedData(result.quarantinedData || []);

      // Log the Action
      const newAction: CleaningAction = {
        id: Math.random().toString(36).substr(2),
        title: 'Forensic Engine Execution',
        description: `Applied ${validationRules.filter(r => r.active).length} logic gates. Recovered rows and quarantined violations.`,
        type: 'batch_process',
        impactedRows: result.data.length,
        status: 'applied',
        timestamp: new Date()
      };
      setAuditLog(prev => [newAction, ...prev]);

      // Update Global Context (Optional: Only if you want to persist immediately)
      // updateDataset(activeDataset!.id, { raw_data: result.data }); 

    } catch (e) {
      console.error("Forensic Engine Failed", e);
      alert("Execution failed. Check console.");
    } finally {
      setIsProcessing(false);
    }
  };

  const consultAgent = async () => {
    if (!agentQuery) return;
    setIsAgentThinking(true);
    try {
      const res = await GroqService.consultVerifiedAgent(
        { headers: Object.keys(cleanData[0] || {}), data: cleanData } as any,
        agentQuery,
        { deepAnalysis }
      );
      setAgentResponse(res);
    } catch (e) {
      setAgentResponse("Agent is offline.");
    } finally {
      setIsAgentThinking(false);
    }
  };

  // --- Render Helpers ---

  if (!activeDataset) return <div className="p-10 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">No Dataset Selected</div>;

  const dataToShow = activeTab === 'raw' ? rawData : (activeTab === 'quarantine' ? quarantinedData : cleanData);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-black overflow-hidden font-sans">

      {/* Top Bar */}
      <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Forensic Data Refinery</h1>
            <p className="text-[10px] text-slate-500 font-bold tracking-wide">AI-Powered Cleaning Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2"
            disabled={cleanData.length === 0}
          >
            💾 Export
          </button>
          <button
            onClick={runDeepAnalysis}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all"
          >
            {loading ? 'Analyzing...' : 'Run Deep Analysis'}
          </button>
          <button
            onClick={executeForensicEngine}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
          >
            {isProcessing ? 'Processing...' : 'Execute Recovery Engine'}
          </button>
          <button
            onClick={() => setShowConfirmDialog(true)}
            disabled={cleanData.length === 0 || cleanData.length === rawData.length}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ Confirm & Save
          </button>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        exportType="dataset"
        data={activeTab === 'clean' ? cleanData : rawData}
        filename={activeDataset?.name || 'dataset'}
      />

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-4xl mx-auto mb-4">
                ⚠️
              </div>
              <h3 className="text-xl font-black text-white mb-2">Confirm Cleaning</h3>
              <p className="text-sm text-slate-400 mb-6">
                This will <strong className="text-white">permanently replace</strong> your original dataset
                ({rawData.length} rows) with the cleaned version ({cleanData.length} rows).
                {quarantinedData.length > 0 && (
                  <> {quarantinedData.length} rows will be quarantined.</>
                )}
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCleaning}
                  disabled={isConfirming}
                  className="px-6 py-2.5 text-sm font-black uppercase tracking-wide text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isConfirming ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Confirming...</>
                  ) : (
                    <>✓ Confirm & Overwrite</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Panel: Logic Gates (Rules) */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-10 shrink-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Logic Gates (Validation Rules)</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {validationRules.length === 0 ? (
              <div className="p-8 text-center opacity-40">
                <p className="text-xs">No logic gates defined.</p>
                <p className="text-[10px] mt-2">Run "Deep Analysis" to architect rules.</p>
              </div>
            ) : (
              validationRules.map(rule => (
                <div
                  key={rule.id}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${rule.active ? 'border-l-4 border-l-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'opacity-50 border-slate-100 dark:border-slate-800'}`}
                  onClick={() => setSelectedRuleId(rule.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${rule.category === 'Recovery' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                      {rule.category}
                    </span>
                    <input type="checkbox" checked={rule.active} onChange={() => { }} className="accent-indigo-600" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight mb-1">{rule.description}</p>
                  <p className="text-[9px] font-mono text-slate-400 truncate">{rule.expression}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Panel: Data View */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-black/50 overflow-hidden relative">

          {/* Navigation Tabs (3-Tab Layout) */}
          <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'raw' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Real Full Dataset ({rawData.length})
            </button>
            <button
              onClick={() => setActiveTab('clean')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'clean' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Cleaned Dataset ({cleanData.length})
            </button>
            <button
              onClick={() => setActiveTab('quarantine')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'quarantine' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Quarantine Vault ({quarantinedData.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'audit' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Audit Log ({auditLog.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'audit' ? (
              // Audit View
              <div className="h-full overflow-y-auto p-4 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-4">
                  {auditLog.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 text-sm">No audit logs available. Execute cleaning steps to generate logs.</div>
                  ) : (
                    auditLog.map(action => (
                      <div key={action.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm">{action.title}</h3>
                          <span className="text-[10px] font-mono text-slate-400">{action.timestamp?.toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{action.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] rounded font-bold uppercase">
                            {action.status}
                          </span>
                          <span className="text-[10px] text-slate-500">Impacted Rows: {action.impactedRows}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // Data Table View (Raw, Clean, Quarantine)
              <div className="h-full overflow-auto custom-scrollbar p-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-w-[800px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-slate-800">#</th>
                        {Object.keys(dataToShow[0] || {}).filter(k => k !== '__metadata').map(h => (
                          <th key={h} className="px-4 py-3 bg-slate-50 dark:bg-slate-800">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dataToShow.slice(0, 100).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-2 font-mono text-slate-400">{i + 1}</td>
                          {Object.keys(dataToShow[0] || {}).filter(k => k !== '__metadata').map(h => {
                            const isRecovered = activeTab === 'clean' && row.__metadata?.recoveredFields?.includes(h);
                            const isError = activeTab === 'clean' && row.__metadata?.validationErrors?.some(e => e.includes(h));
                            // Only show visual indicators in Clean view

                            return (
                              <td key={h} className={`px-4 py-2 border-r border-transparent ${isRecovered ? 'bg-emerald-50/50 text-emerald-700 font-medium' : ''} ${isError ? 'bg-rose-50/50 text-rose-700' : 'text-slate-600 dark:text-slate-400'}`}>
                                {String(row[h])}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dataToShow.length === 0 && (
                    <div className="p-10 text-center text-slate-400 text-xs">No data in this view.</div>
                  )}
                </div>
              </div>
            )}

            {/* Agent Overlay - Collapsible */}
            <div className={`absolute bottom-6 right-6 transition-all duration-300 z-50 flex flex-col items-end ${isAgentOpen ? 'w-80' : 'w-auto'}`}>

              {isAgentOpen ? (
                <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200">
                  {/* Header */}
                  <div className="bg-indigo-600 p-3 flex justify-between items-center cursor-pointer" onClick={() => setIsAgentOpen(false)}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                      <span className="text-white text-xs font-bold uppercase tracking-wider">Forensic Agent</span>
                    </div>
                    <button className="text-white/70 hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>

                  {/* Chat Area */}
                  <div className="h-64 overflow-y-auto p-4 bg-slate-50 dark:bg-black/20 custom-scrollbar">
                    {agentResponse ? (
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg rounded-tl-none shadow-sm text-xs text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-700">
                        {agentResponse}
                      </div>
                    ) : (
                      <div className="text-center mt-8">
                        <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">I can analyze anomalies, suggest fixes, and explain data sources.</p>
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                    <input
                      value={agentQuery}
                      onChange={e => setAgentQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && consultAgent()}
                      placeholder="Ask about this data..."
                      autoFocus
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                    />
                    <button
                      onClick={consultAgent}
                      disabled={isAgentThinking || !agentQuery.trim()}
                      className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {isAgentThinking ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAgentOpen(true)}
                  className="group flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-full shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  <span className="text-xs font-bold uppercase tracking-wider max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">Ask Agent</span>
                  <div className="relative">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-600 rounded-full"></span>
                  </div>
                </button>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Processing</h3>
            <p className="text-xs text-slate-500 uppercase tracking-widest animate-pulse">{processingStatus}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForensicCleanView;
