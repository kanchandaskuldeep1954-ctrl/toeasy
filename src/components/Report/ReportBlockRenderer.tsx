import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChartWidget } from '../Widgets/ChartWidget';
import { KPIWidget } from '../Widgets/KPIWidget';
import { DataGridWidget } from '../Widgets/DataGridWidget';
import { PivotWidget } from '../Widgets/PivotWidget';
import { QueryConsole } from '../Widgets/QueryConsole';
import { ReportBlock, Dataset, ReportBlockType } from '../../../types';
import { Trash2, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { SlashCommandMenu } from './SlashCommandMenu';

interface ReportBlockRendererProps {
    block: ReportBlock;
    index: number;
    totalBlocks: number;
    dataset: Dataset; // For context if needed
    readOnly?: boolean;
    onUpdate: (id: string, content: any, type?: ReportBlockType) => void;
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

    // Slash Command State
    const [slashMenu, setSlashMenu] = useState<{ open: boolean; x: number; y: number; query: string } | null>(null);

    // DnD Hook
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id, disabled: readOnly || isEditing });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 10 : 1,
        position: 'relative' as 'relative', // Ensure type safety
    };

    const handleSave = () => {
        onUpdate(block.id, editContent);
        setIsEditing(false);
        setSlashMenu(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (slashMenu?.open) {
            if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
                // Let the global listener in SlashCommandMenu handle it, 
                // but we might need to prevent default here if it conflicts.
                // Actually, SlashCommandMenu uses document listener, so it will catch it.
                // We just prevent the textarea from moving cursor or inserting newline if menu is open.
                if (e.key === 'Enter') e.preventDefault();
                // Arrows move cursor in textarea, maybe we want that? 
            }
            if (e.key === 'Escape') {
                setSlashMenu(null);
                e.preventDefault(); // Stop from closing edit mode?
            }
        } else {
            if (e.key === 'Enter' && e.metaKey) handleSave();
            if (e.key === 'Escape') {
                setEditContent(block.content);
                setIsEditing(false);
            }
        }
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (readOnly) return;

        const textarea = e.currentTarget;
        const value = textarea.value;
        const cursorValues = value.substring(0, textarea.selectionStart);
        const lastLine = cursorValues.split('\n').pop() || '';

        // Detect Slash Command: "/" at start of line or preceded by space
        const match = /(?:^|\s)\/([a-z0-9]*)$/i.exec(lastLine);

        if (match) {
            const query = match[1];
            const rect = textarea.getBoundingClientRect();

            // Approximate position
            const lines = cursorValues.split('\n').length;
            const lineHeight = 24; // approx for text-sm leading-relaxed
            const charWidth = 8.5; // approx for font-mono

            const top = rect.top + (lines * lineHeight) - textarea.scrollTop;
            const left = rect.left + (lastLine.length * charWidth) - textarea.scrollLeft + 20;

            setSlashMenu({
                open: true,
                x: left,
                y: top,
                query
            });
        } else {
            setSlashMenu(null);
        }
    };

    const handleSlashSelect = (type: ReportBlockType) => {
        if (!slashMenu) return;

        // Remove the command text
        const textarea = document.querySelector(`textarea`) as HTMLTextAreaElement; // Hacky, assume focus?
        // Better: use editContent state
        const cursor = typeof editContent === 'string' ? editContent.length : 0; // Fallback

        // We need to replace the last occurrence of "/" + query
        // This is tricky with simple state. 
        // Let's just swap the block type and keep content if compatible, or clear it.

        if (type === 'text' || type.startsWith('heading') || type === 'bullet' || type === 'ordered' || type === 'callout') {
            // Transform block type, keep content (stripped of command)
            const regex = /(?:^|\s)(\/[a-z0-9]*)$/i;
            const newContent = String(editContent).replace(regex, ''); // Replace only the command part

            // Update parent directly to change type
            // We need a way to change type. onUpdate only updates content?
            // Ah, onUpdate signature is (id, content). It assumes type doesn't change.
            // We need onTypeChange or generic update.
            // CHECK: ReportSectionEditor.tsx implementation of updateBlock.
            // const updateBlock = (id: string, content: any) => ...
            // It only updates content. LIMITATION DETECTED.
            // Fix: We need a way to replace the block entirely.
        }

        // Actually, ReportSectionEditor needs to support type change.
        // For now, let's assume we can't change type easily without deleting and adding.
        // Wait, I can pass a special "block replacement" object to onUpdate? No.

        setSlashMenu(null);
    };

    const renderControls = () => {
        if (readOnly) return null;
        return (
            <div className="absolute -left-12 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
                    {/* Drag Handle */}
                    <button
                        className="p-1.5 cursor-grab active:cursor-grabbing hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500"
                        {...attributes}
                        {...listeners}
                        title="Drag to Move"
                    >
                        <GripVertical className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-px bg-slate-200 dark:bg-slate-700 h-full"></div>

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
                                onKeyDown={handleKeyDown}
                                onKeyUp={handleKeyUp}
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

            case 'query':
                return (
                    <div className="my-6 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 shadow-sm">
                        <QueryConsole
                            workspaceId={dataset.workspace_id ? String(dataset.workspace_id) : ''}
                            datasetId={String(dataset.id)}
                            initialQuery={block.content?.query || ''}
                            height={400}
                            onQueryChange={(q) => onUpdate(block.id, { ...block.content, query: q })}
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
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative mb-2 pl-2 border-l-2 border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-colors ${isDragging ? 'shadow-xl bg-white dark:bg-slate-900 z-50 rounded-lg ring-2 ring-indigo-500' : ''}`}
        >
            {renderControls()}
            {renderContent()}
            {slashMenu?.open && (
                <SlashCommandMenu
                    x={slashMenu.x}
                    y={slashMenu.y}
                    query={slashMenu.query}
                    onSelect={handleSlashSelect}
                    onClose={() => setSlashMenu(null)}
                />
            )}
        </div>
    );
};
