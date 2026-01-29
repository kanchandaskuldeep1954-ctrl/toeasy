import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { ShareSnapshot } from '../../types';
import PlotlyChart from '../../components/Dashboard/PlotlyChart';

const PublicShareView: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shareData, setShareData] = useState<ShareSnapshot | null>(null);
    const { theme, toggleTheme } = useTheme();

    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000/api';

    useEffect(() => {
        if (token) {
            fetchShareData();
        }
    }, [token]);

    const fetchShareData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${backendUrl}/sharing/${token}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load shared content');
            }

            const data = await response.json();
            setShareData(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'This share link is invalid or has expired.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">Loading shared content...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Link Unavailable</h1>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                        Go to Toeasy
                    </Link>
                </div>
            </div>
        );
    }

    if (!shareData) return null;

    const { resourceType, title, snapshot } = shareData;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#080c14] transition-colors duration-300 no-scrollbar">
            {/* Ultra-Slim Header */}
            <header className="bg-white/60 dark:bg-slate-950/60 backdrop-blur-3xl border-b border-slate-200/50 dark:border-white/5 sticky top-0 z-50">
                <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <span className="font-black text-lg uppercase tracking-tight text-slate-900 dark:text-white">Toeasy</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-200 dark:border-slate-800"
                        >
                            {theme === 'dark' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                {resourceType}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Read-only</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content Container */}
            <main className="max-w-[1800px] mx-auto px-6 py-12 space-y-12 animate-in fade-in duration-700">
                {/* Dashboard Meta */}
                <div className="space-y-2">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{title}</h1>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Verified Strategic Snapshot • Generated via AI Forensics</span>
                    </div>
                </div>

                {/* Dashboard Elements */}
                {resourceType === 'dashboard' && (
                    <div className="space-y-12">
                        {/* KPIs */}
                        {snapshot.kpis && snapshot.kpis.length > 0 && (
                            <div className="flex flex-wrap gap-4">
                                {snapshot.kpis.map((kpi, idx) => (
                                    <div key={idx} className="min-w-[200px] flex-1 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-white/5 p-8 shadow-sm">
                                        <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-2 tracking-widest">{kpi.label}</p>
                                        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{kpi.value}</p>
                                        {kpi.change && (
                                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold mt-3 ${kpi.change.startsWith('+') ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                                <span>{kpi.change.startsWith('+') ? '↑' : '↓'}</span>
                                                {kpi.change}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Chart Grid */}
                        {snapshot.charts && snapshot.charts.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
                                {snapshot.charts.map((chart, idx) => {
                                    const isWide = idx % 3 === 0;
                                    return (
                                        <div key={idx} className={`bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-[40px] border border-slate-200 dark:border-white/5 p-10 flex flex-col min-h-[500px] shadow-sm transition-all hover:border-indigo-500/30 ${isWide ? 'md:col-span-2' : ''}`}>
                                            <div className="mb-10">
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">{chart.title}</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{chart.spec?.description || 'Snapshot data analysis'}</p>
                                            </div>
                                            <div className="flex-1 w-full min-h-[350px]">
                                                <PlotlyChart
                                                    chart={chart.spec || { type: chart.type, title: chart.title } as any}
                                                    data={chart.data}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Report View (Also Stylized) */}
                {resourceType === 'report' && (
                    <div className="max-w-4xl mx-auto space-y-12 pb-20">
                        {snapshot.summary && (
                            <div className="bg-indigo-600 rounded-[40px] p-12 text-white shadow-2xl shadow-indigo-600/20">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-4 text-indigo-100">Executive Summary</h3>
                                <p className="text-2xl font-bold leading-tight">{snapshot.summary}</p>
                            </div>
                        )}

                        {snapshot.sections && snapshot.sections.map((section, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-white/5 p-12 space-y-8">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">{section.title}</h2>
                                    <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: section.content }} />
                                </div>

                                {section.charts && section.charts.length > 0 && (
                                    <div className="grid grid-cols-1 gap-8 mt-12">
                                        {section.charts.map((chart, cIdx) => (
                                            <div key={cIdx} className="w-full h-[400px]">
                                                <PlotlyChart
                                                    chart={chart.spec || { type: chart.type } as any}
                                                    data={chart.data}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer - Branding & Premium CTA */}
            <footer className="bg-white dark:bg-[#040810] border-t border-slate-200/50 dark:border-white/5 py-20">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-2xl mb-10 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shared via Toeasy AI Platform</span>
                    </div>

                    <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-8 max-w-lg mx-auto leading-none">
                        Draft your own strategic analysis in seconds.
                    </h2>

                    <Link
                        to="/signup"
                        className="inline-flex items-center gap-4 px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/20 transition-all active:scale-95 group"
                    >
                        <span>✨ Create Your Dashboard</span>
                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </Link>

                    <div className="mt-20 pt-8 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© 2026 Toeasy. Data Privacy Verified.</p>
                        <div className="flex gap-8">
                            <a href="#" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-500">Terms</a>
                            <a href="#" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-500">Security</a>
                            <a href="#" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-500">API Documentation</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PublicShareView;
