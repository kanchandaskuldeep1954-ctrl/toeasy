import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { Dataset, StrategicReport } from '../../types';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { activityAPI } from '../services/api';

const TheWarRoom: React.FC = () => {
    const { activeWorkspace } = useWorkspace();
    const { token } = useAuth();
    const navigate = useNavigate();
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'strategic' | 'forensic' | 'clean'>('all');
    const [isGenerating, setIsGenerating] = useState(false);
    const [healthScore, setHealthScore] = useState(0);
    const [alertCount, setAlertCount] = useState(0);

    const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:3000/api';

    useEffect(() => {
        if (activeWorkspace?.id && token) {
            fetchReports();
        }
    }, [activeWorkspace?.id, token]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${backendUrl}/workspaces/${activeWorkspace?.id}/datasets`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const datasetsWithReports = response.data.filter((d: any) => d.strategicReport || d.cleaningReport);
            const reportItems = datasetsWithReports.map((d: any) => ({
                id: d.id,
                title: d.strategicReport?.title || `${d.name} Audit Report`,
                type: d.strategicReport ? 'strategic' : 'clean',
                datasetName: d.name,
                date: d.created_at,
                datasetId: d.id,
                score: d.strategicReport?.overall_score || 0
            }));

            setReports(reportItems);

            // Calculate health score
            if (reportItems.length > 0) {
                const totalScore = reportItems.reduce((acc: number, r: any) => {
                    const s = typeof r.score === 'number' ? r.score : parseFloat(String(r.score).replace(/[^0-9.]/g, '')) || 0;
                    return acc + s;
                }, 0);
                setHealthScore(Math.round(totalScore / reportItems.length));
            } else {
                setHealthScore(0);
            }
        } catch (e) {
            console.error("Failed to fetch reports", e);
        } finally {
            setLoading(false);
        }
    };

    const [feed, setFeed] = useState<any[]>([]);

    useEffect(() => {
        if (!activeWorkspace?.id || !token) return;

        const fetchPulse = async () => {
            try {
                const res = await activityAPI.list(String(activeWorkspace.id), undefined, 5);
                const acts = res.data.data || [];

                const pulseItems = acts.map((a: any) => ({
                    id: a.id,
                    type: a.actionCategory === 'alert' ? 'alert' : (a.actionCategory === 'system' ? 'check' : 'pulse'),
                    title: a.actionType,
                    desc: a.actionDetail,
                    time: new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }));

                // Count alerts
                setAlertCount(acts.filter((a: any) => a.actionCategory === 'alert').length);

                if (pulseItems.length > 0) {
                    setFeed(pulseItems);
                } else {
                    setFeed([{ id: 'p0', type: 'pulse', title: 'System Healthy', desc: `Proactive monitoring active for ${activeWorkspace?.name || 'Workspace'}.`, time: 'Now' }]);
                }
            } catch (e) {
                console.warn("Failed to fetch activity feed", e);
            }
        };

        fetchPulse();
    }, [reports.length, activeWorkspace, token]);

    const handleInitializeAudit = async (type: string) => {
        setIsGenerating(false);
        setLoading(true);
        try {
            // Pick a dataset to audit if none specified, or show selection
            // For pro level, we pick the most recent dataset without a report
            const response = await axios.get(`${backendUrl}/workspaces/${activeWorkspace?.id}/datasets`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const target = response.data.find((d: any) => !d.strategicReport);

            if (!target) {
                alert("All datasets have active intelligence. Try uploading a new source.");
                setLoading(false);
                return;
            }

            // Navigate to report view which triggers generation if missing
            navigate(`/app/report?workspace=${activeWorkspace?.id}&dataset=${target.id}&autoGenerate=true`);
        } catch (e) {
            console.error("Initiation failed", e);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-full bg-slate-50 dark:bg-[#080c14] p-8 md:p-12 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 text-2xl shadow-2xl">🏛️</div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">The War Room</h1>
                    </div>
                    <p className="text-sm font-medium text-slate-500 max-w-xl leading-relaxed">
                        Welcome to the command center. This is your unlimited space for strategic intelligence,
                        forensic audits, and proactive reports. No templates, no limits—just data freedom.
                    </p>
                </div>
                <button
                    onClick={() => setIsGenerating(true)}
                    className="group relative px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all overflow-hidden"
                >
                    <span className="relative z-10">✨ Commission New Audit</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Main Content Area */}
                <div className="xl:col-span-3 space-y-8">
                    {/* Tabs & Tools */}
                    <div className="flex items-center gap-4 p-1.5 bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl w-fit">
                        {['all', 'strategic', 'forensic', 'clean'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Workspace Intelligence Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-8 bg-white dark:bg-[#0f172a] rounded-[40px] border border-slate-200 dark:border-white/10 shadow-xl">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Global Health</h4>
                            <div className="flex items-end gap-3">
                                <span className="text-4xl font-black text-indigo-600">{healthScore}%</span>
                                <span className="text-[10px] font-bold text-emerald-500 mb-1.5 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                    Active
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">Average integrity across {reports.length} monitored datasets.</p>
                        </div>
                        <div className="p-8 bg-white dark:bg-[#0f172a] rounded-[40px] border border-slate-200 dark:border-white/10 shadow-xl">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Total Coverage</h4>
                            <div className="flex items-end gap-3">
                                <span className="text-4xl font-black text-slate-900 dark:text-white">{reports.length}</span>
                                <span className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Reports Active</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">Strategic intelligence coverage for {activeWorkspace?.name || 'Workspace'}.</p>
                        </div>
                        <div className={`p-8 bg-white dark:bg-[#0f172a] rounded-[40px] border border-slate-200 dark:border-white/10 shadow-xl ${alertCount > 0 ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500'}`}>
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Critical Exceptions</h4>
                            <div className="flex items-end gap-3">
                                <span className="text-4xl font-black text-slate-900 dark:text-white">{alertCount}</span>
                                <span className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Alerts Pending</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">{alertCount > 0 ? `${alertCount} variance alerts detected in the last 24 hours.` : 'No variance alerts detected in the last 24 hours.'}</p>
                        </div>
                    </div>

                    {/* Report Grid */}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {loading ? (
                            Array(4).fill(0).map((_, i) => <div key={i} className="h-48 rounded-3xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />)
                        ) : reports.length > 0 ? (
                            reports
                                .filter(r => activeTab === 'all' || r.type === activeTab || (activeTab === 'forensic' && r.type === 'clean'))
                                .map(report => (
                                    <div key={report.id} onClick={() => navigate(`/app/report?workspace=${activeWorkspace?.id}&dataset=${report.datasetId}`)} className="group cursor-pointer glass-card !p-8 rounded-[40px] border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 transition-all hover:shadow-3xl bg-white dark:bg-[#0f172a]">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg ${report.type === 'strategic' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'}`}>
                                                {report.type === 'strategic' ? '📊' : '🧹'}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{new Date(report.date).toLocaleDateString()}</span>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 transition-colors uppercase leading-tight">{report.title}</h3>
                                        <p className="text-xs font-bold text-slate-400 mb-6 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> {report.datasetName}
                                        </p>
                                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 group-hover:text-indigo-400">
                                            <span>Read Intelligence</span>
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                        </div>
                                    </div>
                                ))
                        ) : (
                            <div className="col-span-2 p-12 text-center bg-white dark:bg-slate-950 rounded-[48px] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                <span className="text-5xl mb-6 block opacity-30">📭</span>
                                <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">No Intelligence Commissioned</h3>
                                <p className="text-xs text-slate-500 mt-2">Commission your first multi-report audit to populate the War Room.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Automation & Feed Sidebar */}
                <div className="space-y-8">
                    <div className="p-8 bg-indigo-600 rounded-[48px] text-white shadow-3xl shadow-indigo-500/20 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xs font-black uppercase tracking-widest opacity-70 mb-2">System Status</h3>
                            <p className="text-3xl font-black leading-none mb-4 tracking-tighter italic text-nowrap select-none uppercase">Cross-Sync Active</p>
                            <p className="text-[10px] leading-relaxed font-bold opacity-80">
                                Toeasy AI is proactively monitoring all {activeWorkspace?.name || 'available'} datasets.
                            </p>
                        </div>
                        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse" />
                    </div>

                    <div className="glass-card !p-8 rounded-[48px] border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-950/50">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6 px-1">Tactical Pulse Feed</h3>
                        <div className="space-y-6">
                            {feed.map(item => (
                                <div key={item.id} className="relative pl-6 border-l border-slate-200 dark:border-slate-800 group">
                                    <div className={`absolute -left-1.5 top-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950 ${item.type === 'alert' ? 'bg-rose-500' : item.type === 'pulse' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{item.title}</h4>
                                        <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{item.time}</span>
                                    </div>
                                    <p className="text-[10px] font-medium text-slate-500 leading-tight line-clamp-2">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pro Tip Card */}
                    <div className="p-8 rounded-[48px] bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-2xl mb-3 block">💡</span>
                        <h4 className="text-[10px] font-black uppercase text-slate-900 dark:text-white tracking-widest mb-2">Analyst Tip</h4>
                        <p className="text-[10px] leading-relaxed font-medium text-slate-500">
                            "Real-world data is messy. Use the **Clean Audit** type to identify referential integrity breaks across multiple systems simultaneously."
                        </p>
                    </div>
                </div>
            </div>

            {/* Commission Modal */}
            {isGenerating && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-950/80 backdrop-blur-xl animate-in zoom-in-95">
                    <div className="w-full max-w-2xl bg-white dark:bg-[#0f172a] rounded-[64px] p-12 shadow-3xl border border-white/10 relative">
                        <button onClick={() => setIsGenerating(false)} className="absolute top-8 right-8 text-slate-400 hover:text-white">✕</button>
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Commission Intelligence</h2>
                        <p className="text-sm text-slate-500 font-medium mb-12 italic">Target your objective. Define your depth. Unleash the AI.</p>

                        <div className="grid grid-cols-2 gap-4 mb-12">
                            {[
                                { id: 'strategic', name: 'Strategic Horizon', desc: 'Professional deep-dive with multi-model verification.' },
                                { id: 'forensic', name: 'Forensic Audit', desc: 'Identify architectural data flaws and logical breaks.' },
                                { id: 'matrix', name: 'Data Quality Matrix', desc: 'Cross-dataset health mapping and variance detection.' },
                                { id: 'competitor', name: 'Competitor Pivot', desc: 'Market context and industry-specific benchmarking.' }
                            ].map(type => (
                                <button key={type.id} onClick={() => handleInitializeAudit(type.id)} className="p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group">
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-indigo-500">{type.name}</h4>
                                    <p className="text-[10px] text-slate-500 mt-2">{type.desc}</p>
                                </button>
                            ))}
                        </div>

                        <button onClick={() => handleInitializeAudit('all')} className="w-full py-5 bg-indigo-600 text-white rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all">
                            Initialize Global Intelligence engine
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TheWarRoom;

