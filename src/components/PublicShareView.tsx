import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { ShareSnapshot } from '../../types';
import PlotlyChart from '../../components/Dashboard/PlotlyChart';
import ReactMarkdown from 'react-markdown';

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
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4h14" /></svg>
                            <span className="text-[10px] uppercase tracking-widest">Download PDF</span>
                        </button>
                        <div className="flex items-center gap-2 print:hidden">
                            <span className="px-3 py-1 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                {resourceType}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Read-only</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Print Styling */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print, header, footer, button, .print-hidden {
                        display: none !important;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    main {
                        margin: 0 !important;
                        padding: 20px !important;
                        max-width: 100% !important;
                    }
                    .bg-white, .dark\\:bg-slate-900 {
                        background: white !important;
                        border: 1px solid #eee !important;
                        box-shadow: none !important;
                    }
                    .text-white, .dark\\:text-white {
                        color: black !important;
                    }
                    .text-slate-400, .text-slate-500 {
                        color: #666 !important;
                    }
                    .prose {
                        max-width: none !important;
                    }
                    pre, code {
                        white-space: pre-wrap !important;
                    }
                    .rounded-[40px], .rounded-[32px] {
                        border-radius: 12px !important;
                    }
                    .shadow-sm, .shadow-lg, .shadow-2xl {
                        box-shadow: none !important;
                    }
                    .animate-in {
                        animation: none !important;
                    }
                }
            `}} />

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
                                    <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                                        <ReactMarkdown>{section.content}</ReactMarkdown>
                                    </div>
                                </div>

                                {section.keyTakeaways && section.keyTakeaways.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {section.keyTakeaways.map((tk: any, i: number) => (
                                            <span key={i} className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                                ✦ {tk}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {section.kpis && section.kpis.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {section.kpis.map((kpi: any, k: number) => (
                                            <div key={k} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">{kpi.label}</p>
                                                <p className="text-xl font-black text-slate-900 dark:text-white">{kpi.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {section.swot && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {section.swot.strengths && section.swot.strengths.length > 0 && (
                                            <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl">
                                                <h4 className="text-[10px] font-black uppercase text-emerald-600 mb-3 tracking-widest">Strengths</h4>
                                                <ul className="text-xs space-y-2 font-medium text-slate-700 dark:text-slate-300">
                                                    {section.swot.strengths.map((s: any, i: number) => <li key={i} className="flex gap-2"><span>💪</span> {s}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {section.swot.weaknesses && section.swot.weaknesses.length > 0 && (
                                            <div className="p-6 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                                                <h4 className="text-[10px] font-black uppercase text-rose-600 mb-3 tracking-widest">Weaknesses</h4>
                                                <ul className="text-xs space-y-2 font-medium text-slate-700 dark:text-slate-300">
                                                    {section.swot.weaknesses.map((s: any, i: number) => <li key={i} className="flex gap-2"><span>⚠️</span> {s}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {section.recommendations && section.recommendations.length > 0 && (
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Actionable Intelligence</h4>
                                        <div className="grid gap-4">
                                            {section.recommendations.map((rec: any, i: number) => (
                                                <div key={i} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{rec.action}</p>
                                                        <span className="px-2 py-0.5 bg-indigo-600/10 text-indigo-600 text-[9px] font-bold rounded uppercase">Impact: {rec.impact}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rec.rationale}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {section.charts && section.charts.length > 0 && (
                                    <div className="grid grid-cols-1 gap-8 pt-8 border-t border-slate-100 dark:border-white/5">
                                        {section.charts.map((chart: any, cIdx: number) => (
                                            <div key={cIdx} className="w-full">
                                                <div className="mb-4">
                                                    <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{chart.type} Visualization</h5>
                                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{chart.title}</h4>
                                                </div>
                                                <div className="h-[400px]">
                                                    <PlotlyChart
                                                        chart={chart.spec || { type: chart.type } as any}
                                                        data={chart.data}
                                                    />
                                                </div>
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
        </div >
    );
};

export default PublicShareView;
