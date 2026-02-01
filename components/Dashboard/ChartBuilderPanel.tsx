
import React, { useState, useEffect } from 'react';
import { ChartSpec, Dataset } from '../../types';
import { SmartChart } from './SmartChart';
import { GroqService } from '../../services/groqService';
import { aggregateData } from '../../src/utils/dashboardHelper';

interface ChartBuilderPanelProps {
    dataset: Dataset;
    initialChart?: ChartSpec;
    onSave: (chart: ChartSpec) => void;
    onCancel: () => void;
    onAIAction?: () => void;
}

type Tab = 'data' | 'visual' | 'ai';

export const ChartBuilderPanel: React.FC<ChartBuilderPanelProps> = ({ dataset, initialChart, onSave, onCancel, onAIAction }) => {
    const [chart, setChart] = useState<ChartSpec>(initialChart || {
        id: `chart-${Date.now()}`,
        title: 'New Chart',
        type: 'bar',
        priority: 'high',
        size: 'medium',
        xAxis: (dataset.headers || [])[0] || '',
        yAxis: (dataset.headers || [])[1] || '',
        aggregation: 'sum',
        data: [],
        options: {},
        layout: { w: 6, h: 6 }
    });

    const [activeTab, setActiveTab] = useState<Tab>('data');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);

    // Workflow State
    const [workflowStep, setWorkflowStep] = useState<'init' | 'builder'>(initialChart ? 'builder' : 'init');
    const [initPrompt, setInitPrompt] = useState('');

    // Handle AI Initialization
    const handleInitFromAI = async () => {
        if (!initPrompt) return;
        setIsAiThinking(true);
        if (onAIAction) onAIAction();
        try {
            // Generate a chart from scratch using the prompt
            const newSpec = await GroqService.generateChartFromPrompt(dataset, initPrompt);
            setChart({ ...newSpec, id: chart.id }); // Keep the ID
            setWorkflowStep('builder');
        } catch (e) {
            console.error(e);
            alert('Could not generate chart. Switching to manual mode.');
            setWorkflowStep('builder');
        } finally {
            setIsAiThinking(false);
        }
    };

    // Live Preview Data
    const previewData = React.useMemo(() => {
        try {
            return aggregateData(chart, dataset, dataset.data);
        } catch (e) {
            return [];
        }
    }, [chart, dataset]);

    const handleAiEdit = async () => {
        if (!aiPrompt) return;
        setIsAiThinking(true);
        if (onAIAction) onAIAction();
        try {
            const newSpec = await GroqService.modifyChartWithAI(dataset, chart, aiPrompt);
            setChart({ ...newSpec, id: chart.id }); // Keep ID
            setAiPrompt('');
        } catch (e) {
            console.error(e);
            alert('AI modification failed');
        } finally {
            setIsAiThinking(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            {workflowStep === 'init' ? (
                // --- INITIALIZATION STEP (AI FIRST) ---
                <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-2xl p-10 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 flex flex-col items-center text-center relative overflow-hidden">
                    {/* Ambient Glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 blur-[100px] pointer-events-none" />

                    <div className="relative group">
                        <div className="absolute inset-0 bg-indigo-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
                        <div className="relative w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/30">
                            <span className="text-4xl animate-bounce-slow">✨</span>
                        </div>
                    </div>

                    <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">AI Vision Studio</h2>
                    <p className="text-slate-500 mb-10 max-w-md text-sm font-medium leading-relaxed">
                        Describe your analytical goal in plain English. <br />
                        <span className="text-indigo-500">ToEasy AI</span> will sculpt the perfect visualization for your data.
                    </p>

                    <div className="w-full relative mb-8 group">
                        <textarea
                            value={initPrompt}
                            onChange={(e) => setInitPrompt(e.target.value)}
                            placeholder="e.g. 'Compare revenue across different product lines for the last quarter'..."
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[24px] p-8 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none h-40 shadow-inner group-hover:bg-white dark:group-hover:bg-slate-900"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleInitFromAI();
                                }
                            }}
                        />
                        <div className="absolute bottom-6 right-8 flex items-center gap-2">
                            <div className="text-[10px] uppercase font-black text-slate-400 tracking-widest hidden md:block">
                                Powered by Groq AI
                            </div>
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                        </div>
                    </div>

                    <div className="flex gap-4 w-full">
                        <button
                            onClick={() => setWorkflowStep('builder')}
                            className="flex-1 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                        >
                            Manual Build
                        </button>
                        <button
                            onClick={handleInitFromAI}
                            disabled={!initPrompt || isAiThinking}
                            className="flex-[2] py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                        >
                            {isAiThinking ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    <span>Conceptualizing...</span>
                                </>
                            ) : (
                                <>
                                    <span>Ignite AI Draft</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </>
                            )}
                        </button>
                    </div>
                    <button onClick={onCancel} className="mt-10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors">Discard Draft</button>
                </div>
            ) : (
                // --- BUILDER STEP (EXISTING UI) ---
                <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-7xl h-[90vh] shadow-2xl flex overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">

                    {/* Left: Preview Area */}
                    <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 md:p-12 flex flex-col relative border-r border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em]">Live Preview</span>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{chart.title}</h2>
                            </div>
                            {/* Data Peek (Small Table Preview) */}
                            <div className="text-[10px] text-slate-400 font-mono">
                                {previewData.length} data points generated
                            </div>
                        </div>

                        <div className="flex-1 w-full bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-inner border border-slate-100 dark:border-slate-800 relative z-0">
                            {previewData.length > 0 ? (
                                <SmartChart chart={chart} data={previewData} hideHeader hidePadding />
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-400 font-medium">
                                    No data to display. Check axes configuration.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Controls Panel */}
                    <div className="w-full md:w-[450px] bg-white dark:bg-slate-900 flex flex-col border-l border-slate-200 dark:border-slate-800">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900 dark:text-white">Chart Builder</h3>
                            <button onClick={onCancel} className="text-slate-400 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 pt-2">
                            {(['data', 'visual', 'ai'] as Tab[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest relative ${activeTab === tab
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                >
                                    {tab}
                                    {activeTab === tab && (
                                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Content Scroll Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

                            {/* DATA TAB */}
                            {activeTab === 'data' && (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Dimension (X-Axis / Group By)</label>
                                            <select
                                                value={chart.xAxis || chart.groupBy}
                                                onChange={(e) => setChart({ ...chart, xAxis: e.target.value, groupBy: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            >
                                                <option value="">Select Category...</option>
                                                {(dataset.headers || []).map(h => {
                                                    const sample = dataset.data?.[0]?.[h];
                                                    if (typeof sample === 'number') return null; // Simple filter for dimensions
                                                    return <option key={h} value={h}>{h}</option>;
                                                })}
                                                <optgroup label="Other Columns">
                                                    {(dataset.headers || []).map(h => {
                                                        const sample = dataset.data?.[0]?.[h];
                                                        if (typeof sample !== 'number') return null;
                                                        return <option key={h} value={h}>{h}</option>;
                                                    })}
                                                </optgroup>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Measure (Y-Axis / Value)</label>
                                            <select
                                                value={chart.yAxis}
                                                onChange={(e) => setChart({ ...chart, yAxis: e.target.value, aggregation: chart.aggregation || 'sum' })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500/20"
                                            >
                                                <option value="">Select Numeric Field...</option>
                                                <option value="count">-- Count of Records --</option>
                                                {(dataset.headers || []).map(h => {
                                                    const sample = dataset.data?.[0]?.[h];
                                                    if (typeof sample !== 'number') return null;
                                                    return <option key={h} value={h}>{h}</option>;
                                                })}
                                                <optgroup label="All Columns">
                                                    {(dataset.headers || []).map(h => <option key={h} value={h}>{h}</option>)}
                                                </optgroup>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Aggregation</label>
                                            <select
                                                value={chart.aggregation || 'sum'}
                                                onChange={(e) => setChart({ ...chart, aggregation: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                                            >
                                                <option value="sum">Sum</option>
                                                <option value="avg">Average</option>
                                                <option value="count">Count</option>
                                                <option value="max">Maximum</option>
                                                <option value="min">Minimum</option>
                                                <option value="unique">Unique Count</option>
                                                <option value="formula">Custom Formula</option>
                                            </select>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Limit (Top N)</label>
                                            <input
                                                type="number"
                                                value={chart.limit || 20}
                                                onChange={(e) => setChart({ ...chart, limit: Number(e.target.value) })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                    </div>

                                    {chart.aggregation === 'formula' && (
                                        <div className="space-y-3 p-4 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">JS Formula Logic</label>
                                                <span className="text-[9px] text-slate-400 font-mono">row['Column'] * 1.5</span>
                                            </div>
                                            <textarea
                                                value={chart.formula || ''}
                                                onChange={(e) => setChart({ ...chart, formula: e.target.value })}
                                                placeholder="e.g. row['Revenue'] - row['Cost']"
                                                className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/20 h-24"
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Z-Axis / Size (Optional)</label>
                                        <select
                                            value={chart.zAxis || ''}
                                            onChange={(e) => setChart({ ...chart, zAxis: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                        >
                                            <option value="">None</option>
                                            {(dataset.headers || []).map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* VISUAL TAB */}
                            {activeTab === 'visual' && (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Chart Title</label>
                                        <input
                                            value={chart.title}
                                            onChange={(e) => setChart({ ...chart, title: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Chart Type</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: 'bar', label: 'Bar', icon: '📊' },
                                                { id: 'line', label: 'Line', icon: '📈' },
                                                { id: 'area', label: 'Area', icon: '📉' },
                                                { id: 'pie', label: 'Pie', icon: '🍕' },
                                                { id: 'donut', label: 'Donut', icon: '🍩' },
                                                { id: 'scatter', label: 'Scatter', icon: '🌌' },
                                                { id: 'bubble', label: 'Bubble', icon: '🧼' },
                                                { id: 'heatmap', label: 'Heatmap', icon: '🔥' },
                                                { id: 'funnel', label: 'Funnel', icon: '🌪️' },
                                                { id: 'radar', label: 'Radar', icon: '🕸️' },
                                                { id: 'gauge', label: 'Gauge', icon: '⏲️' },
                                                { id: 'treemap', label: 'Treemap', icon: '🌳' },
                                                { id: 'choropleth', label: 'Map', icon: '🗺️' },
                                                { id: 'sunburst', label: 'Sunburst', icon: '☀️' },
                                                { id: 'box', label: 'Box Plot', icon: '🍱' },
                                                { id: 'violin', label: 'Violin', icon: '🎻' },
                                            ].map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setChart({ ...chart, type: t.id })}
                                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${chart.type === t.id
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30'
                                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                                        }`}
                                                >
                                                    <span className="text-xl">{t.icon}</span>
                                                    <span className="text-[9px] font-black uppercase tracking-wide">{t.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Color Palette</label>
                                        <div className="grid grid-cols-4 gap-3">
                                            {[
                                                { id: 'indigo', color: '#6366f1', label: 'Indigo' },
                                                { id: 'emerald', color: '#10b981', label: 'Emerald' },
                                                { id: 'vibrant', color: '#f43f5e', label: 'Vibrant' },
                                                { id: 'ocean', color: '#0ea5e9', label: 'Ocean' },
                                                { id: 'sunset', color: '#f59e0b', label: 'Sunset' },
                                                { id: 'forest', color: '#22c55e', label: 'Forest' },
                                                { id: 'royal', color: '#8b5cf6', label: 'Royal' },
                                                { id: 'minimal', color: '#64748b', label: 'Minimal' }
                                            ].map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setChart({ ...chart, colorScheme: p.id })}
                                                    className={`group flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${chart.colorScheme === p.id
                                                        ? 'border-slate-900 dark:border-white'
                                                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                                                        }`}
                                                >
                                                    <div className="w-8 h-8 rounded-full shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: p.color }} />
                                                    <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500">{p.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Legend & Labels</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                <input type="checkbox" checked={chart.showOther !== false} onChange={(e) => setChart({ ...chart, showOther: e.target.checked })} className="rounded text-indigo-600" />
                                                Show "Other" Category
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI TAB */}
                            {activeTab === 'ai' && (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">✨</div>
                                            <h4 className="font-bold text-indigo-900 dark:text-indigo-200">AI Architecture</h4>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                                            Describe how you want this chart to look or verify. The AI will configure the X/Y axes and aggregation settings for you.
                                        </p>
                                        <textarea
                                            value={aiPrompt}
                                            onChange={(e) => setAiPrompt(e.target.value)}
                                            placeholder="e.g. 'Show me the top 5 products by revenue as a pie chart' or 'Colors should be more vibrant'"
                                            className="w-full bg-white dark:bg-slate-950 border-none rounded-xl p-4 text-xs font-bold min-h-[120px] resize-none focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
                                        />
                                        <button
                                            onClick={handleAiEdit}
                                            disabled={!aiPrompt || isAiThinking}
                                            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                        >
                                            {isAiThinking ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                                    Optimizing...
                                                </>
                                            ) : (
                                                <>
                                                    <span>Apply AI Changes</span>
                                                    <span>→</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-4">
                            <button
                                onClick={onCancel}
                                className="flex-1 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => onSave(chart)}
                                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Save Chart
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
