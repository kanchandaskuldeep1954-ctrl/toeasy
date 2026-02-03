/**
 * ChartPalette - Drag-and-drop chart type selector
 * Part of Tableau-level dashboard upgrade
 */

import React from 'react';
import {
    BarChart3,
    LineChart,
    PieChart,
    AreaChart,
    ScatterChart,
    TrendingUp,
    Hash,
    Table,
    Gauge,
    Map
} from 'lucide-react';

export interface ChartType {
    id: string;
    name: string;
    icon: React.ReactNode;
    description: string;
    category: 'basic' | 'advanced' | 'kpi';
}

const CHART_TYPES: ChartType[] = [
    // Basic Charts
    { id: 'bar', name: 'Bar Chart', icon: <BarChart3 className="w-5 h-5" />, description: 'Compare categories', category: 'basic' },
    { id: 'line', name: 'Line Chart', icon: <LineChart className="w-5 h-5" />, description: 'Show trends over time', category: 'basic' },
    { id: 'pie', name: 'Pie Chart', icon: <PieChart className="w-5 h-5" />, description: 'Show proportions', category: 'basic' },
    { id: 'area', name: 'Area Chart', icon: <AreaChart className="w-5 h-5" />, description: 'Cumulative totals', category: 'basic' },

    // Advanced Charts
    { id: 'scatter', name: 'Scatter Plot', icon: <ScatterChart className="w-5 h-5" />, description: 'Show correlations', category: 'advanced' },
    { id: 'combo', name: 'Combo Chart', icon: <TrendingUp className="w-5 h-5" />, description: 'Mix bar and line', category: 'advanced' },
    { id: 'table', name: 'Data Table', icon: <Table className="w-5 h-5" />, description: 'Raw data view', category: 'advanced' },
    { id: 'heatmap', name: 'Heatmap', icon: <Map className="w-5 h-5" />, description: 'Intensity matrix', category: 'advanced' },

    // KPIs
    { id: 'kpi', name: 'KPI Card', icon: <Hash className="w-5 h-5" />, description: 'Single metric', category: 'kpi' },
    { id: 'gauge', name: 'Gauge', icon: <Gauge className="w-5 h-5" />, description: 'Progress indicator', category: 'kpi' },
];

interface ChartPaletteProps {
    onChartSelect: (chartType: ChartType) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const ChartPalette: React.FC<ChartPaletteProps> = ({ onChartSelect, isOpen, onClose }) => {
    if (!isOpen) return null;

    const categories = [
        { id: 'basic', label: 'Basic Charts' },
        { id: 'advanced', label: 'Advanced' },
        { id: 'kpi', label: 'KPIs' },
    ];

    return (
        <div className="fixed inset-y-0 right-0 w-72 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                    <h2 className="text-white font-bold text-sm">Add Visualization</h2>
                    <p className="text-slate-500 text-[10px]">Drag or click to add</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Chart Types */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {categories.map(cat => (
                    <div key={cat.id}>
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{cat.label}</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {CHART_TYPES.filter(c => c.category === cat.id).map(chart => (
                                <button
                                    key={chart.id}
                                    onClick={() => onChartSelect(chart)}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('chartType', chart.id);
                                    }}
                                    className="group p-3 bg-slate-800/50 hover:bg-indigo-600/20 border border-slate-700 hover:border-indigo-500/50 rounded-xl transition-all cursor-grab active:cursor-grabbing flex flex-col items-center gap-2"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-slate-700/50 group-hover:bg-indigo-500/20 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                                        {chart.icon}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[11px] font-bold text-white">{chart.name}</p>
                                        <p className="text-[9px] text-slate-500">{chart.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* AI Suggestion */}
            <div className="p-4 border-t border-slate-800">
                <button className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Suggest Charts
                </button>
            </div>
        </div>
    );
};

export default ChartPalette;
