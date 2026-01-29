import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { metricsAPI } from '../services/api';
import useLastUpdated, { LastUpdatedDisplay } from '../hooks/useLastUpdated';
import { Skeleton, LibraryCardSkeleton } from './LoadingSkeletons';

interface Metric {
    id: number;
    name: string;
    formula: string;
    description: string;
    category: string;
    format_type: string;
    is_certified: boolean;
    owner_email?: string;
    usage_count: number;
    updated_at: string;
}

const MetricsLibrary: React.FC = () => {
    const { activeWorkspace: workspace } = useWorkspace();
    const [metrics, setMetrics] = useState<Metric[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [categories, setCategories] = useState<string[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Load metrics
    useEffect(() => {
        if (!workspace?.id) return;
        loadMetrics();
        loadCategories();
    }, [workspace?.id]);

    const loadMetrics = async () => {
        setLoading(true);
        try {
            if (!workspace?.id) return;
            const res = await metricsAPI.list(workspace.id, { search });
            setMetrics(res.data.data);
        } catch (err) {
            console.error('Failed to load metrics', err);
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            if (!workspace?.id) return;
            const res = await metricsAPI.getCategories(workspace.id);
            setCategories(['All', ...res.data.data]);
        } catch (err) {
            console.error('Failed to load categories', err);
        }
    };

    const filteredMetrics = metrics.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.description?.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="flex-none p-6 md:p-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                <div className="max-w-7xl mx-auto w-full">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                                Metrics Library
                            </h1>
                            <p className="text-slate-500 font-medium">
                                Centralized definitions for your key business KPIs
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Metric
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1 w-full">
                            <input
                                type="text"
                                placeholder="Search metrics..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            />
                            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === cat
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    {cat}
                                    {cat === 'All' && <span className="ml-2 opacity-60">{metrics.length}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map(i => <LibraryCardSkeleton key={i} />)}
                        </div>
                    ) : filteredMetrics.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No metrics found</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8">
                                Create standardized metrics to ensure consistent reporting across all your dashboards.
                            </p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-colors"
                            >
                                Create First Metric
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredMetrics.map(metric => (
                                <MetricCard key={metric.id} metric={metric} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Modal would go here */}
            {showCreateModal && (
                <CreateMetricModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        loadMetrics();
                        setShowCreateModal(false);
                    }}
                />
            )}
        </div>
    );
};

const MetricCard: React.FC<{ metric: Metric }> = ({ metric }) => {
    return (
        <div className="group bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer relative overflow-hidden">
            {/* Certification Badge */}
            {metric.is_certified && (
                <div className="absolute top-0 right-0 p-4">
                    <div className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-emerald-500/20">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        Certified
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <span className="font-bold text-sm">ƒx</span>
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-500 transition-colors">
                        {metric.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{metric.category}</p>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-3 mb-4 border border-slate-100 dark:border-slate-800 font-mono text-xs text-slate-600 dark:text-slate-400 truncate">
                {metric.formula}
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-6 h-10">
                {metric.description || 'No description provided.'}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Used in {metric.usage_count} places
                    </span>
                </div>
                <LastUpdatedDisplay date={metric.updated_at} />
            </div>
        </div>
    );
};

const CreateMetricModal: React.FC<any> = ({ isOpen, onClose, onSuccess }) => {
    const { activeWorkspace: workspace } = useWorkspace();
    const [formData, setFormData] = useState({
        name: '',
        formula: '',
        description: '',
        category: 'General',
        format_type: 'number'
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!workspace?.id) return;

        setSaving(true);
        try {
            await metricsAPI.create(workspace.id, formData);
            onSuccess();
        } catch (err) {
            console.error('Failed to create metric', err);
            alert('Failed to create metric');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-0 w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">New Metric</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Metric Name</label>
                        <input
                            required
                            className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Gross Revenue"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Formula</label>
                        <textarea
                            required
                            className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm h-24"
                            value={formData.formula}
                            onChange={e => setFormData({ ...formData, formula: e.target.value })}
                            placeholder="e.g. SUM(quantity * unit_price)"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Use SQL-like syntax for your calculation.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Category</label>
                            <input
                                className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                list="category-options"
                            />
                            <datalist id="category-options">
                                <option value="Financial" />
                                <option value="Operational" />
                                <option value="Sales" />
                                <option value="Marketing" />
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Format</label>
                            <select
                                className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={formData.format_type}
                                onChange={e => setFormData({ ...formData, format_type: e.target.value })}
                            >
                                <option value="number">Number</option>
                                <option value="currency">Currency</option>
                                <option value="percentage">Percentage</option>
                                <option value="integer">Integer</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Description</label>
                        <textarea
                            className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none h-20"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Explain what this metric measures..."
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {saving ? 'Creating...' : 'Create Metric'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MetricsLibrary;
