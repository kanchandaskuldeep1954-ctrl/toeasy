import React, { useState } from 'react';
import { Sparkles, X, ArrowRight, Table2 } from 'lucide-react';
import { GroqService } from '../../services/groqService';

interface MagicColumnModalProps {
    isOpen: boolean;
    onClose: () => void;
    columns: string[];
    onGenerate: (newColumnName: string, instruction: string, contextColumns: string[]) => Promise<void>;
}

export const MagicColumnModal: React.FC<MagicColumnModalProps> = ({ isOpen, onClose, columns, onGenerate }) => {
    const [step, setStep] = useState<'config' | 'preview' | 'generating'>('config');
    const [instruction, setInstruction] = useState('');
    const [newColumnName, setNewColumnName] = useState('');
    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);

    if (!isOpen) return null;

    const handleStart = async () => {
        if (!instruction || !newColumnName) return;

        setIsGenerating(true);
        setStep('generating');

        // Simulate progress for UX until real streaming is hooked up in parent
        let p = 0;
        const interval = setInterval(() => {
            p += 5;
            if (p > 90) clearInterval(interval);
            setProgress(p);
        }, 500);

        await onGenerate(newColumnName, instruction, selectedColumns);

        clearInterval(interval);
        setProgress(100);
        setTimeout(() => {
            onClose();
            // Reset state
            setStep('config');
            setInstruction('');
            setNewColumnName('');
            setIsGenerating(false);
            setProgress(0);
        }, 1000);
    };

    const toggleColumn = (col: string) => {
        if (selectedColumns.includes(col)) {
            setSelectedColumns(selectedColumns.filter(c => c !== col));
        } else {
            setSelectedColumns([...selectedColumns, col]);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[600px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Magic Column</h2>
                            <p className="text-xs text-slate-500 font-medium">Generate new data using AI</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    {step === 'generating' ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="relative w-20 h-20 mb-6">
                                <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
                                <div
                                    className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"
                                ></div>
                                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-indigo-600 animate-pulse" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Generating Magic Column...</h3>
                            <p className="text-slate-500 max-w-xs mx-auto">AI is processing your rows. This might take a moment depending on dataset size.</p>

                            <div className="w-64 h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-8 overflow-hidden">
                                <div
                                    className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* 1. Name & Instruction */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">New Column Name</label>
                                    <input
                                        type="text"
                                        value={newColumnName}
                                        onChange={e => setNewColumnName(e.target.value)}
                                        placeholder="e.g. Sentiment Analysis, Extracted Email, Summary"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:font-normal"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">AI Instruction</label>
                                    <textarea
                                        value={instruction}
                                        onChange={e => setInstruction(e.target.value)}
                                        placeholder="What should the AI do? e.g. 'Analyze the sentiment of the review in Column B and output Positive, Negative, or Neutral'"
                                        className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none placeholder:font-normal"
                                    />
                                </div>
                            </div>

                            {/* 2. Context Context */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Source Columns (Context)
                                </label>
                                <p className="text-xs text-slate-400 mb-3">Select which columns the AI needs to read to generate the result.</p>

                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                                    {columns.map(col => (
                                        <button
                                            key={col}
                                            onClick={() => toggleColumn(col)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left truncate ${selectedColumns.includes(col)
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                                                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-200'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded flex items-center justify-center border ${selectedColumns.includes(col)
                                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                                    : 'bg-white border-slate-300'
                                                }`}>
                                                {selectedColumns.includes(col) && <Sparkles className="w-2.5 h-2.5" />}
                                            </div>
                                            {col}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {step !== 'generating' && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleStart}
                            disabled={!newColumnName || !instruction}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-500 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-lg shadow-indigo-500/20"
                        >
                            <Sparkles className="w-4 h-4" />
                            Generate Magic Column
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
