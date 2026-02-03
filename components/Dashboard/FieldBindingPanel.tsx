/**
 * FieldBindingPanel - Power BI/Tableau-style field binding
 * Drag columns to X-axis, Y-axis, Color, Size, etc.
 */

import React, { useState } from 'react';
import {
    MoveHorizontal,
    MoveVertical,
    Palette,
    Scaling,
    Filter,
    SortAsc,
    Layers,
    GripVertical
} from 'lucide-react';

interface FieldBindingPanelProps {
    columns: string[];
    currentBindings: {
        xAxis?: string;
        yAxis?: string;
        color?: string;
        size?: string;
        sort?: string;
        filter?: string;
    };
    onBindingChange: (bindings: Record<string, string | undefined>) => void;
    isOpen: boolean;
    onClose: () => void;
}

interface DropZone {
    id: string;
    label: string;
    icon: React.ReactNode;
    description: string;
    accepts: 'numeric' | 'categorical' | 'any';
}

const DROP_ZONES: DropZone[] = [
    { id: 'xAxis', label: 'X-Axis', icon: <MoveHorizontal className="w-4 h-4" />, description: 'Categories or time', accepts: 'any' },
    { id: 'yAxis', label: 'Y-Axis', icon: <MoveVertical className="w-4 h-4" />, description: 'Values to measure', accepts: 'numeric' },
    { id: 'color', label: 'Color', icon: <Palette className="w-4 h-4" />, description: 'Group by color', accepts: 'categorical' },
    { id: 'size', label: 'Size', icon: <Scaling className="w-4 h-4" />, description: 'Bubble size', accepts: 'numeric' },
    { id: 'sort', label: 'Sort By', icon: <SortAsc className="w-4 h-4" />, description: 'Order data', accepts: 'any' },
    { id: 'filter', label: 'Filter', icon: <Filter className="w-4 h-4" />, description: 'Limit data', accepts: 'any' },
];

export const FieldBindingPanel: React.FC<FieldBindingPanelProps> = ({
    columns,
    currentBindings,
    onBindingChange,
    isOpen,
    onClose
}) => {
    const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleDrop = (zoneId: string) => {
        if (draggedColumn) {
            onBindingChange({ ...currentBindings, [zoneId]: draggedColumn });
            setDraggedColumn(null);
        }
    };

    const handleRemoveBinding = (zoneId: string) => {
        onBindingChange({ ...currentBindings, [zoneId]: undefined });
    };

    const usedColumns = new Set(Object.values(currentBindings).filter(Boolean));

    return (
        <div className="fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                    <h2 className="text-white font-bold text-sm">Field Bindings</h2>
                    <p className="text-slate-500 text-[10px]">Drag columns to axes</p>
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

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Available Columns */}
                <div className="p-4 border-b border-slate-800">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Layers className="w-3 h-3" />
                        Available Fields
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {columns.map(col => (
                            <div
                                key={col}
                                draggable
                                onDragStart={() => setDraggedColumn(col)}
                                onDragEnd={() => setDraggedColumn(null)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-grab active:cursor-grabbing flex items-center gap-1.5 transition-all ${usedColumns.has(col)
                                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                        : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-indigo-500/50'
                                    }`}
                            >
                                <GripVertical className="w-3 h-3 opacity-50" />
                                {col}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Drop Zones */}
                <div className="p-4 space-y-3">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                        Binding Zones
                    </h3>
                    {DROP_ZONES.map(zone => (
                        <div
                            key={zone.id}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(zone.id)}
                            className={`p-3 rounded-xl border-2 border-dashed transition-all ${draggedColumn
                                    ? 'border-indigo-500 bg-indigo-500/10'
                                    : 'border-slate-700 bg-slate-800/50'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400">
                                        {zone.icon}
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-white">{zone.label}</p>
                                        <p className="text-[9px] text-slate-500">{zone.description}</p>
                                    </div>
                                </div>
                            </div>

                            {currentBindings[zone.id as keyof typeof currentBindings] ? (
                                <div className="flex items-center justify-between bg-indigo-600/20 border border-indigo-500/30 rounded-lg px-3 py-2">
                                    <span className="text-[11px] font-bold text-indigo-400">
                                        {currentBindings[zone.id as keyof typeof currentBindings]}
                                    </span>
                                    <button
                                        onClick={() => handleRemoveBinding(zone.id)}
                                        className="text-indigo-400 hover:text-red-400 transition-colors"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <div className="text-[10px] text-slate-500 italic text-center py-2">
                                    {draggedColumn ? 'Drop here' : 'Drag a field here'}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Apply Button */}
            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={onClose}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20"
                >
                    Apply Bindings
                </button>
            </div>
        </div>
    );
};

export default FieldBindingPanel;
