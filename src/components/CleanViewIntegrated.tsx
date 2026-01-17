import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Dataset, AnalysisInsight, CleaningAction, DataRow, ValidationRule, QualityDimension } from '../../types';
import { GroqService } from '../services/groqService';
import { useDataset } from '../hooks/useDataset';
import { apiClient } from '../services/apiClient';
import ExportModal from './ExportHub/ExportModal';

const ForensicCleanView: React.FC = () => {
  const { activeDataset: dataset, updateDataset } = useDataset();
  // Using 'onUpdate' alias for compatibility with logic
  const onUpdate = (updated: Dataset | Partial<Dataset>) => {
    if (dataset) {
      // If we are updating the full dataset object or partial
      updateDataset(dataset.id, updated as Partial<Dataset>);
    }
  };
  const onAIAction = () => { /* Optional telemetry/UI feedback */ };

  const [activeTab, setActiveTab] = useState<'validation' | 'editor' | 'quarantine' | 'original' | 'clean'>('validation'); // Start at validation (Forensic Architect)
  const [isLoading, setIsLoading] = useState(false);
  const [semanticContext, setSemanticContext] = useState<string>(''); // New State

  // Hydrate dataset if raw data is missing (from list view optimization)
  useEffect(() => {
    const hydrateDataset = async () => {
      if (dataset && (!dataset.raw_data || !dataset.data)) {
        console.log("Hydrating dataset logic...", dataset.id);
        setIsLoading(true);
        try {
          const res = await apiClient.get(`/workspaces/${workspaceId}/datasets/${datasetId}`);
          const fullData = res.data;
          // Ensure data/raw_data alias consistency
          const hydrated = {
            ...dataset,
            ...fullData,
            data: fullData.raw_data || [],
            raw_data: fullData.raw_data || [],
            headers: fullData.raw_data?.[0] ? Object.keys(fullData.raw_data[0]) : []
          };
          updateDataset(hydrated);
        } catch (e) {
          console.error("Failed to hydrate dataset:", e);
        } finally {
          setIsLoading(false);
        }
      }
    };
    hydrateDataset();
  }, [dataset, datasetId, workspaceId, updateDataset]); // Dependency on dataset might cause re-run if it changes, but condition prevents loop

  const [pendingActions, setPendingActions] = useState<CleaningAction[]>([]);
  const [insights, setInsights] = useState<AnalysisInsight[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<DataRow[]>([]);

  // Rule Engine State
  const [isExecuting, setIsExecuting] = useState(false);
  const [execStatus, setExecStatus] = useState('');
  const [validationRules, setValidationRules] = useState<ValidationRule[]>(dataset?.validationRules || []);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [nlRuleInput, setNlRuleInput] = useState('');
  const [activeDimension, setActiveDimension] = useState<QualityDimension | 'All'>('All');
  const [isGeneratingRule, setIsGeneratingRule] = useState(false);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [isAutoGeneratingLogic, setIsAutoGeneratingLogic] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleFormData, setRuleFormData] = useState<Partial<ValidationRule>>({
    column: dataset?.headers?.[0] || '',
    category: 'Recovery',
    description: '',
    expression: 'true',
    healFunction: '',
    severity: 'error',
    qualityDimension: 'Validity'
  });

  // Editor Agent State
  const [selectedCell, setSelectedCell] = useState<{ rowIdx: number, field: string, value: any, row: DataRow } | null>(null);
  const [agentQuery, setAgentQuery] = useState('');
  const [agentHistory, setAgentHistory] = useState<{ role: 'user' | 'agent', text: string }[]>([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);

  // Vault Agent State
  const [selectedCluster, setSelectedCluster] = useState<string>('All Vault Isolated');
  const [selectedVaultRow, setSelectedVaultRow] = useState<DataRow | null>(null);
  const [vaultAgentQuery, setVaultAgentQuery] = useState('');
  const [vaultAgentHistory, setVaultAgentHistory] = useState<{ role: 'user' | 'agent', text: string }[]>([]);
  const [isVaultAgentThinking, setIsVaultAgentThinking] = useState(false);

  // Confirm State
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const displayHeaders = dataset?.headers ? dataset.headers.filter(h => h !== '__metadata') : [];

  // Initialize view from dataset state (Cache Hit) & Logic Gates
  useEffect(() => {
    const init = async () => {
      if (!dataset) return;

      setPreviewData(dataset.data || []);
      setLoading(true);

      // Check for cached suggestions
      if (dataset.cleaningSuggestions && dataset.cleaningSuggestions.length > 0) {
        setPendingActions(dataset.cleaningSuggestions);
        setInsights(dataset.analysisInsights || []);
      }

      // Initialize Rules with Deep Semantic Analysis if needed
      if ((!dataset.validationRules || dataset.validationRules.length === 0) && (dataset.data || []).length > 0) {
        try {
          if (onAIAction) onAIAction();

          // Step 1: Deep Semantic Analysis
          setLoadingStep('Deep Semantic Analysis (Understanding Meaning)...');
          const semantics = await GroqService.analyzeDatasetSemantics(dataset);
          setSemanticContext(semantics);

          // Step 2: Comprehensive Rule Generation
          setLoadingStep(`Architecting Logic Gates based on: "${semantics.substring(0, 30)}..."`);
          const suggested = await GroqService.suggestValidationRules(dataset, semantics);

          setValidationRules(suggested);
          onUpdate({ ...dataset, validationRules: suggested });
        } catch (e) { console.error("Rule suggestion failed", e); }
      } else if (dataset.validationRules) {
        setValidationRules(dataset.validationRules);
      }

      setLoading(false);
    };
    init();
  }, [dataset?.id]);

  const handleAutoGenerateLogic = async () => {
    if (!dataset || !ruleFormData.description) return;
    setIsAutoGeneratingLogic(true);
    try {
      if (onAIAction) onAIAction();
      const res = await GroqService.generateLogicFromDescription(dataset, ruleFormData.category || 'Recovery', ruleFormData.description);
      setRuleFormData(prev => ({
        ...prev,
        expression: res.expression,
        healFunction: res.healFunction || '',
        relationshipType: res.relationshipType as any,
        qualityDimension: res.qualityDimension
      }));
    } catch (e) { alert("Forensic Stream interrupted."); }
    finally { setIsAutoGeneratingLogic(false); }
  };

  const handleAddNlRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataset || !nlRuleInput.trim() || isGeneratingRule) return;
    setIsGeneratingRule(true);
    try {
      if (onAIAction) onAIAction();
      const rule = await GroqService.generateRuleFromNL(dataset, nlRuleInput, 'Recovery');
      const newRules = [...validationRules, rule];
      setValidationRules(newRules);
      onUpdate({ ...dataset, validationRules: newRules });
      setNlRuleInput('');
    } catch (e) { alert("Forensic architect failed to deploy."); }
    finally { setIsGeneratingRule(false); }
  };

  const handleRunSelectedRules = async () => {
    if (!dataset || selectedRuleIds.size === 0) return;
    setIsExecuting(true);
    setExecStatus('Initializing Recursive Healing Engine...');

    // Simulating the 6-pass structure visually
    const statuses = [
      'Pass 1/6: Establishing Base Truths...',
      'Pass 2/6: Calculating Dependencies...',
      'Pass 3/6: Resolving Cross-Row Lookups...',
      'Pass 4/6: Pattern Extraction & Formatting...',
      'Pass 5/6: Recursive Deep Cleaning...',
      'Pass 6/6: Final Equilibrium Check & Vaulting...'
    ];

    let currentStep = 0;
    // We update status slightly faster to match AI speed
    const interval = setInterval(() => {
      if (currentStep < statuses.length) {
        setExecStatus(statuses[currentStep]);
        currentStep++;
      }
    }, 600); // 600ms per visual step

    // Use setTimeout to ensure the React UI renders the "Executing" state before blocking on the heavy calculation
    setTimeout(() => {
      if (onAIAction) onAIAction();
      const rulesToRun = validationRules.filter(r => selectedRuleIds.has(r.id));

      // This is the heavy lifting
      const finalDataset = GroqService.applyBatchRulesToDataset(dataset, rulesToRun);

      clearInterval(interval);
      onUpdate(finalDataset);
      setIsExecuting(false);
      setSelectedRuleIds(new Set());
      setActiveTab('editor');
    }, 100);
  };

  const openRuleEditor = (rule?: ValidationRule) => {
    if (!dataset) return;
    if (rule) {
      setEditingRuleId(rule.id);
      setRuleFormData({ ...rule });
    } else {
      setEditingRuleId(null);
      setRuleFormData({
        column: dataset.headers?.[0],
        category: 'Recovery',
        description: '',
        expression: 'true',
        healFunction: '',
        severity: 'error',
        qualityDimension: 'Validity'
      });
    }
    setShowRuleEditor(true);
  };

  const handleSaveRule = () => {
    if (!dataset) return;
    const newRule = { ...ruleFormData, id: editingRuleId || Math.random().toString(36).substr(2, 9), active: true } as ValidationRule;
    const updatedRules = editingRuleId
      ? validationRules.map(r => r.id === editingRuleId ? newRule : r)
      : [...validationRules, newRule];

    setValidationRules(updatedRules);
    onUpdate({ ...dataset, validationRules: updatedRules });
    setShowRuleEditor(false);
  };

  const toggleRuleSelection = (id: string) => {
    const newSet = new Set(selectedRuleIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedRuleIds(newSet);
  };

  const confirmCleaning = async () => {
    if (!dataset) return;
    setIsConfirming(true);
    try {
      await apiClient.put(`/workspaces/${dataset.workspace_id || 'default'}/datasets/${dataset.id}/cleaned`, {
        cleanedData: dataset.data,
        quarantinedData: dataset.quarantinedData || [],
        healthScore: dataset.healthScore || 100
      });
      await apiClient.post(`/workspaces/${dataset.workspace_id || 'default'}/datasets/${dataset.id}/confirm-clean`, {
        keepQuarantined: true
      });
      alert('✓ Forensic Cleaning Confirmed.');
      setShowConfirmDialog(false);
    } catch (e) {
      console.error(e);
      alert('Failed to save cleaning state.');
    } finally {
      setIsConfirming(false);
    }
  };

  const clusters = useMemo(() => {
    if (!dataset) return {};
    const q = dataset.quarantinedData || [];
    const grouped: Record<string, DataRow[]> = { 'All Vault Isolated': q };
    q.forEach(row => {
      row.__metadata?.validationErrors?.forEach(err => {
        const clusterKey = err.split(':')[0] || 'Uncategorized';
        if (!grouped[clusterKey]) grouped[clusterKey] = [];
        grouped[clusterKey].push(row);
      });
    });
    return grouped;
  }, [dataset?.quarantinedData]);

  const filteredRules = useMemo(() => {
    if (activeDimension === 'All') return validationRules;
    return validationRules.filter(r => r.qualityDimension === activeDimension);
  }, [validationRules, activeDimension]);

  // Dimension Color Map
  const dimColor = (d: string) => {
    switch (d) {
      case 'Completeness': return 'text-blue-500 bg-blue-50 border-blue-200';
      case 'Accuracy': return 'text-emerald-500 bg-emerald-50 border-emerald-200';
      case 'Consistency': return 'text-indigo-500 bg-indigo-50 border-indigo-200';
      case 'Validity': return 'text-amber-500 bg-amber-50 border-amber-200';
      case 'Timeliness': return 'text-violet-500 bg-violet-50 border-violet-200';
      case 'Uniqueness': return 'text-rose-500 bg-rose-50 border-rose-200';
      default: return 'text-slate-500 bg-slate-50 border-slate-200';
    }
  };

  if (!dataset) return <div className="p-10 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">No Dataset Selected</div>;

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-12 animate-in fade-in">
        <div className="relative">
          <div className="w-24 h-24 border-[6px] border-indigo-100 dark:border-indigo-900 rounded-full"></div>
          <div className="absolute inset-0 border-[6px] border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-3xl">🧠</div>
        </div>
        <div className="text-center space-y-3">
          <h3 className="text-xl font-black uppercase tracking-[0.2em] text-indigo-600">Forensic Initialization</h3>
          <p className="text-sm font-medium text-slate-400">{loadingStep || 'Analyzing Data DNA...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-6 w-full max-w-[1900px] mx-auto overflow-hidden p-4 md:p-6 lg:p-8">

      {/* Header Panel */}
      <div className="glass-panel p-4 rounded-[40px] shadow-2xl flex flex-col md:flex-row gap-4 justify-between items-center shrink-0 z-50 border border-indigo-500/10 bg-white/50 backdrop-blur-xl dark:bg-slate-900/50">
        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-2 md:pb-0">
          {[
            { id: 'validation', label: 'Forensic Architect', icon: '⚒️' },
            { id: 'original', label: 'Original Dataset', icon: '📄' },
            { id: 'clean', label: 'Clean Dataset', icon: '💎' },
            { id: 'quarantine', label: 'Forensic Vault', icon: '🛡️', count: (dataset.quarantinedData || []).length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-8 py-4 rounded-full transition-all relative ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-2xl scale-105 z-10' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                }`}
            >
              <span>{tab.icon}</span> {tab.label}
              {tab.count !== undefined && tab.count > 0 && <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[8px] animate-pulse">{tab.count}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {semanticContext && (
            <div className="hidden lg:flex px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-full border border-indigo-100 dark:border-indigo-900/50">
              <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide truncate max-w-[200px]" title={semanticContext}>
                Context: {semanticContext}
              </p>
            </div>
          )}
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Workspace Integrity: {dataset.healthScore || 0}%</span>
          <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${dataset.healthScore || 0}%` }}></div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {activeTab === 'validation' && (
          <div className="h-full flex flex-col gap-4 lg:gap-6 relative overflow-hidden">
            {/* Action Bar */}
            <div className="glass-panel p-6 md:p-10 rounded-[40px] md:rounded-[56px] flex flex-col xl:flex-row justify-between items-center gap-6 md:gap-10 shadow-xl border border-indigo-500/10 shrink-0 bg-white/80 dark:bg-slate-900/80 transition-all">
              <div className="flex-1 space-y-2 text-center xl:text-left">
                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Truth-Gate Architect</h3>
                <p className="text-slate-500 text-xs md:text-base font-medium">Design 6-pass recovery logic and sharp audit gates for recursive refinement.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-center">
                {selectedRuleIds.size > 0 && (
                  <button onClick={handleRunSelectedRules} className="px-8 py-3 md:px-10 md:py-4 bg-emerald-600 text-white rounded-[30px] text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all animate-in zoom-in-95">
                    🚀 Run 6-Pass Engine ({selectedRuleIds.size})
                  </button>
                )}
                <form onSubmit={handleAddNlRule} className="relative flex-1 w-full sm:w-[320px] lg:w-[400px]">
                  <input
                    value={nlRuleInput}
                    onChange={(e) => setNlRuleInput(e.target.value)}
                    placeholder="Forensic Goal: 'Fix Price using lookups'..."
                    className="w-full pl-6 pr-28 py-3 md:py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[30px] text-xs md:text-sm font-bold focus:ring-4 md:focus:ring-8 focus:ring-indigo-500/10 transition-all outline-none"
                  />
                  <button disabled={isGeneratingRule} className="absolute right-2 top-2 bottom-2 px-4 md:px-6 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-[20px] shadow-lg hover:bg-indigo-500 transition-all">
                    {isGeneratingRule ? '...' : 'AI Deploy'}
                  </button>
                </form>
                <button onClick={() => openRuleEditor()} className="px-6 py-3 md:px-10 md:py-4 bg-slate-950 dark:bg-slate-100 dark:text-slate-900 text-white rounded-[30px] text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap">➕ New Gate</button>
              </div>
            </div>

            {/* Dimension Filters */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 shrink-0 px-2 lg:px-0">
              <button
                onClick={() => setSelectedRuleIds(new Set(filteredRules.map(r => r.id)))}
                className="px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:text-indigo-600 transition-all whitespace-nowrap"
              >Select All</button>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 mx-2"></div>
              {['All', 'Completeness', 'Accuracy', 'Consistency', 'Validity', 'Timeliness', 'Uniqueness'].map(dim => (
                <button
                  key={dim}
                  onClick={() => setActiveDimension(dim as any)}
                  className={`px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${activeDimension === dim
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl border-transparent'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                >
                  {dim}
                </button>
              ))}
            </div>

            {/* Rules Grid */}
            {filteredRules.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-[48px] m-4 animate-in fade-in zoom-in-95">
                <div className="text-6xl mb-6 opacity-20">🧬</div>
                <h3 className="text-xl font-black uppercase text-slate-400 tracking-widest mb-2">No Logic Gates Found</h3>
                <p className="text-slate-500 font-medium mb-8 max-w-md text-center">The Forensic Architect hasn't established a baseline for this dataset yet.</p>
                <button
                  onClick={async () => {
                    setLoading(true);
                    setLoadingStep('Manual Override: Force-Architecting Logic Gates...');
                    try {
                      const semantics = await GroqService.analyzeDatasetSemantics(dataset);
                      const suggested = await GroqService.suggestValidationRules(dataset, semantics);
                      setValidationRules(suggested);
                      onUpdate({ ...dataset, validationRules: suggested });
                    } catch (e) { alert('Architect Failure'); }
                    setLoading(false);
                  }}
                  className="px-10 py-4 bg-indigo-600 text-white rounded-[30px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all"
                >
                  Initialize AI Architect
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 lg:gap-8 overflow-y-auto custom-scrollbar pb-24 pr-2">
                {filteredRules.map((rule) => (
                  <div key={rule.id} className={`p-8 lg:p-10 rounded-[40px] lg:rounded-[56px] border-[3px] transition-all bg-white dark:bg-slate-900 relative group/card flex flex-col ${rule.active ? 'border-indigo-100 dark:border-indigo-900/40 shadow-xl' : 'opacity-50 grayscale'}`}>
                    <div className="absolute top-6 left-6 lg:top-8 lg:left-8 z-10">
                      <input
                        type="checkbox"
                        checked={selectedRuleIds.has(rule.id)}
                        onChange={() => toggleRuleSelection(rule.id)}
                        className="w-5 h-5 lg:w-6 lg:h-6 rounded-lg border-2 border-indigo-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-between items-start mb-6 lg:mb-8 ml-8 lg:ml-10">
                      <span className={`px-3 py-1 lg:px-4 lg:py-1.5 rounded-full text-[8px] lg:text-[9px] font-black uppercase tracking-widest border ${dimColor(rule.qualityDimension || 'Validity')}`}>
                        {rule.qualityDimension || 'Validity'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openRuleEditor(rule)} className="p-2 lg:p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 transition-all border border-slate-200 dark:border-slate-700">✎</button>
                        <button onClick={() => {
                          const updated = validationRules.map(r => r.id === rule.id ? { ...r, active: !r.active } : r);
                          setValidationRules(updated);
                          if (dataset) onUpdate({ ...dataset, validationRules: updated });
                        }} className={`w-10 h-5 lg:w-12 lg:h-6 rounded-full transition-all ${rule.active ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                          <div className={`w-3.5 h-3.5 lg:w-4 lg:h-4 bg-white rounded-full mt-0.5 lg:mt-1 ml-1 transition-transform ${rule.active ? 'translate-x-5 lg:translate-x-6' : ''}`} />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-[14px] lg:text-[18px] font-black uppercase tracking-tight mb-2 leading-tight text-slate-900 dark:text-white min-h-[40px] lg:min-h-[50px]">
                      {rule.description || "Unspecified Logic Gate"}
                    </h4>
                    <div className="flex gap-2 items-center mb-4 lg:mb-6">
                      <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">Target: {rule.column}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${rule.category === 'Recovery' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {rule.category}
                      </span>
                    </div>

                    <div className="space-y-4 mt-auto">
                      <div className="p-4 lg:p-6 bg-slate-950 rounded-[24px] lg:rounded-[32px] font-mono text-[9px] lg:text-[10px] text-indigo-400 border border-white/5 overflow-x-auto no-scrollbar">
                        <div className="text-slate-600 mb-2 uppercase text-[8px] font-black tracking-widest">Logic Expression (Boolean)</div>
                        {rule.expression || "true"}
                      </div>
                      {rule.category === 'Recovery' && (
                        <div className="p-4 lg:p-6 bg-emerald-950/20 rounded-[24px] lg:rounded-[32px] font-mono text-[9px] lg:text-[10px] text-emerald-400 border border-emerald-900/20 overflow-x-auto no-scrollbar">
                          <div className="text-emerald-800 mb-2 uppercase text-[8px] font-black tracking-widest">Heal Script (JS)</div>
                          {rule.healFunction || "// No heal script provided"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Original Data View */}
        {activeTab === 'original' && (
          <div className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[40px] md:rounded-[64px] flex flex-col overflow-hidden relative shadow-2xl">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex justify-between items-center shrink-0">
              <div className="space-y-1">
                <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-400">Original Source Reference</h3>
                <p className="text-[10px] font-black text-slate-600 uppercase flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  Immutable Read-Only View
                </p>
              </div>
            </div>
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
              <div className="flex-1 overflow-auto custom-scrollbar table-fixed-header">
                <table className="w-full text-left text-[11px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-800 shadow-md">
                    <tr>
                      <th className="p-5 border-b border-slate-200 dark:border-slate-700 font-black uppercase text-slate-400 w-20 text-center tracking-widest bg-slate-50 dark:bg-slate-800">ID</th>
                      {displayHeaders.map(h => (
                        <th key={h} className="p-5 border-b border-slate-200 dark:border-slate-700 font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider whitespace-nowrap bg-slate-50 dark:bg-slate-800">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900">
                    {(dataset.raw_data || dataset.data || []).slice(0, 100).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-5 border-r border-slate-100 text-slate-400 font-mono text-center opacity-40">{i + 1}</td>
                        {displayHeaders.map(h => (
                          <td key={h} className="p-5 border-r border-slate-50 text-slate-500 cursor-default opacity-80">
                            <div className="truncate max-w-[200px]">{String(row[h] || '')}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Clean Dataset (formerly Editor/Workspace) Tab */}
        {activeTab === 'clean' && (
          <div className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[40px] md:rounded-[64px] flex flex-col overflow-hidden relative shadow-2xl">
            <div className="p-6 md:p-10 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/30 dark:bg-slate-950/20 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0">
              <div className="space-y-1 text-center md:text-left">
                <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-400">Refined Operational Workspace</h3>
                <p className="text-[10px] font-black text-emerald-500 uppercase flex items-center justify-center md:justify-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {(dataset?.data || []).length.toLocaleString()} Records Passed 6-Pass Cycle
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExportModal(true)}
                  disabled={(dataset.data || []).length === 0}
                  className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-[24px] text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-50 transition-all border border-slate-200 dark:border-slate-700"
                >
                  Export Cleaned Data
                </button>
                <button
                  onClick={() => setShowConfirmDialog(true)}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-[24px] text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all"
                >
                  Confirm & Save
                </button>
              </div>
            </div>
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
              <div className="flex-1 overflow-auto custom-scrollbar table-fixed-header">
                <table className="w-full text-left text-[11px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-800 shadow-md">
                    <tr>
                      <th className="p-5 border-b border-slate-200 dark:border-slate-700 font-black uppercase text-slate-400 w-20 text-center tracking-widest bg-slate-50 dark:bg-slate-800">ID</th>
                      {displayHeaders.map(h => (
                        <th key={h} className="p-5 border-b border-slate-200 dark:border-slate-700 font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider whitespace-nowrap bg-slate-50 dark:bg-slate-800">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900">
                    {(dataset.data || []).slice(0, 200).map((row, i) => (
                      <tr key={i} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="p-5 border-r border-slate-100 text-slate-400 font-mono text-center opacity-40 group-hover:opacity-100">{i + 1}</td>
                        {displayHeaders.map(h => {
                          const isRec = row.__metadata?.recoveredFields?.includes(h);
                          const isSelected = selectedCell?.rowIdx === i && selectedCell?.field === h;
                          return (
                            <td
                              key={h}
                              onClick={() => setSelectedCell({ rowIdx: i, field: h, value: row[h], row })}
                              className={`p-5 border-r border-slate-50 text-slate-600 dark:text-slate-300 cursor-pointer relative transition-all duration-300 ${isSelected ? 'bg-indigo-600 text-white font-black scale-[1.02] shadow-2xl z-20' : isRec ? 'bg-emerald-500/10 text-emerald-600 font-black underline decoration-emerald-500/30' : ''}`}
                            >
                              <div className="truncate max-w-[200px]">
                                {row[h] === null || row[h] === undefined || row[h] === '' ? <span className="opacity-20 italic">null_sector</span> : String(row[h])}
                              </div>
                              {isRec && !isSelected && <span className="absolute top-1 right-1 text-[9px] text-emerald-500 animate-pulse">✦ P{row.__metadata?.recoveryPass}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Forensic Agent Sidebar (Blue/Indigo) */}
              <div className={`w-[350px] lg:w-[450px] glass-panel border-l border-slate-100 dark:border-slate-800 p-6 lg:p-8 flex flex-col gap-6 lg:gap-8 shadow-2xl shrink-0 transition-transform duration-500 bg-white dark:bg-slate-900`}>
                {/* Agent Content */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
                    <h4 className="text-[12px] font-black uppercase tracking-[0.5em] text-indigo-500">Forensic Agent</h4>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Analyzing multi-pass logic traces.</p>
                </div>

                <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                  <div className="flex-1 overflow-y-auto no-scrollbar p-1 space-y-6">
                    {agentHistory.map((msg, idx) => (
                      <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in`}>
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">{msg.role === 'user' ? 'You' : 'Analyst'}</p>
                        <div className={`p-4 lg:p-6 rounded-[24px] lg:rounded-[32px] text-xs font-medium leading-relaxed shadow-xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 rounded-tl-none'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedCell && (
                    <div className="p-6 lg:p-8 bg-white dark:bg-slate-800 rounded-[32px] lg:rounded-[48px] border-2 border-indigo-100 dark:border-indigo-900 shadow-2xl space-y-4 shrink-0 animate-in zoom-in-95">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Trace: {selectedCell.field}</p>
                        <button onClick={() => setSelectedCell(null)} className="text-slate-400 hover:text-rose-500">✕</button>
                      </div>
                      <p className="text-xl font-black text-slate-950 dark:text-white truncate">{String(selectedCell.value)}</p>
                      {selectedCell.row.__metadata?.recoveredFields?.includes(selectedCell.field) && (
                        <div className="bg-emerald-500/5 p-4 rounded-[20px] border border-emerald-500/20">
                          <p className="text-[9px] font-black text-emerald-600 uppercase mb-2 tracking-widest">Recovery Trace Log</p>
                          <p className="text-xs text-emerald-800 dark:text-emerald-400 font-bold italic">"{selectedCell.row.__metadata?.recoveryExplanations?.[selectedCell.field]}"</p>
                        </div>
                      )}
                    </div>
                  )}

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!agentQuery.trim()) return;
                    setAgentHistory(prev => [...prev, { role: 'user', text: agentQuery }]);
                    setIsAgentThinking(true);
                    GroqService.consultVerifiedAgent(dataset, agentQuery, selectedCell).then(res => {
                      setAgentHistory(prev => [...prev, { role: 'agent', text: res }]);
                      setIsAgentThinking(false);
                    });
                    setAgentQuery('');
                  }} className="relative mt-auto">
                    <textarea value={agentQuery} onChange={(e) => setAgentQuery(e.target.value)} placeholder="Query logic passes..." className="w-full px-8 py-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-[32px] text-xs font-bold min-h-[120px] resize-none shadow-2xl focus:ring-8 focus:ring-indigo-500/10 outline-none" />
                    <button className="absolute right-4 bottom-4 px-6 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full shadow-2xl">{isAgentThinking ? '...' : 'Query'}</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quarantine Vault Tab (with Diagnostic Agent) */}
        {activeTab === 'quarantine' && (
          <div className="h-full glass-panel border border-slate-200 dark:border-slate-800 rounded-[40px] md:rounded-[64px] flex flex-col overflow-hidden relative shadow-2xl">
            <div className="p-10 border-b border-slate-100 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-950/10 flex flex-col lg:flex-row justify-between items-center gap-10 shrink-0">
              <div className="flex-1 space-y-2 text-center lg:text-left">
                <h3 className="text-4xl font-black text-rose-600 uppercase tracking-tighter leading-none">Diagnostic Vault</h3>
                <p className="text-slate-500 text-sm font-medium">Records failing mandatory Truth Audit after 6 recovery passes.</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-[32px] border border-slate-200 dark:border-slate-700 shadow-xl min-w-[320px]">
                <span className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Cluster by sharp violation:</span>
                <select value={selectedCluster} onChange={(e) => setSelectedCluster(e.target.value)} className="w-full bg-transparent border-none text-xs font-black text-slate-800 dark:text-white outline-none cursor-pointer">
                  {Object.keys(clusters).map(key => <option key={key} value={key}>{key} ({clusters[key].length})</option>)}
                </select>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden min-h-0 relative">
              <div className="flex-1 overflow-auto custom-scrollbar p-14 bg-white dark:bg-slate-950">
                {clusters[selectedCluster]?.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                    <div className="text-9xl mb-10">🛡️</div>
                    <h4 className="text-2xl font-black uppercase">Vault Clear</h4>
                    <p className="text-sm">No records reached isolation after forensic reconstruction.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {clusters[selectedCluster].map((row, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedVaultRow(row)}
                        className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[56px] p-10 flex flex-col gap-8 border-l-[12px] shadow-xl hover:scale-[1.01] transition-all cursor-pointer ${selectedVaultRow === row ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-l-rose-500'}`}
                      >
                        <div className="flex flex-wrap gap-2">
                          {row.__metadata?.validationErrors?.map((err, j) => (
                            <span key={j} className="px-4 py-1.5 bg-rose-500 text-white text-[9px] font-black uppercase rounded-full shadow-lg flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                              {err}
                            </span>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-10">
                          {displayHeaders.slice(0, 9).map(h => (
                            <div key={h}>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{h}</p>
                              <p className="text-sm text-slate-800 dark:text-slate-200 truncate font-black">
                                {row[h] === null || row[h] === '' ? <span className="text-rose-400">NULL_SECTOR</span> : String(row[h])}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Diagnostic Agent Sidebar (Red/Rose) */}
              <div className={`w-[450px] glass-panel border-l border-slate-100 dark:border-slate-800 p-8 flex flex-col gap-8 shadow-2xl shrink-0 transition-transform duration-500 bg-white dark:bg-slate-900`}>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse"></div>
                    <h4 className="text-[12px] font-black uppercase tracking-[0.5em] text-rose-500">Diagnostic Agent</h4>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Analyzing quarantined error patterns.</p>
                </div>

                <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                  <div className="flex-1 overflow-y-auto no-scrollbar p-1 space-y-6">
                    {vaultAgentHistory.length === 0 && (
                      <div className="p-6 rounded-[32px] bg-rose-50 dark:bg-rose-900/10 text-xs font-medium text-rose-800 dark:text-rose-200 border border-rose-100 dark:border-rose-800/20 text-center">
                        I am analyzing the <span className="font-black">{selectedCluster}</span> cluster. Click a card to focus on specific failures, or ask me to diagnose the pattern.
                      </div>
                    )}
                    {vaultAgentHistory.map((msg, idx) => (
                      <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in`}>
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">{msg.role === 'user' ? 'You' : 'Diagnostician'}</p>
                        <div className={`p-6 rounded-[32px] text-xs font-medium leading-relaxed shadow-xl ${msg.role === 'user' ? 'bg-rose-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 rounded-tl-none'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedVaultRow && (
                    <div className="p-8 bg-white dark:bg-slate-800 rounded-[48px] border-2 border-rose-100 dark:border-rose-900 shadow-2xl space-y-4 shrink-0 animate-in zoom-in-95 relative">
                      <button onClick={() => setSelectedVaultRow(null)} className="absolute top-6 right-8 text-slate-400 hover:text-rose-500">✕</button>
                      <p className="text-[10px] font-black uppercase text-rose-400 tracking-widest">Active Specimen</p>
                      <div className="space-y-2">
                        {selectedVaultRow.__metadata?.validationErrors?.map((err, i) => (
                          <p key={i} className="text-xs font-black text-slate-800 dark:text-white">{err}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!vaultAgentQuery.trim()) return;
                    setVaultAgentHistory(prev => [...prev, { role: 'user', text: vaultAgentQuery }]);
                    setIsVaultAgentThinking(true);

                    // Context includes the selected cluster name and the specific row if selected
                    const context = {
                      cluster: selectedCluster,
                      focusedRow: selectedVaultRow,
                      totalInCluster: clusters[selectedCluster]?.length
                    };

                    GroqService.consultVerifiedAgent(dataset, vaultAgentQuery, context).then(res => {
                      setVaultAgentHistory(prev => [...prev, { role: 'agent', text: res }]);
                      setIsVaultAgentThinking(false);
                    });
                    setVaultAgentQuery('');
                  }} className="relative mt-auto">
                    <textarea value={vaultAgentQuery} onChange={(e) => setVaultAgentQuery(e.target.value)} placeholder="Analyze failure root cause..." className="w-full px-8 py-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-[48px] text-xs font-bold min-h-[160px] resize-none shadow-2xl focus:ring-8 focus:ring-rose-500/10 outline-none" />
                    <button className="absolute right-5 bottom-5 px-8 py-3 bg-rose-600 text-white text-[10px] font-black uppercase rounded-full shadow-2xl">{isVaultAgentThinking ? '...' : 'Diagnose'}</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rule Editor Modal */}
      {showRuleEditor && (
        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowRuleEditor(false)}></div>
          <div className="w-full max-w-[650px] bg-white dark:bg-slate-900 shadow-2xl rounded-[56px] p-10 md:p-14 flex flex-col gap-8 animate-in zoom-in-95 relative overflow-hidden border-4 border-white/10">
            <div className="flex justify-between items-center">
              <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">{editingRuleId ? 'Modify Logic Gate' : 'Forensic Gate Designer'}</h3>
              <button onClick={() => setShowRuleEditor(false)} className="text-slate-400 hover:text-rose-500 text-3xl transition-colors">✕</button>
            </div>

            <div className="space-y-8 overflow-y-auto no-scrollbar pr-2 max-h-[60vh]">
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase text-indigo-500 tracking-[0.2em]">Gate Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Recovery', 'Audit'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setRuleFormData({ ...ruleFormData, category: cat as any })}
                      className={`px-4 py-3 rounded-2xl text-[8px] font-black uppercase tracking-widest border-2 transition-all ${ruleFormData.category === cat ? 'bg-indigo-600 text-white border-indigo-500 shadow-xl' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'
                        }`}
                    >
                      {cat === 'Recovery' ? 'Recovery (Fixes)' : 'Audit (Verifies)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase text-indigo-500 tracking-[0.2em]">Quality Dimension</label>
                <select
                  value={ruleFormData.qualityDimension}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, qualityDimension: e.target.value as any })}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[24px] text-sm font-bold outline-none text-slate-700 dark:text-white"
                >
                  {['Completeness', 'Accuracy', 'Consistency', 'Validity', 'Timeliness', 'Uniqueness'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase text-indigo-500 tracking-[0.2em]">Forensic Objective</label>
                <div className="relative">
                  <input
                    value={ruleFormData.description}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                    placeholder="e.g., 'Recover missing prices via Item lookup'..."
                    className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[24px] text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none"
                  />
                  <button
                    onClick={handleAutoGenerateLogic}
                    disabled={isAutoGeneratingLogic || !ruleFormData.description}
                    className="absolute right-3 top-3 bottom-3 px-4 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-xl hover:bg-indigo-500 transition-all shadow-lg"
                  >
                    {isAutoGeneratingLogic ? '...' : '⚡ AI Script'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-[11px] font-black uppercase text-indigo-500 tracking-[0.2em]">Target Header</label>
                  <select value={ruleFormData.column} onChange={(e) => setRuleFormData({ ...ruleFormData, column: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[24px] text-sm font-bold outline-none text-slate-700 dark:text-white">
                    {dataset?.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-[11px] font-black uppercase text-indigo-500 tracking-[0.2em]">Logic Type</label>
                  <select value={ruleFormData.relationshipType} onChange={(e) => setRuleFormData({ ...ruleFormData, relationshipType: e.target.value as any })} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[24px] text-sm font-bold outline-none text-slate-700 dark:text-white">
                    <option value="Lookup">Cross-Row Lookup</option>
                    <option value="Calculation">Cross-Column Math</option>
                    <option value="Pattern">Pattern Inference</option>
                    <option value="Validation">Truth Audit</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase text-indigo-500 tracking-[0.2em]">Deductive Logic (TRUE = OK)</label>
                <textarea value={ruleFormData.expression} onChange={(e) => setRuleFormData({ ...ruleFormData, expression: e.target.value })} className="w-full px-8 py-6 bg-slate-950 text-indigo-400 font-mono rounded-[24px] text-xs min-h-[80px] shadow-inner resize-none" />
              </div>

              {ruleFormData.category === 'Recovery' && (
                <div className="space-y-4">
                  <label className="text-[11px] font-black uppercase text-emerald-500 tracking-[0.2em]">Recursive Fix Script</label>
                  <textarea value={ruleFormData.healFunction} onChange={(e) => setRuleFormData({ ...ruleFormData, healFunction: e.target.value })} placeholder="row['Total'] = row['Qty'] * row['Price'];" className="w-full px-8 py-6 bg-emerald-950/20 text-emerald-400 font-mono rounded-[24px] text-xs min-h-[80px] shadow-inner resize-none border border-emerald-900/20" />
                </div>
              )}
            </div>

            <button onClick={handleSaveRule} className="w-full py-6 bg-indigo-600 text-white rounded-[24px] font-black uppercase tracking-[0.3em] text-[12px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">Deploy Forensic Gate</button>
          </div>
        </div>
      )}

      {isExecuting && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-[60px] z-[200] flex flex-col items-center justify-center text-center p-20">
          <div className="relative w-80 h-80 mb-20 flex items-center justify-center">
            <div className="absolute inset-0 border-[15px] border-indigo-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-[15px] border-indigo-500 border-t-transparent rounded-full animate-spin" style={{ animationDuration: '0.6s' }}></div>
            <div className="absolute inset-0 flex items-center justify-center text-8xl animate-pulse">⚒️</div>
          </div>
          <div className="space-y-10 max-w-3xl w-full text-white">
            <h3 className="text-6xl font-black uppercase tracking-tighter animate-in slide-in-from-bottom-5">Multi-Pass Forensic Engine</h3>
            <p className="text-indigo-300 font-bold uppercase tracking-widest text-sm">{execStatus}</p>
            <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden shadow-inner">
              <div className="h-full bg-indigo-500 animate-pulse w-full"></div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-4xl mx-auto mb-4">
                ⚠️
              </div>
              <h3 className="text-xl font-black text-white mb-2">Confirm Forensic Cleaning</h3>
              <p className="text-sm text-slate-400 mb-6">
                This will <strong className="text-white">permanently replace</strong> your original dataset
                with the forensically verified version.
                {dataset?.quarantinedData && dataset.quarantinedData.length > 0 && (
                  <> {dataset.quarantinedData.length} rows will be digitally quarantined.</>
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
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sealing...</>
                  ) : (
                    <>✓ Seal & Overwrite</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        exportType="dataset"
        data={dataset?.data || []}
        filename={dataset?.name || 'dataset'}
      />
    </div>
  );
};

export default ForensicCleanView;
