
import React, { useState, useEffect } from 'react';
import { ChartSpec, Dataset } from '../../types';
import { PlotlyChart } from './PlotlyChart';
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
        xAxis: dataset.headers[0] || '',
        yAxis: dataset.headers[1] || '',
        aggregation: 'sum',
        data: [],
        options: {}
    });

    const [activeTab, setActiveTab] = useState<Tab>('data');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);

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
                            <PlotlyChart chart={chart} data={previewData} />
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
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">X-Axis (Dimension)</label>
                                    <select
                                        value={chart.xAxis}
                                        onChange={(e) => setChart({ ...chart, xAxis: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    >
                                        <option value="">Select Column...</option>
                                        {dataset.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Y-Axis (Measure)</label>
                                    <select
                                        value={chart.yAxis}
                                        onChange={(e) => setChart({ ...chart, yAxis: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    >
                                        <option value="">Select Column...</option>
                                        {dataset.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
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
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Z-Axis / Size (Optional)</label>
                                    <select
                                        value={chart.zAxis || ''}
                                        onChange={(e) => setChart({ ...chart, zAxis: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    >
                                        <option value="">None</option>
                                        {dataset.headers.map(h => <option key={h} value={h}>{h}</option>)}
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
                                            { id: 'bar', label: 'Bar' },
                                            { id: 'line', label: 'Line' },
                                            { id: 'area', label: 'Area' },
                                            { id: 'pie', label: 'Pie' },
                                            { id: 'donut', label: 'Donut' },
                                            { id: 'scatter', label: 'Scatter' },
                                            { id: 'bubble', label: 'Bubble' },
                                            { id: 'heatmap', label: 'Heatmap' },
                                            { id: 'funnel', label: 'Funnel' },
                                            { id: 'radar', label: 'Radar' },
                                            { id: 'gauge', label: 'Gauge' },
                                            { id: 'treemap', label: 'Treemap' },
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setChart({ ...chart, type: t.id })}
                                                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${chart.type === t.id
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30'
                                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                                    }`}
                                            >
                                                {/* Simple Icon Placeholder */}
                                                <div className={`w-6 h-6 rounded-md ${chart.type === t.id ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                                <span className="text-[9px] font-black uppercase tracking-wide">{t.label}</span>
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
        </div>
    );
};
