
import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { alertsAPI, metricsAPI } from '../services/api';

interface Alert {
    id: number;
    name: string;
    metric_id: number;
    metric_name: string;
    condition_type: 'GT' | 'LT' | 'EQ';
    threshold_value: number;
    frequency: string;
    is_active: boolean;
    created_at: string;
}

const AlertsManager: React.FC = () => {
    const { activeWorkspace } = useWorkspace();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (activeWorkspace?.id) {
            loadAlerts();
        }
    }, [activeWorkspace?.id]);

    const loadAlerts = async () => {
        try {
            if (!activeWorkspace?.id) return;
            const res = await alertsAPI.list(String(activeWorkspace.id));
            setAlerts(res.data.data);
        } catch (e) {
            console.error('Failed to load alerts', e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this alert?')) return;
        try {
            if (!activeWorkspace?.id) return;
            await alertsAPI.delete(String(activeWorkspace.id), id);
            setAlerts(alerts.filter(a => a.id !== id));
        } catch (e) {
            console.error(e);
            alert('Failed to delete alert');
        }
    };

    const handleToggle = async (alertItem: Alert) => {
        try {
            if (!activeWorkspace?.id) return;
            const newState = !alertItem.is_active;
            await alertsAPI.toggle(String(activeWorkspace.id), alertItem.id, newState);
            setAlerts(alerts.map(a => a.id === alertItem.id ? { ...a, is_active: newState } : a));
        } catch (e) {
            console.error(e);
            alert('Failed to toggle alert');
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
            <div className="p-8 pb-0 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Smart Alerts</h1>
                    <p className="text-slate-500 font-medium">Monitor your metrics and get notified when thresholds are breached.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={async () => {
                            try {
                                if (!activeWorkspace?.id) return;
                                const res = await alertsAPI.check(String(activeWorkspace.id));
                                alert(`Simulation Complete: ${res.data.triggered.length} alerts triggered.`);
                            } catch (e) {
                                console.error(e);
                                alert('Simulation failed');
                            }
                        }}
                        className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Simulate Check
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg shadow-rose-500/20 hover:bg-rose-500 transition-all flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        Create Alert
                    </button>
                </div>
            </div>

            <div className="p-8 flex-1 overflow-auto">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">No active alerts</h3>
                        <p className="text-slate-500 mb-6">Create your first alert to stay on top of your data.</p>
                        <button onClick={() => setShowModal(true)} className="text-rose-600 font-bold hover:underline">Create Alert</button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {alerts.map(alert => (
                            <div key={alert.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-rose-500/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${alert.is_active ? 'bg-rose-100 dark:bg-rose-900/20 text-rose-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        ⚡
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-lg ${alert.is_active ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{alert.name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-xs">{alert.metric_name}</span>
                                            <span>{alert.condition_type} {alert.threshold_value}</span>
                                            <span>•</span>
                                            <span className="capitalize">{alert.frequency}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={alert.is_active} onChange={() => handleToggle(alert)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-rose-600"></div>
                                    </label>

                                    <button onClick={() => handleDelete(alert.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-lg transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showModal && (
                <CreateAlertModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { loadAlerts(); setShowModal(false); }}
                />
            )}
        </div>
    );
};

interface CreateAlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateAlertModal: React.FC<CreateAlertModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { activeWorkspace } = useWorkspace();
    const [metrics, setMetrics] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        name: '',
        metric_id: '',
        condition_type: 'LT',
        threshold_value: '',
        frequency: 'daily'
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && activeWorkspace?.id) {
            loadMetrics();
        }
    }, [isOpen, activeWorkspace?.id]);

    const loadMetrics = async () => {
        try {
            if (!activeWorkspace?.id) return;
            const res = await metricsAPI.list(String(activeWorkspace.id));
            setMetrics(res.data.data);
        } catch (e) { console.error(e); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeWorkspace?.id) return;
        setSaving(true);
        try {
            await alertsAPI.create(String(activeWorkspace.id), {
                ...formData,
                metric_id: Number(formData.metric_id),
                threshold_value: Number(formData.threshold_value)
            });
            onSuccess();
        } catch (e) {
            console.error(e);
            alert('Failed to create alert');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">New Alert Rule</h3>
                    <button onClick={onClose}><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Alert Name</label>
                        <input required className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-rose-500"
                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Low Revenue Warning" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Metric</label>
                        <select required className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-rose-500"
                            value={formData.metric_id} onChange={e => setFormData({ ...formData, metric_id: e.target.value })}>
                            <option value="">Select Metric...</option>
                            {metrics.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Condition</label>
                            <select className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-rose-500"
                                value={formData.condition_type} onChange={e => setFormData({ ...formData, condition_type: e.target.value })}>
                                <option value="GT">Greater Than (&gt;)</option>
                                <option value="LT">Less Than (&lt;)</option>
                                <option value="EQ">Equals (=)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Threshold</label>
                            <input required type="number" className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-rose-500"
                                value={formData.threshold_value} onChange={e => setFormData({ ...formData, threshold_value: e.target.value })} placeholder="0.00" />
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={saving} className="px-6 py-2 bg-rose-600 text-white rounded-lg font-bold shadow-lg hover:bg-rose-500 transition-all disabled:opacity-50">
                            {saving ? 'Creating...' : 'Create Rule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AlertsManager;
