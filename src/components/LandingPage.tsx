import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Reveal } from './Motion/Reveal';

/* ──────────────────────────────────────────────────────────
   TOEASY — "Kill Your Monday Meeting" Landing Page
   Hunger-Test MVP: Decision Execution BI for RevOps
   ────────────────────────────────────────────────────────── */

const LandingPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleWaitlist = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim()) {
            // TODO: wire to backend /api/waitlist endpoint
            setSubmitted(true);
        }
    };

    return (
        <div className="relative overflow-hidden bg-[#09090b] text-white selection:bg-blue-500/30">
            {/* ═══════════════════════════════════════════════════
          HERO SECTION
         ═══════════════════════════════════════════════════ */}
            <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
                {/* Gradient Orbs */}
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[100px] pointer-events-none" />
                <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />

                {/* Grid pattern overlay */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-60 pointer-events-none" />

                <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-sm"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-xs font-semibold tracking-widest uppercase text-blue-300">
                            Now accepting pilot teams
                        </span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.15 }}
                        className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05]"
                    >
                        Kill Your{' '}
                        <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                            Monday Meeting.
                        </span>
                    </motion.h1>

                    {/* Sub-headline */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.35 }}
                        className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed"
                    >
                        Upload your data. Get an AI-generated weekly brief with evidence.
                        Approve decisions in one click. Track every action to completion.
                        <span className="text-white font-semibold"> From data to decision in 30 minutes.</span>
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
                    >
                        <Link
                            to="/signup"
                            className="group w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-lg shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                        >
                            Start Your First Brief
                            <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>→</motion.span>
                        </Link>
                        <Link
                            to="/login"
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm text-white font-semibold transition-all hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-95"
                        >
                            See a live demo
                        </Link>
                    </motion.div>

                    {/* Social proof counter */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                        className="text-sm text-slate-500 pt-2"
                    >
                        <span className="text-slate-300 font-semibold">50+ RevOps teams</span> testing the future of weekly reviews
                    </motion.p>
                </div>

                {/* Hero Visual — Decision Brief mockup */}
                <motion.div
                    initial={{ opacity: 0, y: 80 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.6, ease: 'circOut' }}
                    className="relative z-10 mt-16 md:mt-24 max-w-5xl w-full mx-auto px-4"
                >
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-3 md:p-5 shadow-2xl shadow-blue-900/20">
                        <div className="rounded-2xl bg-[#111113] border border-white/5 overflow-hidden">
                            {/* Mock Brief UI */}
                            <div className="p-6 md:p-10 space-y-6">
                                {/* Brief Header */}
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Weekly Brief</p>
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-bold text-white">Week 8 — Revenue Operations</h3>
                                        <p className="text-sm text-slate-500">Auto-generated Feb 21, 2026 · 4 findings · 3 actions</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
                                            ✓ 92% Evidence Coverage
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-white/5" />

                                {/* Key Findings */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { severity: 'high', title: 'Pipeline coverage dropped to 2.4x', insight: 'Below 3x threshold — historically correlates with 15% revenue miss', trend: '↓' },
                                        { severity: 'medium', title: 'Enterprise deal velocity slowed', insight: 'Avg days to close up 12% vs last quarter', trend: '↓' },
                                        { severity: 'low', title: 'SMB conversion rate up 8%', insight: 'New onboarding flow showing strong early signal', trend: '↑' },
                                        { severity: 'high', title: 'Churn risk flagged: 3 accounts', insight: 'Engagement scores dropped below threshold this week', trend: '↓' },
                                    ].map((finding, i) => (
                                        <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`w-2 h-2 rounded-full ${finding.severity === 'high' ? 'bg-red-500' : finding.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                <span className="text-sm font-semibold text-white">{finding.title}</span>
                                                <span className={`ml-auto text-lg ${finding.trend === '↑' ? 'text-emerald-400' : 'text-red-400'}`}>{finding.trend}</span>
                                            </div>
                                            <p className="text-xs text-slate-500">{finding.insight}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Action Items */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Recommended Actions</p>
                                    {[
                                        { title: 'Run targeted outbound for pipeline recovery', owner: 'Sales Lead', priority: 'High' },
                                        { title: 'Schedule churn-risk account reviews', owner: 'CS Manager', priority: 'High' },
                                        { title: 'Scale SMB onboarding flow to mid-market', owner: 'Growth Lead', priority: 'Medium' },
                                    ].map((action, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                                            <div className="w-5 h-5 rounded border-2 border-blue-500/50 flex-shrink-0" />
                                            <span className="text-sm text-white font-medium flex-1">{action.title}</span>
                                            <span className="text-xs text-slate-500 hidden sm:inline">→ {action.owner}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${action.priority === 'High' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                                {action.priority}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Approve bar */}
                                <div className="flex items-center justify-between pt-2 flex-wrap gap-4">
                                    <p className="text-xs text-slate-500">Ready for manager approval</p>
                                    <div className="flex gap-2">
                                        <button className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-slate-400 hover:bg-white/10 transition-colors">
                                            Reject
                                        </button>
                                        <button className="px-5 py-2 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/25">
                                            ✓ Approve & Assign
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ═══════════════════════════════════════════════════
          THE PROBLEM SECTION
         ═══════════════════════════════════════════════════ */}
            <section className="py-24 md:py-32 px-4 relative">
                <div className="max-w-5xl mx-auto">
                    <Reveal width="100%">
                        <div className="text-center space-y-4 mb-16">
                            <p className="text-xs font-semibold text-red-400 uppercase tracking-[0.3em]">The Problem</p>
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                                Your team spends <span className="text-red-400">62% of their day</span> on work about work.
                            </h2>
                            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                                Dashboards show what happened. Meetings discuss what it means.
                                Google Docs capture action items. Nobody tracks them.
                                <span className="text-white font-semibold"> Repeat every Monday.</span>
                            </p>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                stat: '72%',
                                label: 'of meetings are unproductive',
                                sublabel: 'Yet managers spend 13+ hrs/week in them',
                                color: 'red',
                            },
                            {
                                stat: '209hrs',
                                label: 'wasted on duplicated work yearly',
                                sublabel: 'Per knowledge worker, every year',
                                color: 'amber',
                            },
                            {
                                stat: '0%',
                                label: 'of BI tools track the action',
                                sublabel: 'Dashboards stop at "here\u2019s your chart"',
                                color: 'red',
                            },
                        ].map((item, i) => (
                            <Reveal key={i} delay={0.15 * (i + 1)}>
                                <div className="p-8 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group h-full">
                                    <p className={`text-4xl md:text-5xl font-black mb-3 ${item.color === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                                        {item.stat}
                                    </p>
                                    <p className="text-lg font-bold text-white mb-1">{item.label}</p>
                                    <p className="text-sm text-slate-500">{item.sublabel}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
          HOW IT WORKS (The Decision Loop)
         ═══════════════════════════════════════════════════ */}
            <section className="py-24 md:py-32 px-4 relative border-t border-white/5">
                <div className="max-w-5xl mx-auto">
                    <Reveal width="100%">
                        <div className="text-center space-y-4 mb-20">
                            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.3em]">How It Works</p>
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                                From data to done in <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">three steps</span>
                            </h2>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        {/* Connecting line */}
                        <div className="hidden md:block absolute top-[60px] left-[20%] right-[20%] h-[2px] bg-gradient-to-r from-blue-500/30 via-cyan-500/30 to-violet-500/30" />

                        {[
                            {
                                step: '01',
                                title: 'Connect Your Data',
                                desc: 'Upload a CSV, connect Google Sheets, or plug in Postgres/MySQL. Toeasy auto-analyzes and generates an AI dashboard in seconds.',
                                gradient: 'from-blue-600 to-blue-500',
                            },
                            {
                                step: '02',
                                title: 'AI Generates Your Brief',
                                desc: 'Every week, AI reads your latest data, identifies what changed, flags risks, and drafts a decision-ready brief with evidence-linked findings.',
                                gradient: 'from-cyan-600 to-cyan-500',
                            },
                            {
                                step: '03',
                                title: 'Approve, Assign, Track',
                                desc: 'Manager approves the brief in one click. Action items auto-create with owners. Status syncs to Slack. No meeting required.',
                                gradient: 'from-violet-600 to-violet-500',
                            },
                        ].map((item, i) => (
                            <Reveal key={i} delay={0.2 * (i + 1)}>
                                <div className="relative group">
                                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                                        <span className="text-xl font-black text-white">{item.step}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white text-center mb-3">{item.title}</h3>
                                    <p className="text-sm text-slate-400 text-center leading-relaxed">{item.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
          FEATURES — What Makes Toeasy Different
         ═══════════════════════════════════════════════════ */}
            <section className="py-24 md:py-32 px-4 relative border-t border-white/5">
                <div className="max-w-5xl mx-auto">
                    <Reveal width="100%">
                        <div className="text-center space-y-4 mb-16">
                            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-[0.3em]">Why Toeasy</p>
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                                Not another dashboard tool.
                            </h2>
                            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                                Dashboards show data. Toeasy <span className="text-white font-semibold">closes the loop</span> — from insight to owned action with evidence.
                            </p>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            {
                                icon: '📊',
                                title: 'AI Weekly Brief',
                                desc: 'Auto-generated narrative with evidence-linked findings. No more "what does this chart mean?" conversations.',
                                badge: 'Core',
                            },
                            {
                                icon: '🔒',
                                title: 'Evidence-Backed Decisions',
                                desc: 'Every approval is linked to data proof. No more gut-feel decisions or "who said that?" arguments.',
                                badge: 'Trust',
                            },
                            {
                                icon: '⚡',
                                title: 'One-Click Action Items',
                                desc: 'Brief approved → action items auto-created → owners assigned → Slack notified. Zero coordination overhead.',
                                badge: 'Speed',
                            },
                            {
                                icon: '📈',
                                title: 'Decision Velocity Score',
                                desc: 'Track how fast your team goes from data anomaly to assigned action. The fitness tracker for operational speed.',
                                badge: 'Metric',
                            },
                            {
                                icon: '🔄',
                                title: 'Decision Replay',
                                desc: 'Full audit trail: what was decided, what data backed it, what actions followed, and what the outcome was.',
                                badge: 'Memory',
                            },
                            {
                                icon: '💬',
                                title: 'Slack-Native Sync',
                                desc: 'Actions and status updates flow to Slack automatically. No more "hey, did you see my message?" follow-ups.',
                                badge: 'Flow',
                            },
                        ].map((feature, i) => (
                            <Reveal key={i} delay={0.1 * (i + 1)}>
                                <div className="p-8 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all group h-full">
                                    <div className="flex items-start gap-4">
                                        <span className="text-3xl">{feature.icon}</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    {feature.badge}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
                                        </div>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
          COMPARISON — US vs. THEM
         ═══════════════════════════════════════════════════ */}
            <section className="py-24 md:py-32 px-4 relative border-t border-white/5">
                <div className="max-w-4xl mx-auto">
                    <Reveal width="100%">
                        <div className="text-center space-y-4 mb-16">
                            <p className="text-xs font-semibold text-violet-400 uppercase tracking-[0.3em]">The Gap</p>
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                                Where every other tool stops
                            </h2>
                        </div>
                    </Reveal>

                    <Reveal>
                        <div className="rounded-2xl border border-white/5 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5 bg-white/[0.02]">
                                        <th className="text-left py-4 px-6 text-slate-400 font-semibold">Capability</th>
                                        <th className="text-center py-4 px-4 text-slate-500 font-semibold">Traditional BI</th>
                                        <th className="text-center py-4 px-4 text-slate-500 font-semibold">CRM Tools</th>
                                        <th className="text-center py-4 px-4 font-bold text-blue-400">Toeasy</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { cap: 'Visualize data', bi: true, crm: false, te: true },
                                        { cap: 'AI-generated insights', bi: false, crm: false, te: true },
                                        { cap: 'Weekly decision brief', bi: false, crm: false, te: true },
                                        { cap: 'Evidence-linked approvals', bi: false, crm: false, te: true },
                                        { cap: 'Auto-created action items', bi: false, crm: false, te: true },
                                        { cap: 'Slack sync', bi: false, crm: true, te: true },
                                        { cap: 'Decision audit trail', bi: false, crm: false, te: true },
                                    ].map((row, i) => (
                                        <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                            <td className="py-3.5 px-6 text-slate-300 font-medium">{row.cap}</td>
                                            <td className="py-3.5 px-4 text-center">{row.bi ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">✗</span>}</td>
                                            <td className="py-3.5 px-4 text-center">{row.crm ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">✗</span>}</td>
                                            <td className="py-3.5 px-4 text-center"><span className="text-emerald-400 font-bold">✓</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
          PRICING — Simple & Clear
         ═══════════════════════════════════════════════════ */}
            <section className="py-24 md:py-32 px-4 relative border-t border-white/5">
                <div className="max-w-5xl mx-auto">
                    <Reveal width="100%">
                        <div className="text-center space-y-4 mb-16">
                            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-[0.3em]">Pricing</p>
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                                Simple pricing. Real value.
                            </h2>
                            <p className="text-lg text-slate-400">Pay for decisions made faster, not dashboard seats.</p>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        {[
                            {
                                name: 'Solo Analyst',
                                price: '$49',
                                period: '/month',
                                desc: 'For individual analysts running their own reviews',
                                features: ['3 datasets', 'AI weekly briefs', 'Basic dashboards', 'Email support'],
                                cta: 'Start free trial',
                                highlight: false,
                            },
                            {
                                name: 'Team Pilot',
                                price: '$1,999',
                                period: '/month',
                                desc: 'For RevOps teams ready to kill their Monday meeting',
                                features: ['Unlimited datasets', 'AI weekly briefs', 'Action items + tracking', 'Slack sync', 'Evidence-backed approvals', 'Dedicated onboarding', 'Priority support'],
                                cta: 'Start 90-day pilot',
                                highlight: true,
                            },
                            {
                                name: 'Annual',
                                price: '$18k',
                                period: '/year',
                                desc: 'For teams committed to operational velocity',
                                features: ['Everything in Pilot', 'Decision velocity scoring', 'Custom integrations', 'Decision replay & audit', 'SLA guarantee'],
                                cta: 'Talk to us',
                                highlight: false,
                            },
                        ].map((plan, i) => (
                            <Reveal key={i} delay={0.15 * (i + 1)}>
                                <div className={`p-8 rounded-2xl border h-full flex flex-col ${plan.highlight ? 'border-blue-500/30 bg-blue-500/5 shadow-lg shadow-blue-900/20 relative' : 'border-white/5 bg-white/[0.02]'}`}>
                                    {plan.highlight && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-[10px] font-bold uppercase tracking-widest text-white">
                                            Most Popular
                                        </div>
                                    )}
                                    <p className="text-sm font-semibold text-slate-400 mb-1">{plan.name}</p>
                                    <div className="flex items-baseline gap-1 mb-2">
                                        <span className="text-4xl font-black text-white">{plan.price}</span>
                                        <span className="text-sm text-slate-500">{plan.period}</span>
                                    </div>
                                    <p className="text-sm text-slate-500 mb-6">{plan.desc}</p>
                                    <ul className="space-y-2.5 mb-8 flex-1">
                                        {plan.features.map((f, j) => (
                                            <li key={j} className="flex items-center gap-2 text-sm text-slate-300">
                                                <span className="text-emerald-500 text-xs">✓</span>
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                    <Link
                                        to="/signup"
                                        className={`w-full py-3 rounded-xl text-sm font-bold text-center transition-all active:scale-95 block ${plan.highlight ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/25' : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'}`}
                                    >
                                        {plan.cta}
                                    </Link>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
          CTA — WAITLIST
         ═══════════════════════════════════════════════════ */}
            <section className="py-24 md:py-32 px-4 relative border-t border-white/5">
                <Reveal width="100%">
                    <div className="max-w-3xl mx-auto text-center space-y-8">
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight">
                            Ready to make{' '}
                            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                                decisions faster?
                            </span>
                        </h2>
                        <p className="text-lg text-slate-400 max-w-xl mx-auto">
                            Join the pilot program. Get onboarded in a day. See your first AI-generated brief by next Monday.
                        </p>

                        <AnimatePresence mode="wait">
                            {!submitted ? (
                                <motion.form
                                    key="form"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    onSubmit={handleWaitlist}
                                    className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                                >
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        required
                                        className="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-sm"
                                    />
                                    <button
                                        type="submit"
                                        className="px-6 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/25 active:scale-95"
                                    >
                                        Join Pilot
                                    </button>
                                </motion.form>
                            ) : (
                                <motion.div
                                    key="thanks"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center justify-center gap-2 text-emerald-400 font-semibold"
                                >
                                    <span className="text-2xl">✓</span>
                                    <span>You're on the list! We'll reach out within 48 hours.</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <p className="text-xs text-slate-600">
                            No credit card required · Reply within 48 hours · Cancel anytime
                        </p>
                    </div>
                </Reveal>
            </section>

            {/* ═══════════════════════════════════════════════════
          FOOTER
         ═══════════════════════════════════════════════════ */}
            <footer className="py-12 px-4 border-t border-white/5">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                            <span className="text-xs font-black text-white">T</span>
                        </div>
                        <span className="font-bold text-lg text-white">Toeasy</span>
                    </div>
                    <div className="flex gap-6 text-sm text-slate-500">
                        <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
                        <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
                        <a href="mailto:support@toeasy.online" className="hover:text-white transition-colors">support@toeasy.online</a>
                    </div>
                    <p className="text-xs text-slate-600">© 2026 Toeasy. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
