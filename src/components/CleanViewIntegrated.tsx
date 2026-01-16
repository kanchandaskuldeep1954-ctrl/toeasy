import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

interface ValidationRule {
  id: string;
  field: string;
  type: string;
  description: string;
  pattern?: string;
  min?: number;
  max?: number;
  created_at: string;
}

interface ValidationIssue {
  row: number;
  field: string;
  rule: string;
  value: any;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationResult {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  issues: ValidationIssue[];
  quarantine: any[];
}

const CleanViewIntegrated: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');
  const datasetId = searchParams.get('dataset');

  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<ValidationRule | null>(null);

  const [newRule, setNewRule] = useState({
    field: '',
    type: 'not_null' as 'not_null' | 'pattern' | 'range' | 'unique' | 'format',
    description: '',
    pattern: '',
    min: '',
    max: ''
  });

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  // Load validation rules on mount
  useEffect(() => {
    if (workspaceId && datasetId && token) {
      loadRules();
    }
  }, [workspaceId, datasetId, token]);

  const loadRules = async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/datasets/${datasetId}/validation-rules`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRules(response.data || []);
    } catch (err) {
      console.error('Failed to load validation rules:', err);
    }
  };

  const createRule = async () => {
    if (!newRule.field || !newRule.type) {
      setError('Field and type are required');
      return;
    }

    try {
      const ruleData: any = {
        dataset_id: datasetId,
        field: newRule.field,
        type: newRule.type,
        description: newRule.description
      };

      if (newRule.type === 'pattern' && newRule.pattern) {
        ruleData.pattern = newRule.pattern;
      }
      if (newRule.type === 'range') {
        if (newRule.min) ruleData.min = parseInt(newRule.min);
        if (newRule.max) ruleData.max = parseInt(newRule.max);
      }

      const response = await axios.post(
        `${backendUrl}/datasets/${datasetId}/validation-rules`,
        ruleData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRules([...rules, response.data]);
      setShowRuleModal(false);
      setNewRule({ field: '', type: 'not_null', description: '', pattern: '', min: '', max: '' });
    } catch (err) {
      setError(`Failed to create rule: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      await axios.delete(
        `${backendUrl}/datasets/${datasetId}/validation-rules/${ruleId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      setError(`Failed to delete rule: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const runValidation = async () => {
    if (!datasetId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${backendUrl}/datasets/${datasetId}/validate`,
        { auto_quarantine: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setValidationResult(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const quarantineInvalidRows = async () => {
    if (!datasetId || !validationResult) return;

    try {
      await axios.post(
        `${backendUrl}/datasets/${datasetId}/quarantine`,
        {
          rows: validationResult.issues.map(i => i.row),
          reason: 'Failed validation'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setError(null);
      // Reload validation
      runValidation();
    } catch (err) {
      setError(`Failed to quarantine rows: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto h-full flex flex-col gap-6 p-4 overflow-auto">
      
      {/* Header */}
      <div className="shrink-0">
        <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Data Cleaner</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">Set validation rules and identify data quality issues</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-[32px] p-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        
        {/* Rules Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl p-8 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Validation Rules</h3>
            <button
              onClick={() => setShowRuleModal(true)}
              className="px-3 py-2 bg-indigo-600 text-white text-[9px] font-bold rounded-lg hover:bg-indigo-500 transition-all"
            >
              + Add Rule
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {rules.length === 0 ? (
              <p className="text-[9px] text-slate-400 opacity-50 text-center py-10">No rules created yet</p>
            ) : (
              rules.map(rule => (
                <div 
                  key={rule.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-900 border border-transparent transition-all"
                  onClick={() => setSelectedRule(rule)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{rule.field}</p>
                      <p className="text-[8px] text-slate-500 mt-1">{rule.type}</p>
                      {rule.description && (
                        <p className="text-[8px] text-slate-400 mt-1 line-clamp-2">{rule.description}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRule(rule.id); }}
                      className="text-rose-400 hover:text-rose-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={runValidation}
            disabled={loading || rules.length === 0}
            className="mt-6 w-full px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            {loading ? 'Validating...' : 'Run Validation'}
          </button>
        </div>

        {/* Validation Results */}
        <div className="col-span-2">
          {validationResult ? (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 text-center">
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{validationResult.total_rows}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">Total Rows</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 text-center">
                  <p className="text-3xl font-black text-emerald-600">{validationResult.valid_rows}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">Valid</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 text-center">
                  <p className="text-3xl font-black text-rose-600">{validationResult.invalid_rows}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">Invalid</p>
                </div>
              </div>

              {/* Issues Table */}
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Issues Found</h3>
                    {validationResult.invalid_rows > 0 && (
                      <button
                        onClick={quarantineInvalidRows}
                        className="px-4 py-2 bg-rose-600 text-white text-[9px] font-bold rounded-lg hover:bg-rose-500 transition-all"
                      >
                        Quarantine {validationResult.invalid_rows} Rows
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                      <tr>
                        <th className="px-6 py-3 text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Row</th>
                        <th className="px-6 py-3 text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Field</th>
                        <th className="px-6 py-3 text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Issue</th>
                        <th className="px-6 py-3 text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Value</th>
                        <th className="px-6 py-3 text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {validationResult.issues.slice(0, 20).map((issue, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-400 font-bold">{issue.row}</td>
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{issue.field}</td>
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{issue.rule}</td>
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-400 font-mono text-[8px]">{String(issue.value)}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-1 rounded text-[8px] font-bold uppercase ${
                              issue.severity === 'error' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' :
                              issue.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                              'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            }`}>
                              {issue.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl p-16 flex flex-col items-center justify-center gap-4 opacity-50">
              <div className="text-6xl">✅</div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Create rules and run validation</p>
            </div>
          )}
        </div>
      </div>

      {/* Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-6">Create Validation Rule</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 block mb-2">Field Name</label>
                <input
                  value={newRule.field}
                  onChange={(e) => setNewRule({ ...newRule, field: e.target.value })}
                  placeholder="e.g., email, age, product_id"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 block mb-2">Rule Type</label>
                <select
                  value={newRule.type}
                  onChange={(e) => setNewRule({ ...newRule, type: e.target.value as any })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="not_null">Not Null</option>
                  <option value="pattern">Pattern (Regex)</option>
                  <option value="range">Range</option>
                  <option value="unique">Unique</option>
                  <option value="format">Email/Date Format</option>
                </select>
              </div>

              {newRule.type === 'pattern' && (
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 block mb-2">Pattern (Regex)</label>
                  <input
                    value={newRule.pattern}
                    onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                    placeholder="e.g., ^[a-zA-Z0-9]+$"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {newRule.type === 'range' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={newRule.min}
                    onChange={(e) => setNewRule({ ...newRule, min: e.target.value })}
                    placeholder="Min"
                    className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <input
                    type="number"
                    value={newRule.max}
                    onChange={(e) => setNewRule({ ...newRule, max: e.target.value })}
                    placeholder="Max"
                    className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 block mb-2">Description</label>
                <textarea
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="Describe this validation rule..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none h-20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowRuleModal(false)}
                className="px-6 py-3 rounded-xl text-xs font-bold uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={createRule}
                disabled={!newRule.field || !newRule.type}
                className="px-6 py-3 rounded-xl text-xs font-bold uppercase bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleanViewIntegrated;
