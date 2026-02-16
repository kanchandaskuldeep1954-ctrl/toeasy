import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChartWidget } from '../Widgets/ChartWidget';
import { KPIWidget } from '../Widgets/KPIWidget';
import { DataGridWidget } from '../Widgets/DataGridWidget';
import { PivotWidget } from '../Widgets/PivotWidget';
import { ReportBlock, Dataset } from '../../types';
import { Trash2, ArrowUp, ArrowDown, Type, Image as ImageIcon, Plus } from 'lucide-react';

interface ReportBlockRendererProps {
    block: ReportBlock;
    index: number;
    totalBlocks: number;
    dataset: Dataset; // For context if needed
    readOnly?: boolean;
    onUpdate: (id: string, content: any) => void;
    onDelete: (id: string) => void;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
}

export const ReportBlockRenderer: React.FC<ReportBlockRendererProps> = ({
    block,
    index,
    totalBlocks,
    dataset,
    readOnly = false,
    onUpdate,
    onDelete,
    onMoveUp,
    onMoveDown
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(block.content);

    const handleSave = () => {
        onUpdate(block.id, editContent);
        setIsEditing(false);
    };

    const renderControls = () => {
        if (readOnly) return null;
        return (
            <div className="absolute -left-12 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
                    <button
                        onClick={() => onMoveUp(index)}
                        disabled={index === 0}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 disabled:opacity-30"
                        title="Move Up"
                    >
                        <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onMoveDown(index)}
                        disabled={index === totalBlocks - 1}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 disabled:opacity-30"
                        title="Move Down"
                    >
                        <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px bg-slate-200 dark:bg-slate-700 mx-0.5"></div>
                    <button
                        onClick={() => onDelete(block.id)}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500"
                        title="Delete Block"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (block.type) {
            case 'text':
            case 'heading1':
            case 'heading2':
            case 'heading3':
            case 'bullet':
            case 'ordered':
            case 'callout':
                if (isEditing) {
                    return (
                        <div className="relative">
                            <textarea
                                value={typeof editContent === 'string' ? editContent : JSON.stringify(editContent)}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full min-h-[100px] p-4 bg-white dark:bg-slate-800 border-2 border-indigo-500 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-mono text-sm leading-relaxed"
                                autoFocus
                                onBlur={handleSave}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.metaKey) handleSave();
                                    if (e.key === 'Escape') {
                                        setEditContent(block.content);
                                        setIsEditing(false);
                                    }
                                }}
                            />
                            <div className="absolute bottom-2 right-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                ⌘+Enter to save
                            </div>
                        </div>
                    );
                }

                let contentClass = "prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300";
                if (block.type === 'heading1') contentClass += " text-3xl font-black mb-4 mt-8";
                if (block.type === 'heading2') contentClass += " text-2xl font-bold mb-3 mt-6";
                if (block.type === 'heading3') contentClass += " text-xl font-bold mb-2 mt-4";
                if (block.type === 'callout') contentClass = "p-4 bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500 rounded-r-lg text-indigo-900 dark:text-indigo-100 italic";

                return (
                    <div
                        onClick={() => !readOnly && setIsEditing(true)}
                        className={`cursor-text min-h-[1.5em] ${contentClass} hover:bg-slate-50 dark:hover:bg-white/5 rounded px-2 -mx-2 transition-colors`}
                    >
                        {block.type === 'text' || block.type === 'callout' ? (
                            <ReactMarkdown>{String(block.content)}</ReactMarkdown>
                        ) : (
                            <div className={block.type === 'bullet' ? 'list-disc ml-4' : ''}>
                                {String(block.content)}
                            </div>
                        )}
                    </div>
                );

            case 'chart':
                return (
                    <div className="my-6">
                        <ChartWidget
                            chart={block.content}
                            isEditing={!readOnly}
                            onUpdate={(updated) => onUpdate(block.id, updated)}
                        />
                    </div>
                );

            case 'kpi':
                return (
                    <div className="my-6 max-w-sm">
                        <KPIWidget kpi={block.content} />
                    </div>
                );

            case 'table':
                // Assuming content is TableWidgetSpec or we just render full dataset if content is empty/invalid?
                // Or maybe content is the data itself?
                // For now, let's assume content acts as configuration or overrides
                return (
                    <div className="my-6 h-96 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <DataGridWidget
                            data={dataset.data || []}
                            height="100%"
                            title="Embedded Data"
                        />
                    </div>
                );

            case 'pivot':
                return (
                    <div className="my-6 h-96 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 p-4">
                        <PivotWidget
                            data={dataset.data || []}
                            fields={dataset.headers || []}
                            height="100%"
                        />
                    </div>
                );

            case 'divider':
                return <hr className="my-8 border-slate-200 dark:border-slate-800" />;

            default:
                return <div className="p-4 bg-red-50 text-red-500">Unknown block type: {block.type}</div>;
        }
    };

    return (
        <div className="group relative mb-2 pl-2 border-l-2 border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-colors">
            {renderControls()}
            {renderContent()}
        </div>
    );
};
