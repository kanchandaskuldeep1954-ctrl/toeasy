import React, { useState, useEffect } from 'react';
import { useDataset } from '../hooks/useDataset';
import { GroqService } from '../services/groqService';

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

  // Initialize from context
  useEffect(() => {
    if (activeDataset && activeDataset.raw_data) {
      // Ensure data format
      let raw: any = activeDataset.raw_data;
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch (e) { console.error("Failed to parse raw_data", e); raw = []; }
      }

      if (Array.isArray(raw)) {
        setRawData(raw);
        setCleanData(raw); // Initial clean data is same as raw
      }
    }
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
        </div>
      </div>

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

            {/* Agent Overlay */}
            <div className="absolute bottom-6 right-6 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col z-20">
              <div className="bg-indigo-600 p-3 flex justify-between items-center">
                <span className="text-white text-xs font-bold uppercase tracking-wider">Forensic Agent</span>
              </div>
              <div className="h-48 overflow-y-auto p-4 bg-slate-50 dark:bg-black/20">
                {agentResponse ? (
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg rounded-tl-none shadow-sm text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {agentResponse}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 text-center italic mt-10">Ask me anything about this data...</p>
                )}
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <input
                  value={agentQuery}
                  onChange={e => setAgentQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && consultAgent()}
                  placeholder="Type analysis query..."
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  onClick={consultAgent}
                  disabled={isAgentThinking}
                  className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
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

export interface AnalysisInsight {
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
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

export interface Dataset {
  id: number;
  name: string;
  headers: string[];
  data: DataRow[];
  validationRules?: ValidationRule[];
  cleaningSuggestions?: CleaningAction[];
  analysisInsights?: AnalysisInsight[];
  quarantinedData?: DataRow[];
  historyStack?: any[]; // For undo/redo
}

// --- Main Component ---

const ForensicCleanView: React.FC = () => {
  const { activeDataset, updateDataset } = useDataset();

  // Local state for the view
  const [activeTab, setActiveTab] = useState<'validation' | 'quarantine' | 'editor'>('validation');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');

  const [datasetData, setDatasetData] = useState<DataRow[]>([]);
  const [quarantinedData, setQuarantinedData] = useState<DataRow[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);

  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysisResult | null>(null);
  const [semanticContext, setSemanticContext] = useState<string>('');

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  // Agent State
  const [agentQuery, setAgentQuery] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [isAgentThinking, setIsAgentThinking] = useState(false);

  // Initialize from context
  useEffect(() => {
    if (activeDataset && activeDataset.raw_data) {
      // Ensure data format
      let raw = activeDataset.raw_data;
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch (e) { console.error("Failed to parse raw_data", e); raw = []; }
      }

      if (Array.isArray(raw)) {
        setDatasetData(raw);
      }

      // Load existing metadata if available (mocking this part or assuming stored in dataset object)
      // logic to extract rules/quarantine if persisted
    }
  }, [activeDataset]);

  // --- Core Actions ---

  const runDeepAnalysis = async () => {
    if (!activeDataset) return;
    setLoading(true);
    setLoadingStep('Running Deep Semantic Analysis...');

    try {
      // 1. Analyze Semantics
      const analysisRaw: any = await GroqService.analyzeDatasetSemantics(activeDataset as any);
      setDeepAnalysis(analysisRaw);
      setSemanticContext(JSON.stringify(analysisRaw));

      // 2. Architect Logic Gates (Suggest Rules)
      setLoadingStep('Architecting Logic Gates (AI)...');
      const suggestedRules = await GroqService.suggestValidationRules(activeDataset as any, JSON.stringify(analysisRaw));
      setValidationRules(suggestedRules);

    } catch (e) {
      console.error("Deep analysis failed", e);
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
        headers: Object.keys(datasetData[0] || {}),
        data: datasetData,
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
      setDatasetData(result.data);
      setQuarantinedData(result.quarantinedData || []);

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
        { headers: Object.keys(datasetData[0] || {}), data: datasetData } as any,
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
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Panel: Logic Gates (Rules) */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-10">
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

          {/* Tabs */}
          <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('validation')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'validation' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Clean Workspace ({datasetData.length})
            </button>
            <button
              onClick={() => setActiveTab('quarantine')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'quarantine' ? 'bg-white dark:bg-slate-800 shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Quarantine Vault ({quarantinedData.length})
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto custom-scrollbar p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    {Object.keys(datasetData[0] || {}).map(h => (
                      <th key={h} className="px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(activeTab === 'validation' ? datasetData : quarantinedData).slice(0, 100).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2 font-mono text-slate-400">{i + 1}</td>
                      {Object.keys(datasetData[0] || {}).map(h => {
                        const isRecovered = row.__metadata?.recoveredFields?.includes(h);
                        const isError = row.__metadata?.validationErrors?.some(e => e.includes(h)); // Simplified check
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
              {(activeTab === 'validation' ? datasetData : quarantinedData).length === 0 && (
                <div className="p-10 text-center text-slate-400 text-xs">No data in this view.</div>
              )}
            </div>
          </div>

          {/* Agent Overlay */}
          <div className="absolute bottom-6 right-6 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="bg-indigo-600 p-3 flex justify-between items-center">
              <span className="text-white text-xs font-bold uppercase tracking-wider">Forensic Agent</span>
            </div>
            <div className="h-48 overflow-y-auto p-4 bg-slate-50 dark:bg-black/20">
              {agentResponse ? (
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg rounded-tl-none shadow-sm text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {agentResponse}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 text-center italic mt-10">Ask me anything about this data...</p>
              )}
            </div>
            <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                value={agentQuery}
                onChange={e => setAgentQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && consultAgent()}
                placeholder="Type analysis query..."
                className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={consultAgent}
                disabled={isAgentThinking}
                className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
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
