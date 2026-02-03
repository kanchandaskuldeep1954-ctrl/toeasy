/**
 * AILayoutSuggester - AI-powered layout generation
 * Suggests dashboard layouts based on dataset columns
 */

import React, { useState } from 'react';
import {
    Layout,
    Sparkles,
    BarChart3,
    LineChart,
    PieChart,
    ArrowRight
} from 'lucide-react';
import { Dataset } from '../../types';

interface AILayoutSuggesterProps {
    dataset: Dataset;
    onApplyLayout: (layout: any[]) => void;
    isOpen: boolean;
    onClose: () => void;
}

const LAYOUT_TEMPLATES = [
    {
        id: 'executive',
        name: 'Executive Overview',
        description: 'High-level KPIs with trend lines',
        icon: <Layout className="w-5 h-5" />,
        preview: [
            { i: 'kpi1', x: 0, y: 0, w: 3, h: 2, type: 'kpi' },
            { i: 'kpi2', x: 3, y: 0, w: 3, h: 2, type: 'kpi' },
            { i: 'kpi3', x: 6, y: 0, w: 3, h: 2, type: 'kpi' },
            { i: 'kpi4', x: 9, y: 0, w: 3, h: 2, type: 'kpi' },
            { i: 'trend', x: 0, y: 2, w: 8, h: 4, type: 'line' },
            { i: 'dist', x: 8, y: 2, w: 4, h: 4, type: 'pie' }
        ]
    },
    {
        id: 'sales',
        name: 'Sales Performance',
        description: 'Regional breakdown and top items',
        icon: <BarChart3 className="w-5 h-5" />,
        preview: [
            { i: 'total', x: 0, y: 0, w: 4, h: 2, type: 'kpi' },
            { i: 'growth', x: 4, y: 0, w: 4, h: 2, type: 'kpi' },
            { i: 'target', x: 8, y: 0, w: 4, h: 2, type: 'kpi' },
            { i: 'bar', x: 0, y: 2, w: 6, h: 4, type: 'bar' },
            { i: 'map', x: 6, y: 2, w: 6, h: 4, type: 'map' },
            { i: 'table', x: 0, y: 6, w: 12, h: 4, type: 'table' }
        ]
    },
    {
        id: 'trends',
        name: 'Trend Analysis',
        description: 'Deep dive into time-series data',
        icon: <LineChart className="w-5 h-5" />,
        preview: [
            { i: 'main_chart', x: 0, y: 0, w: 12, h: 5, type: 'line' },
            { i: 'sub_chart1', x: 0, y: 5, w: 4, h: 3, type: 'area' },
            { i: 'sub_chart2', x: 4, y: 5, w: 4, h: 3, type: 'bar' },
            { i: 'sub_chart3', x: 8, y: 5, w: 4, h: 3, type: 'scatter' }
        ]
    }
];

export const AILayoutSuggester: React.FC<AILayoutSuggesterProps> = ({
    dataset,
    onApplyLayout,
    isOpen,
    onClose
}) => {
    const [generating, setGenerating] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        setGenerating(true);
        // Simulate AI generation for now - ideally connects to GroqService
        setTimeout(() => {
            const template = LAYOUT_TEMPLATES.find(t => t.id === selectedTemplate) || LAYOUT_TEMPLATES[0];
            onApplyLayout(template.preview);
            setGenerating(false);
            onClose();
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">AI Layout Suggester</h2>
                            <p className="text-slate-400 text-sm">Choose a dashboard structure for your data</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {LAYOUT_TEMPLATES.map(template => (
                        <button
                            key={template.id}
                            onClick={() => setSelectedTemplate(template.id)}
                            className={`group relative p-4 rounded-xl border-2 text-left transition-all ${selectedTemplate === template.id
                                    ? 'border-indigo-500 bg-indigo-500/10'
                                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-800'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-lg mb-3 flex items-center justify-center transition-colors ${selectedTemplate === template.id
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-slate-800 text-slate-400 group-hover:text-white'
                                }`}>
                                {template.icon}
                            </div>
                            <h3 className="text-white font-bold mb-1">{template.name}</h3>
                            <p className="text-xs text-slate-500 leading-relaxed">{template.description}</p>

                            {selectedTemplate === template.id && (
                                <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center animate-in zoom-in">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={!selectedTemplate || generating}
                        className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                    >
                        {generating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                Generate Layout
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AILayoutSuggester;
