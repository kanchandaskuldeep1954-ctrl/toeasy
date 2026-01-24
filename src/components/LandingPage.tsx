import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
    return (
        <div className="relative overflow-hidden">
            {/* Hero Section */}
            <section className="relative pt-20 pb-32 md:pt-32 md:pb-48 px-4">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 opacity-30 dark:opacity-20 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                </div>

                <div className="max-w-7xl mx-auto text-center space-y-8 relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest animate-in">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Next Gen Data Governance
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.1] text-slate-900 dark:text-white max-w-4xl mx-auto">
                        Clean Data. <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Pure Insights.</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        Toeasy AI transforms messy datasets into actionable intelligence. Automated cleaning, smart visualization, and robust governance in one unified platform.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <Link
                            to="/signup"
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
                        >
                            Start for free
                        </Link>
                        <Link
                            to="/login"
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm hover:shadow-md"
                        >
                            View Demo
                        </Link>
                    </div>

                    {/* Dashboard Preview Mockup */}
                    <div className="mt-16 md:mt-24 relative max-w-5xl mx-auto">
                        <div className="rounded-3xl border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden glass-card p-2 md:p-4 rotate-x-6 transform-gpu">
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-900 aspect-video relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 dark:from-indigo-500/20 via-transparent to-purple-500/10 dark:to-purple-500/20 pointer-events-none"></div>
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-indigo-500/5 to-purple-500/20 pointer-events-none"></div>
                                <div className="p-12 flex flex-col items-center justify-center h-full text-center">
                                    <div className="space-y-6 max-w-2xl">
                                        <div className="inline-flex px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                            Dynamic Engine v2.4
                                        </div>
                                        <h3 className="text-3xl md:text-5xl font-black text-white leading-tight">
                                            Visualizing Complexity at <span className="text-indigo-500 italic">Speed.</span>
                                        </h3>
                                        <p className="text-slate-400 text-sm md:text-base font-medium">
                                            Experience zero-latency data exploration with our proprietary rendering stack.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 px-4 bg-white dark:bg-slate-900">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white">Built for modern data teams</h2>
                        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Everything you need to manage, clean, and analyze your data at scale.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                title: 'AI Cleaning',
                                desc: 'Automatically detect and fix anomalies, missing values, and inconsistent formatting with our advanced LLM engine.',
                                icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
                                color: 'blue'
                            },
                            {
                                title: 'Smart Visuals',
                                desc: 'Generate beautiful, interactive D3.js and Plotly charts that respond to your data insights automatically.',
                                icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z',
                                color: 'purple'
                            },
                            {
                                title: 'Data Workflows',
                                desc: 'Build automated pipelines to process data from multiple sources and export them to your favorite tools.',
                                icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
                                color: 'orange'
                            }
                        ].map((feature, idx) => (
                            <div key={idx} className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                                <div className={`w-12 h-12 rounded-2xl bg-${feature.color}-500/10 flex items-center justify-center text-${feature.color}-600 mb-6 group-hover:scale-110 transition-transform`}>
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} /></svg>
                                </div>
                                <h3 className="text-xl font-black mb-3 text-slate-900 dark:text-white">{feature.title}</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonial / Trust Section */}
            <section className="py-24 px-4 relative bg-slate-50 dark:bg-slate-950">
                <div className="max-w-4xl mx-auto text-center space-y-8">
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold tracking-widest uppercase text-xs">Trusted by experts</p>
                    <blockquote className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white leading-tight italic">
                        "Toeasy has completely transformed how we handle our financial data. What used to take days of manual cleaning now takes minutes."
                    </blockquote>
                    <div className="flex items-center justify-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500"></div>
                        <div className="text-left">
                            <p className="font-bold text-slate-900 dark:text-white">Alex Rivera</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Head of Data, FinTech Corp</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-4 overflow-hidden">
                <div className="max-w-5xl mx-auto rounded-[40px] bg-indigo-600 p-12 md:p-24 text-center text-white relative">
                    <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent"></div>
                    </div>
                    <div className="relative space-y-8">
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight">Ready to clean your data?</h2>
                        <p className="text-indigo-100 text-lg opacity-80 max-w-xl mx-auto font-medium">Join 500+ teams automating their data governance today.</p>
                        <div className="pt-4">
                            <Link
                                to="/signup"
                                className="inline-block px-10 py-5 rounded-2xl bg-white text-indigo-600 font-black shadow-2xl transition-all hover:scale-110 active:scale-95 text-lg"
                            >
                                Get started for free
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
