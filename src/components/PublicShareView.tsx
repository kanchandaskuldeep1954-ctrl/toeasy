import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { ShareSnapshot } from '../../types';
import { SmartChart } from '../../components/Dashboard/SmartChart';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
    startOnLoad: true,
    theme: 'base',
    themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: '#fff',
        primaryBorderColor: '#4f46e5',
        lineColor: '#6366f1',
        secondaryColor: '#f8fafc',
        tertiaryColor: '#fff'
    }
});

const Mermaid: React.FC<{ chart: string }> = ({ chart }) => {
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (ref.current && chart) {
            ref.current.removeAttribute('data-processed');
            mermaid.contentLoaded();
        }
    }, [chart]);

    return (
        <div className="mermaid bg-white/40 dark:bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-sm overflow-hidden flex justify-center" ref={ref}>
            {chart}
        </div>
    );
};

const PublicShareView: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shareData, setShareData] = useState<ShareSnapshot | null>(null);
    const { theme, toggleTheme } = useTheme();
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [focusIndex, setFocusIndex] = useState(0);

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
        <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#030711]' : 'bg-slate-50'} transition-colors duration-500 overflow-x-hidden relative`}>
            {/* Ambient Mesh Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none no-print">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute top-[20%] -right-[5%] w-[35%] h-[35%] bg-blue-500/10 blur-[100px] rounded-full animate-pulse delay-700" />
                <div className="absolute -bottom-[10%] left-[20%] w-[20%] h-[30%] bg-emerald-500/5 blur-[80px] rounded-full animate-pulse delay-1000" />
            </div>

            {/* Ultra-Slim Header */}
            <header className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-3xl border-b border-slate-200/50 dark:border-white/5 sticky top-0 z-[60]">
                <div className="max-w-[1800px] mx-auto px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20 rotate-3 hover:rotate-0 transition-transform cursor-pointer">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                            <span className="font-black text-xl uppercase tracking-tighter text-slate-900 dark:text-white leading-none block">Toeasy</span>
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none">Intelligence Hub</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-3 mr-4">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-950 bg-slate-200 dark:bg-slate-800" />
                                ))}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest underline decoration-indigo-500/30">Shared by Enterprise Workspace</span>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 rounded-xl bg-white/50 dark:bg-white/5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-200 dark:border-white/5 shadow-sm active:scale-90"
                        >
                            {theme === 'dark' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                        </button>
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
                }
            `}} />

            {/* Content Container */}
            <main className="max-w-[1800px] mx-auto px-6 py-12 space-y-12 animate-in fade-in duration-1000 relative z-10">
                {/* Dashboard Meta */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-200/50 dark:border-white/5">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-500/10">
                                {resourceType}
                            </span>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Strategic Snapshot</span>
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">{title}</h1>
                        <p className="text-xs text-slate-500 font-medium">Verified by Toeasy AI Forensics Engine • {new Date().toLocaleDateString()} </p>
                    </div>

                    {resourceType === 'report' && (
                        <button
                            onClick={() => setIsFocusMode(true)}
                            className="group flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-2xl shadow-indigo-600/20 transition-all active:scale-95"
                        >
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none">Presentation</p>
                                <p className="text-sm font-black uppercase tracking-tight leading-none mt-1">Boardroom Mode</p>
                            </div>
                        </button>
                    )}
                </div>

                {/* Dashboard Elements */}
                {resourceType === 'dashboard' && (
                    <div className="space-y-12">
                        {/* KPIs */}
                        {snapshot.kpis && snapshot.kpis.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {snapshot.kpis.map((kpi: any, idx: number) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        key={idx}
                                        className="bg-white/40 dark:bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 p-8 shadow-sm group hover:border-indigo-500/30 transition-all cursor-default"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">{kpi.label}</p>
                                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 dark:bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                            </div>
                                        </div>
                                        <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{kpi.value}</p>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* Chart Grid */}
                        {snapshot.charts && snapshot.charts.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
                                {snapshot.charts.map((chart: any, idx: number) => {
                                    const isWide = idx % 4 === 0;
                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            whileInView={{ opacity: 1, scale: 1 }}
                                            viewport={{ once: true }}
                                            key={idx}
                                            className={`bg-white/40 dark:bg-[#0d121f]/50 backdrop-blur-3xl rounded-[3rem] border border-slate-200/50 dark:border-white/5 p-10 flex flex-col min-h-[550px] shadow-sm transition-all hover:border-indigo-500/30 ${isWide ? 'md:col-span-2' : ''}`}
                                        >
                                            <div className="flex justify-between items-start mb-10">
                                                <div>
                                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">{chart.title}</h3>
                                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{chart.spec?.description || 'Strategic Data Analysis'}</p>
                                                </div>
                                            </div>
                                            <div className="flex-1 w-full min-h-[350px]">
                                                <SmartChart
                                                    chart={chart.spec || { type: chart.type, title: chart.title } as any}
                                                    data={chart.data}
                                                />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Report View */}
                {resourceType === 'report' && (
                    <div className="max-w-4xl mx-auto space-y-12 pb-20">
                        {snapshot.summary && (
                            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[3rem] p-12 text-white shadow-2xl shadow-indigo-600/30 relative overflow-hidden">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-6 text-indigo-100 relative z-10">Strategic Executive Summary</h3>
                                <p className="text-3xl font-bold leading-tight tracking-tight relative z-10">{snapshot.summary}</p>
                            </div>
                        )}

                        {snapshot.sections && snapshot.sections.map((section: any, idx: number) => (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                key={idx}
                                className="bg-white/40 dark:bg-white/5 backdrop-blur-3xl rounded-[3rem] border border-slate-200/50 dark:border-white/5 p-12 space-y-10 shadow-sm"
                            >
                                <div className="space-y-6">
                                    <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">{section.title}</h2>

                                    {section.logicPath && (
                                        <div className="my-10 space-y-4">
                                            <h6 className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.3em] text-center">Inferred Decision Logic</h6>
                                            <Mermaid chart={section.logicPath} />
                                        </div>
                                    )}

                                    <div className="prose dark:prose-invert max-w-none text-lg text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                                        <ReactMarkdown>{section.content}</ReactMarkdown>
                                    </div>

                                    {section.reasoning && (
                                        <div className="p-8 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl">
                                            <h6 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Logic Weaver Reasoning</h6>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 italic font-medium leading-relaxed">
                                                "{section.reasoning}"
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {section.charts && section.charts.length > 0 && (
                                    <div className="space-y-12 pt-12 border-t border-slate-100 dark:border-white/5">
                                        {section.charts.map((chart: any, cIdx: number) => (
                                            <div key={cIdx} className="space-y-6">
                                                <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{chart.title}</h4>
                                                <div className="h-[450px] bg-white/30 dark:bg-black/20 rounded-[2.5rem] border border-slate-100 dark:border-white/5 p-8">
                                                    <SmartChart
                                                        chart={chart.spec || { type: chart.type } as any}
                                                        data={chart.data}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Boardroom Mode Overlay */}
                <AnimatePresence>
                    {isFocusMode && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-8 overflow-hidden"
                        >
                            <button
                                onClick={() => setIsFocusMode(false)}
                                className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-20"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>

                            <div className="w-full max-w-7xl flex flex-col h-full relative z-10">
                                <div className="w-full h-1.5 bg-white/10 rounded-full mb-16 overflow-hidden flex gap-1">
                                    {snapshot.sections?.map((_: any, i: number) => (
                                        <div
                                            key={i}
                                            className={`flex-1 h-full transition-all duration-700 ${i === focusIndex ? 'bg-indigo-500' : (i < focusIndex ? 'bg-indigo-900' : 'bg-transparent')}`}
                                        />
                                    ))}
                                </div>

                                <div className="flex-1 flex flex-col justify-center">
                                    <AnimatePresence mode="wait">
                                        {snapshot.sections?.[focusIndex] && (
                                            <motion.div
                                                key={focusIndex}
                                                initial={{ opacity: 0, x: 50 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -50 }}
                                                className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center"
                                            >
                                                <div className="space-y-10">
                                                    <h2 className="text-6xl font-black text-white leading-tight tracking-tighter">
                                                        {snapshot.sections[focusIndex].title}
                                                    </h2>
                                                    <div className="text-2xl text-slate-300 leading-relaxed font-medium">
                                                        <ReactMarkdown>{snapshot.sections[focusIndex].content}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                <div className="bg-white/5 p-12 rounded-[4rem] border border-white/10 backdrop-blur-3xl shadow-2xl">
                                                    {snapshot.sections[focusIndex].charts?.[0] && (
                                                        <div className="h-[500px]">
                                                            <SmartChart
                                                                chart={snapshot.sections[focusIndex].charts[0].spec || { type: snapshot.sections[focusIndex].charts[0].type }}
                                                                data={snapshot.sections[focusIndex].charts[0].data}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="flex justify-between items-center py-12 mt-8 border-t border-white/5">
                                    <button
                                        onClick={() => setFocusIndex(Math.max(0, focusIndex - 1))}
                                        disabled={focusIndex === 0}
                                        className="text-white/40 hover:text-white disabled:opacity-0 font-black uppercase text-[10px] tracking-[0.3em]"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (focusIndex < (snapshot.sections?.length || 0) - 1) {
                                                setFocusIndex(focusIndex + 1);
                                            } else {
                                                setIsFocusMode(false);
                                            }
                                        }}
                                        className="text-indigo-400 hover:text-indigo-300 font-black uppercase text-[10px] tracking-[0.3em]"
                                    >
                                        {focusIndex === (snapshot.sections?.length || 0) - 1 ? 'Finish' : 'Next'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <footer className="bg-white dark:bg-[#040810] border-t border-slate-200/50 dark:border-white/5 py-20 relative z-10">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-8 max-w-lg mx-auto leading-none">
                        Draft your own strategic analysis in seconds.
                    </h2>
                    <Link
                        to="/signup"
                        className="inline-flex items-center gap-4 px-10 py-5 bg-indigo-600 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-2xl group"
                    >
                        <span>Create Your Dashboard</span>
                    </Link>
                </div>
            </footer>
        </div>
    );
};

export default PublicShareView;
