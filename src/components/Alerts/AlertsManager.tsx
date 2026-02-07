import React, { useState, useEffect } from 'react';
import { alertsAPI } from '../../services/api';
import { Plus, Trash2, Bell, CheckCircle, Activity } from 'lucide-react';
import { Card, Button, Badge } from '../UI';
import CreateAlertModal from './CreateAlertModal';

interface AlertsManagerProps {
    workspaceId: string;
}

const AlertsManager: React.FC<AlertsManagerProps> = ({ workspaceId }) => {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const loadAlerts = async () => {
        setLoading(true);
        try {
            const res = await alertsAPI.list(workspaceId);
            setAlerts(res.data || []);
        } catch (err) {
            console.error('Failed to load alerts', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAlerts();
    }, [workspaceId]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this alert?')) return;
        try {
            await alertsAPI.delete(id);
            loadAlerts();
        } catch (err) {
            console.error('Failed to delete alert', err);
        }
    };

    const handleTest = async (id: string) => {
        try {
            const res = await alertsAPI.check(id);
            alert(res.data.triggered ? 'Alert Triggered!' : 'Alert Checked (Not Triggered)');
        } catch (err) {
            console.error('Failed to check alert', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        Active Alerts
                    </h2>
                    <p className="text-sm text-slate-500">Monitor your key metrics 24/7</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
                    New Alert
                </Button>
            </div>

            {loading ? (
                <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg" />)}
                </div>
            ) : alerts.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <Bell className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No alerts correctly</h3>
                    <p className="text-slate-500 mb-4">Create an alert to start monitoring.</p>
                    <Button variant="outline" onClick={() => setIsCreateOpen(true)}>Create Alert</Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {alerts.map(alert => (
                        <Card key={alert.id} padding="md" className="flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                    <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">{alert.name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">
                                            {alert.condition_type} {alert.threshold_value}
                                        </span>
                                        <span>• {alert.frequency || 'Daily'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="outline" onClick={() => handleTest(alert.id)}>
                                    Test
                                </Button>
                                <button
                                    onClick={() => handleDelete(alert.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {isCreateOpen && (
                <CreateAlertModal
                    workspaceId={workspaceId}
                    onClose={() => setIsCreateOpen(false)}
                    onSuccess={loadAlerts}
                />
            )}
        </div>
    );
};

export default AlertsManager;
