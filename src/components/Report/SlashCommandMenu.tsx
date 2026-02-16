import React, { useEffect, useState } from 'react';
import { Type, List, ListOrdered, CheckSquare, Image, Divide, Activity, BarChart2 } from 'lucide-react';
import { ReportBlockType } from '../../../types';

interface SlashCommandMenuProps {
    x: number;
    y: number;
    query: string;
    onSelect: (type: ReportBlockType) => void;
    onClose: () => void;
}

interface CommandOption {
    type: ReportBlockType;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const OPTIONS: CommandOption[] = [
    { type: 'text', label: 'Text', description: 'Just start writing with plain text.', icon: <Type className="w-4 h-4" /> },
    { type: 'heading1', label: 'Heading 1', description: 'Big section heading.', icon: <span className="font-bold text-lg">H1</span> },
    { type: 'heading2', label: 'Heading 2', description: 'Medium section heading.', icon: <span className="font-bold text-base">H2</span> },
    { type: 'heading3', label: 'Heading 3', description: 'Small section heading.', icon: <span className="font-bold text-sm">H3</span> },
    { type: 'bullet', label: 'Bullet List', description: 'Create a simple bulleted list.', icon: <List className="w-4 h-4" /> },
    { type: 'ordered', label: 'Numbered List', description: 'Create a list with numbering.', icon: <ListOrdered className="w-4 h-4" /> },
    { type: 'callout', label: 'Callout', description: 'Make writing stand out.', icon: <Activity className="w-4 h-4" /> },
    { type: 'divider', label: 'Divider', description: 'Visually divide blocks.', icon: <Divide className="w-4 h-4" /> },
    { type: 'query', label: 'SQL Query', description: 'Embed a live SQL query.', icon: <span className="font-mono text-xs font-bold">SQL</span> },
    { type: 'kpi', label: 'KPI', description: 'Track a key metric.', icon: <span className="font-bold">123</span> },
    { type: 'chart', label: 'Chart', description: 'Embed a chart.', icon: <BarChart2 className="w-4 h-4" /> },
];

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({ x, y, query, onSelect, onClose }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filteredOptions = OPTIONS.filter(opt =>
        opt.label.toLowerCase().includes(query.toLowerCase()) ||
        opt.description.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredOptions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredOptions[selectedIndex]) {
                    onSelect(filteredOptions[selectedIndex].type);
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [filteredOptions, selectedIndex, onSelect, onClose]);

    if (filteredOptions.length === 0) return null;

    return (
        <div
            className="fixed z-[9999] w-72 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-80"
            style={{ top: y, left: x }}
        >
            <div className="p-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                Basic Blocks
            </div>
            <div className="overflow-y-auto flex-1 p-1">
                {filteredOptions.map((option, index) => (
                    <button
                        key={option.type}
                        className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors text-left ${index === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        onClick={() => onSelect(option.type)}
                        onMouseEnter={() => setSelectedIndex(index)}
                    >
                        <div className="w-10 h-10 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                            {option.icon}
                        </div>
                        <div>
                            <div className="font-bold text-sm">{option.label}</div>
                            <div className="text-xs text-slate-400 line-clamp-1">{option.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
