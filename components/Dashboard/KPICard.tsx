
import React, { useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { KPI, Dataset } from '../../types';
import { GroqService } from '../../services/groqService';

interface KPICardProps {
    kpi: KPI;
    dataset: Dataset;
    columns?: string[];
    onUpdate?: (updatedKpi: KPI) => void;
    onDelete?: (id: string) => void;
}

export const KPICard: React.FC<KPICardProps> = ({ kpi, dataset, columns = [], onUpdate, onDelete }) => {
    const { label, value, trend, trendDirection, status, sparklineData } = kpi;
    const [isEditing, setIsEditing] = useState(false);
    const [editConfig, setEditConfig] = useState(kpi);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);

    // Determine colors based on status or trend
    let statusColor = 'text-slate-400';
    let trendColor = 'text-slate-500';
    let bgColor = 'bg-slate-800/50';
    let borderColor = 'border-slate-700/50';
    let sparklineColor = '#94a3b8'; // slate-400

    if (status === 'on_track' || trendDirection === 'up') {
        statusColor = 'text-emerald-400';
        trendColor = 'text-emerald-500';
        sparklineColor = '#10b981';
        bgColor = 'bg-emerald-950/10';
        borderColor = 'border-emerald-500/20';
    } else if (status === 'off_track' || trendDirection === 'down') {
        statusColor = 'text-rose-400';
        trendColor = 'text-rose-500';
        sparklineColor = '#f43f5e';
        bgColor = 'bg-rose-950/10';
        borderColor = 'border-rose-500/20';
    } else if (status === 'at_risk') {
        statusColor = 'text-amber-400';
        trendColor = 'text-amber-500';
        sparklineColor = '#f59e0b';
        bgColor = 'bg-amber-950/10';
        borderColor = 'border-amber-500/20';
    }

    // Format sparkline data for Recharts
    const chartData = sparklineData ? sparklineData.map((val, idx) => ({ i: idx, v: val })) : [];

    const handleSave = () => {
        if (onUpdate) {
            onUpdate(editConfig);
        }
        setIsEditing(false);
    };

    const handleAiAssist = async () => {
        if (!aiPrompt) return;
        setIsAiThinking(true);
        try {
            const modified = await GroqService.modifyKPIWithAI(dataset, editConfig, aiPrompt);
            setEditConfig(modified);
            setAiPrompt('');
        } catch (e) {
            console.error(e);
            alert("AI could not modify this metric.");
        } finally {
            setIsAiThinking(false);
        }
    };

    if (isEditing) {
        return (
            <div className={`relative overflow-hidden rounded-xl border border-indigo-500/50 bg-slate-900 p-4 shadow-xl z-20 h-auto min-h-[160px] flex flex-col gap-3 animate-in zoom-in-95`}>
                <div className="flex justify-between items-center mb-2">
                    <input
                        value={editConfig.label}
                        onChange={e => setEditConfig({ ...editConfig, label: e.target.value })}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="KPI Title"
                    />
                    {onDelete && (
                        <button
                            onClick={() => onDelete(kpi.id)}
                            className="ml-2 p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                            title="Delete KPI"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    )}
                </div>

                {editConfig.calculation && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[9px] text-slate-400 uppercase font-bold">Column</label>
                            <select
                                value={editConfig.calculation.column}
                                onChange={e => setEditConfig({
                                    ...editConfig,
                                    calculation: { ...editConfig.calculation!, column: e.target.value }
                                })}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] text-white"
                            >
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Operation</label>
                            <select
                                value={editConfig.calculation.operation}
                                onChange={e => setEditConfig({
                                    ...editConfig,
                                    calculation: { ...editConfig.calculation!, operation: e.target.value as any }
                                })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-white focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all"
                            >
                                {['sum', 'avg', 'min', 'max', 'count', 'unique'].map(op => (
                                    <option key={op} value={op}>{op.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <label className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Format</label>
                            <select
                                value={editConfig.calculation.format || 'number'}
                                onChange={e => setEditConfig({
                                    ...editConfig,
                                    calculation: { ...editConfig.calculation!, format: e.target.value as any }
                                })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-white focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all"
                            >
                                <option value="number">Number (1,000)</option>
                                <option value="currency">Currency ($1,000)</option>
                                <option value="percentage">Percentage (50%)</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* AI Assist Section */}
                <div className="mt-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center">
                            <svg className={`w-2.5 h-2.5 text-indigo-400 ${isAiThinking ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Assist</span>
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAiAssist()}
                            placeholder="Ask AI to change settings..."
                            className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                        />
                        <button
                            onClick={handleAiAssist}
                            disabled={isAiThinking || !aiPrompt}
                            className="p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-auto pt-2">
                    <button onClick={() => setIsEditing(false)} className="text-[10px] font-bold text-slate-400 hover:text-white">Cancel</button>
                    <button onClick={handleSave} className="px-3 py-1 bg-indigo-600 rounded text-[10px] font-bold text-white hover:bg-indigo-500">Save</button>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden rounded-xl border ${borderColor} ${bgColor} p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg backdrop-blur-sm group`}>
            {/* Edit Trigger */}
            {onUpdate && (
                <button
                    onClick={() => { setEditConfig(kpi); setIsEditing(true); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 transition-all z-10"
                    title="Edit KPI"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
            )}

            <div className="flex justify-between items-start mb-2 pr-6">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider truncate" title={label}>{label}</h3>
                {status && (
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor.replace('text-', 'bg-')}`} />
                )}
            </div>

            <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-black text-white tracking-tight">{value}</span>
                {trend !== undefined && trend !== 0 && (
                    <span className={`text-xs font-bold ${trendColor} flex items-center`}>
                        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                )}
            </div>

            {/* Sparkline Area */}
            {chartData.length > 0 && (
                <div className="h-10 w-full mt-2 opacity-50 group-hover:opacity-80 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id={`gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={sparklineColor} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={sparklineColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="v"
                                stroke={sparklineColor}
                                fillOpacity={1}
                                fill={`url(#gradient-${kpi.id})`}
                                strokeWidth={2}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Ambient Glow */}
            <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 bg-${status === 'on_track' ? 'emerald' : status === 'off_track' ? 'rose' : 'slate'}-500 pointer-events-none`} />
        </div>
    );
};
