import React, { useState } from 'react';
import { aiAPI } from '../../services/api';

interface FormulaEditorProps {
    columns: string[];
    onSave: (name: string, formula: string) => void;
    onCancel: () => void;
    datasetId?: string; // For AI generation context
    workspaceId?: string;
}

export const FormulaEditor: React.FC<FormulaEditorProps> = ({ columns = [], onSave, onCancel, datasetId, workspaceId }) => {
    const [name, setName] = useState('');
    const [formula, setFormula] = useState('');
    const [nlPrompt, setNlPrompt] = useState('');
    const [isAiMode, setIsAiMode] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleAiGenerate = async () => {
        if (!nlPrompt.trim() || !datasetId || !workspaceId) return;
        setLoading(true);
        try {
            // Mock AI generation call - in real app would use specific endpoint
            // For now, simulating a response or assuming a generic 'ask' endpoint can return a formula
            const res = await aiAPI.askQuestion(workspaceId, datasetId, `Write a formula for: ${nlPrompt}. Return ONLY the formula string (e.g. colA + colB). Available columns: ${columns.join(', ')}`);
            if (res.data?.answer) {
                setFormula(res.data.answer.replace(/`/g, '').trim()); // Clean up markdown code blocks if any
            } else {
                setFormula('Error generating formula');
            }
        } catch (err) {
            console.error("AI generation failed", err);
            setFormula('AI Error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        if (name && formula) {
            onSave(name, formula);
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-indigo-100 w-96">
            <h3 className="font-bold text-gray-800 mb-4">Add Computed Column</h3>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Column Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Total Revenue"
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-medium text-gray-500 uppercase">Formula</label>
                        <button
                            onClick={() => setIsAiMode(!isAiMode)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                            {isAiMode ? 'Switch to Manual' : '✨ Generate with AI'}
                        </button>
                    </div>

                    {isAiMode ? (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={nlPrompt}
                                onChange={e => setNlPrompt(e.target.value)}
                                placeholder="e.g. Sum of Revenue and Tax"
                                className="flex-1 px-3 py-2 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50"
                            />
                            <button
                                onClick={handleAiGenerate}
                                disabled={loading}
                                className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {loading ? '...' : 'Go'}
                            </button>
                        </div>
                    ) : (
                        <textarea
                            value={formula}
                            onChange={e => setFormula(e.target.value)}
                            placeholder="e.g. quantity * price"
                            className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm h-24 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        />
                    )}

                    <div className="mt-2 text-xs text-gray-400">
                        Available: {(columns || []).slice(0, 5).join(', ')}{(columns || []).length > 5 && '...'}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name || !formula}
                        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save Column
                    </button>
                </div>
            </div>
        </div>
    );
};
