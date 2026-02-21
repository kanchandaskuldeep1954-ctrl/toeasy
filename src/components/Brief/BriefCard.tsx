import React from 'react';
import { motion } from 'framer-motion';

/* ──────────────────────────────────────────────────────────
   BriefCard — Displays a generated weekly brief
   Shows findings, evidence coverage, actions, and approval UI
   ────────────────────────────────────────────────────────── */

interface Finding {
    title: string;
    insight: string;
    evidence: string;
    severity: 'high' | 'medium' | 'low';
    trend: 'up' | 'down' | 'stable';
}

interface RecommendedAction {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    suggestedOwnerRole: string;
    evidenceReference: string;
}

interface Brief {
    id?: string;
    executiveSummary: string;
    keyFindings: Finding[];
    recommendedActions: RecommendedAction[];
    dataQualityFlags: Array<{ column: string; issue: string }>;
    generatedAt: string;
    status: 'draft' | 'pending_review' | 'approved' | 'rejected';
    evidenceCoverage: number;
}

interface BriefCardProps {
    brief: Brief;
    datasetName: string;
    onApprove: () => void;
    onReject: () => void;
    onBack: () => void;
}

const severityColor = {
    high: 'bg-red-500',
    medium: 'bg-amber-500',
    low: 'bg-emerald-500',
};

const severityBadge = {
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const trendIcon = {
    up: '↑',
    down: '↓',
    stable: '→',
};

const trendColor = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    stable: 'text-slate-400',
};

const BriefCard: React.FC<BriefCardProps> = ({ brief, datasetName, onApprove, onReject, onBack }) => {
    const date = new Date(brief.generatedAt);
    const highFindings = brief.keyFindings.filter(f => f.severity === 'high').length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Brief Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${brief.status === 'pending_review' ? 'bg-amber-500 animate-pulse' : brief.status === 'approved' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                            {brief.status === 'pending_review' ? 'Pending Review' : brief.status === 'approved' ? 'Approved' : brief.status.replace('_', ' ')}
                        </p>
                    </div>
                    <h2 className="text-xl font-bold">Weekly Decision Brief</h2>
                    <p className="text-sm text-slate-500">
                        {datasetName} · Generated {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        · {brief.keyFindings.length} findings · {brief.recommendedActions.length} actions
                    </p>
                </div>
                <div className="flex gap-2">
                    <div className={`px-4 py-2 rounded-xl text-sm font-semibold ${brief.evidenceCoverage >= 90
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : brief.evidenceCoverage >= 70
                                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                : 'bg-red-500/10 border border-red-500/20 text-red-400'
                        }`}>
                        ✓ {brief.evidenceCoverage}% Evidence Coverage
                    </div>
                </div>
            </div>

            {/* Executive Summary */}
            <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Executive Summary</p>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                    {brief.executiveSummary.replace(/\*\*/g, '')}
                </p>
            </div>

            {/* Key Findings */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Key Findings</p>
                    {highFindings > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                            {highFindings} High Priority
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {brief.keyFindings.map((finding, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * i }}
                            className="p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${severityColor[finding.severity]}`} />
                                <span className="text-sm font-semibold text-white flex-1">{finding.title}</span>
                                <span className={`text-lg ${trendColor[finding.trend]}`}>{trendIcon[finding.trend]}</span>
                            </div>
                            <p className="text-xs text-slate-400 mb-3 leading-relaxed">{finding.insight}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                <span>{finding.evidence}</span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Recommended Actions */}
            <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Recommended Actions</p>
                <div className="space-y-2">
                    {brief.recommendedActions.map((action, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 * i }}
                            className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                        >
                            <div className="w-5 h-5 rounded border-2 border-blue-500/50 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white">{action.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{action.description}</p>
                            </div>
                            <span className="text-xs text-slate-500 hidden sm:inline flex-shrink-0">→ {action.suggestedOwnerRole}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex-shrink-0 ${severityBadge[action.priority]}`}>
                                {action.priority}
                            </span>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Data Quality Flags */}
            {brief.dataQualityFlags.length > 0 && (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">Data Quality Flags</p>
                    {brief.dataQualityFlags.map((flag, i) => (
                        <p key={i} className="text-xs text-amber-300/70">
                            <span className="font-semibold">{flag.column}</span>: {flag.issue}
                        </p>
                    ))}
                </div>
            )}

            {/* Approval Bar */}
            {brief.status === 'pending_review' && (
                <div className="flex items-center justify-between pt-2 border-t border-white/5 flex-wrap gap-4">
                    <button
                        onClick={onBack}
                        className="text-sm text-slate-500 hover:text-white transition-colors"
                    >
                        ← Change dataset
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onReject}
                            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-slate-400 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                        >
                            ✗ Reject
                        </button>
                        <button
                            onClick={onApprove}
                            className="px-8 py-3 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/25 active:scale-95"
                        >
                            ✓ Approve & Assign Actions
                        </button>
                    </div>
                </div>
            )}

            {brief.status === 'rejected' && (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-center">
                    <p className="text-red-400 font-semibold">Brief rejected.</p>
                    <button
                        onClick={onBack}
                        className="text-sm text-slate-400 hover:text-white mt-2 transition-colors"
                    >
                        ← Go back and try a different dataset
                    </button>
                </div>
            )}
        </motion.div>
    );
};

export default BriefCard;
