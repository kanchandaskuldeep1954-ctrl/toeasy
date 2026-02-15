import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Activity, CheckCircle2, ArrowRight, Zap, Target, BarChart2 } from 'lucide-react';
import { useActivity } from '../../context/ActivityContext';
import { useDataset } from '../../hooks/useDataset';

export const WorkspaceIntelligence: React.FC = () => {
    const { activities } = useActivity();
    const { activeDataset } = useDataset();

    // Derived AI Suggestions (Mocked logic for now, could call LLM)
    const suggestions = useMemo(() => {
        const list = [];
        if (activeDataset) {
            list.push({
                id: 'suggest-1',
                title: 'Data Quality Analysis',
                description: `I noticed inconsistencies in "${activeDataset.name}". Should I run a clean-up?`,
                icon: Zap,
                color: 'text-amber-400',
                bg: 'bg-amber-400/10'
            });
            list.push({
                id: 'suggest-2',
                title: 'Generate Insights',
                description: 'Ready to build a revenue dashboard from your latest data.',
                icon: BarChart2,
                color: 'text-blue-400',
                bg: 'bg-blue-400/10'
            });
        } else {
            list.push({
                id: 'suggest-3',
                title: 'Import Sales Data',
                description: 'Connect your latest source to get started with automated reporting.',
                icon: Sparkles,
                color: 'text-indigo-400',
                bg: 'bg-indigo-400/10'
            });
        }
        return list;
    }, [activeDataset]);

    // Get last 3 activities
    const recentActivity = activities.slice(0, 3);

    return (
        <div className="mb-8 space-y-6">
            {/* AI Proactive Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestions.map((suggestion, idx) => (
                    <motion.div
                        key={suggestion.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group relative overflow-hidden"
                    >
                        {/* Glassmorphism gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex items-start gap-4">
                            <div className={`p-2.5 rounded-xl ${suggestion.bg} ${suggestion.color}`}>
                                <suggestion.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-sm text-white">{suggestion.title}</h4>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded">AI Suggestion</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{suggestion.description}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors self-center" />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Auto-Activity Feed Summary */}
            <div className="bg-slate-900/30 rounded-2xl border border-white/5 p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Auto-Tracking Intelligence</h3>
                    </div>
                </div>

                <div className="space-y-3">
                    {recentActivity.length > 0 ? (
                        recentActivity.map((activity, idx) => (
                            <div key={activity.id} className="flex items-center gap-3 text-xs animate-in fade-in slide-in-from-left duration-300">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
                                <span className="text-slate-300 font-medium">{activity.action_detail}</span>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-500">
                                    {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {idx === 0 && (
                                    <span className="ml-auto text-emerald-500 font-medium">Just now</span>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-500 italic px-4 py-2">No system activity detected yet. Start work to see auto-tracking.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
