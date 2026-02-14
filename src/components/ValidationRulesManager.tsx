import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

interface ValidationRule {
  id: string;
  dataset_id: string;
  field: string;
  type: 'not_null' | 'pattern' | 'range' | 'unique' | 'format';
  description: string;
  pattern?: string;
  min?: number;
  max?: number;
  created_at: string;
  updated_at: string;
}

const ValidationRulesManager: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get('dataset');
  const workspaceId = searchParams.get('workspace'); // Get workspace ID

  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    field: '',
    type: 'not_null' as ValidationRule['type'],
    description: '',
    pattern: '',
    min: '',
    max: ''
  });

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (datasetId && workspaceId && token) {
      loadRules();
    }
  }, [datasetId, workspaceId, token]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/rules`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const raw = Array.isArray(response.data?.data) ? response.data.data : [];
      const mapped: ValidationRule[] = raw.map((r: any) => {
        const def = (typeof r.rule_definition === 'string')
          ? (() => { try { return JSON.parse(r.rule_definition); } catch { return {}; } })()
          : (r.rule_definition || {});

        const ruleType = String(r.rule_type || '').trim();
        const uiType: ValidationRule['type'] = (ruleType === 'null_check')
          ? 'not_null'
          : (['pattern', 'range', 'unique', 'format'].includes(ruleType) ? ruleType as any : 'not_null');

        const field = String(def.field || (Array.isArray(def.columns) ? def.columns[0] : '') || '').trim();

        return {
          id: String(r.id),
          dataset_id: String(r.dataset_id),
          field,
          type: uiType,
          description: String(r.name || def.description || ''),
          pattern: def.pattern ? String(def.pattern) : undefined,
          min: def.min !== undefined && def.min !== null && def.min !== '' ? Number(def.min) : undefined,
          max: def.max !== undefined && def.max !== null && def.max !== '' ? Number(def.max) : undefined,
          created_at: r.created_at,
          updated_at: r.updated_at
        };
      });

      setRules(mapped);
    } catch (err) {
      setError('Failed to load rules');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async () => {
    if (!form.field || !form.type) {
      setError('Field and type are required');
      return;
    }

    try {
      const field = form.field.trim();

      let ruleType: string = form.type;
      let ruleDefinition: any = {};

      switch (form.type) {
        case 'not_null':
          ruleType = 'null_check';
          ruleDefinition = { columns: [field] };
          break;
        case 'pattern':
          ruleType = 'pattern';
          ruleDefinition = { field, pattern: form.pattern };
          break;
        case 'range':
          ruleType = 'range';
          ruleDefinition = {
            field,
            min: form.min !== '' ? Number(form.min) : undefined,
            max: form.max !== '' ? Number(form.max) : undefined
          };
          break;
        case 'unique':
          ruleType = 'unique';
          ruleDefinition = { field };
          break;
        case 'format':
          ruleType = 'format';
          ruleDefinition = { field, format: 'auto' };
          break;
      }

      const payload = {
        name: (form.description || `${field} ${form.type}`).trim(),
        ruleType,
        ruleDefinition,
        isActive: true
      };


      if (editingId) {
        await axios.put(
          `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/rules/${editingId}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Note: local update might be intricate with mismatched types, better to reload
        loadRules();
      } else {
        await axios.post(
          `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/rules`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        loadRules();
      }

      resetForm();
    } catch (err) {
      setError(`Failed to save rule: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      await axios.delete(
        `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/rules/${ruleId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      setError(`Failed to delete rule: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const editRule = (rule: ValidationRule) => {
    setEditingId(rule.id);
    setForm({
      field: rule.field,
      type: rule.type,
      description: rule.description,
      pattern: rule.pattern || '',
      min: rule.min?.toString() || '',
      max: rule.max?.toString() || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({
      field: '',
      type: 'not_null',
      description: '',
      pattern: '',
      min: '',
      max: ''
    });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  return (
    <div className="max-w-[1200px] mx-auto h-full flex flex-col gap-6 p-4 overflow-auto">

      {/* Header */}
      <div className="flex justify-between items-start gap-6 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Validation Rules</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Define and manage data quality rules</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all"
        >
          {showForm ? '✕ Close' : '+ New Rule'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-2xl p-6">
          {error}
        </div>
      )}

      {/* Form Section */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-8">
          <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">
            {editingId ? 'Edit Rule' : 'Create New Rule'}
          </h3>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Field Name</label>
              <input
                value={form.field}
                onChange={(e) => setForm({ ...form, field: e.target.value })}
                placeholder="e.g., email, age, product_id"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Rule Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="not_null">Not Null</option>
                <option value="pattern">Pattern (Regex)</option>
                <option value="range">Range</option>
                <option value="unique">Unique</option>
                <option value="format">Email/Date Format</option>
              </select>
            </div>

            {form.type === 'pattern' && (
              <div className="col-span-2">
                <label className="block text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Pattern (Regex)</label>
                <input
                  value={form.pattern}
                  onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                  placeholder="e.g., ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            )}

            {form.type === 'range' && (
              <>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Minimum</label>
                  <input
                    type="number"
                    value={form.min}
                    onChange={(e) => setForm({ ...form, min: e.target.value })}
                    placeholder="Min value"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Maximum</label>
                  <input
                    type="number"
                    value={form.max}
                    onChange={(e) => setForm({ ...form, max: e.target.value })}
                    placeholder="Max value"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this rule validate?"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none h-20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={resetForm}
              className="px-6 py-3 rounded-xl text-xs font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={saveRule}
              disabled={!form.field || !form.type}
              className="px-6 py-3 rounded-xl text-xs font-bold uppercase bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-all"
            >
              {editingId ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">
            {rules.length} Active Rules
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <p>Loading rules...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-[10px] font-black uppercase tracking-widest">No validation rules yet</p>
            <p className="text-[9px] mt-2">Create your first rule to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rules.map(rule => (
              <div key={rule.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{rule.field}</h4>
                      <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[9px] font-bold rounded-full uppercase tracking-widest">
                        {rule.type}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{rule.description}</p>
                    )}
                    {rule.pattern && (
                      <div className="text-[9px] font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded text-slate-700 dark:text-slate-300 overflow-x-auto">
                        {rule.pattern}
                      </div>
                    )}
                    {(rule.min !== undefined || rule.max !== undefined) && (
                      <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-2">
                        Range: {rule.min !== undefined ? rule.min : '∞'} - {rule.max !== undefined ? rule.max : '∞'}
                      </div>
                    )}
                    <p className="text-[8px] text-slate-400 mt-2">
                      Created: {new Date(rule.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => editRule(rule)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="px-4 py-2 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[9px] font-bold rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationRulesManager;
