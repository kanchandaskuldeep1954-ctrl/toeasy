import React, { useState, useEffect } from 'react';
import { X, Bell, Activity, Save } from 'lucide-react';
import { alertsAPI, metricsAPI } from '../../services/api';

interface CreateAlertModalProps {
    workspaceId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateAlertModal: React.FC<CreateAlertModalProps> = ({ workspaceId, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [metricId, setMetricId] = useState<string>('');
    const [conditionType, setConditionType] = useState('GT');
    const [threshold, setThreshold] = useState('');
    const [metrics, setMetrics] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadMetrics();
    }, [workspaceId]);

    const loadMetrics = async () => {
        try {
            const res = await metricsAPI.list(workspaceId);
            setMetrics(res.data || []);
        } catch (err) {
            console.error('Failed to load metrics', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await alertsAPI.create(workspaceId, {
                name,
                metric_id: metricId ? parseInt(metricId) : null,
                condition_type: conditionType,
                threshold_value: parseFloat(threshold)
            });
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to create alert', err);
            alert('Failed to create alert');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <Bell className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create Alert</h2>
                        <p className="text-sm text-slate-500">Get notified when data changes</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Alert Name
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Revenue Drop"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Metric to Monitor
                        </label>
                        <select
                            value={metricId}
                            onChange={(e) => setMetricId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Select a metric...</option>
                            {metrics.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Condition
                            </label>
                            <select
                                value={conditionType}
                                onChange={(e) => setConditionType(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="GT">Greater Than (&gt;)</option>
                                <option value="LT">Less Than (&lt;)</option>
                                <option value="EQ">Equals (=)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Threshold
                            </label>
                            <input
                                type="number"
                                required
                                value={threshold}
                                onChange={(e) => setThreshold(e.target.value)}
                                placeholder="1000"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : (
                            <>
                                <Save className="w-4 h-4" />
                                Create Alert
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateAlertModal;
