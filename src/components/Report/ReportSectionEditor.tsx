import React, { useEffect, useState } from 'react';
import { ReportSection, ReportBlock, ReportBlockType, Dataset } from '../../types';
import { ReportBlockRenderer } from './ReportBlockRenderer';
import { BlockAddMenu } from './BlockAddMenu';
import { Trash2 } from 'lucide-react';

interface ReportSectionEditorProps {
    section: ReportSection;
    dataset: Dataset;
    onUpdate: (updatedSection: ReportSection) => void;
    onDelete: () => void;
    readOnly?: boolean;
}

export const ReportSectionEditor: React.FC<ReportSectionEditorProps> = ({
    section,
    dataset,
    onUpdate,
    onDelete,
    readOnly = false
}) => {
    const [blocks, setBlocks] = useState<ReportBlock[]>(section.blocks || []);

    // Migration logic: If no blocks but has content/charts/kpis, convert them
    useEffect(() => {
        if (!section.blocks || section.blocks.length === 0) {
            const newBlocks: ReportBlock[] = [];

            // 1. Text Content
            if (section.content) {
                newBlocks.push({
                    id: `block-${Date.now()}-text`,
                    type: 'text',
                    content: section.content
                });
            }

            // 2. Charts
            if (section.charts) {
                section.charts.forEach((chart, idx) => {
                    newBlocks.push({
                        id: `block-${Date.now()}-chart-${idx}`,
                        type: 'chart',
                        content: chart
                    });
                });
            }

            // 3. KPIs
            if (section.kpis) {
                section.kpis.forEach((kpi, idx) => {
                    newBlocks.push({
                        id: `block-${Date.now()}-kpi-${idx}`,
                        type: 'kpi',
                        content: kpi
                    });
                });
            }

            if (newBlocks.length > 0) {
                setBlocks(newBlocks);
                // We don't auto-save here to prevent immediate mutation on load, 
                // but we initialize the local state.
            }
        } else {
            setBlocks(section.blocks);
        }
    }, [section.blocks, section.content, section.charts, section.kpis]);

    const handleUpdateBlocks = (newBlocks: ReportBlock[]) => {
        setBlocks(newBlocks);
        onUpdate({
            ...section,
            blocks: newBlocks,
        });
    };

    const addBlock = (type: ReportBlockType, content: any) => {
        const newBlock: ReportBlock = {
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type,
            content: content || getDefaultContent(type)
        };
        handleUpdateBlocks([...blocks, newBlock]);
    };

    const updateBlock = (id: string, content: any) => {
        const newBlocks = blocks.map(b => b.id === id ? { ...b, content } : b);
        handleUpdateBlocks(newBlocks);
    };

    const deleteBlock = (id: string) => {
        handleUpdateBlocks(blocks.filter(b => b.id !== id));
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === blocks.length - 1) return;

        const newBlocks = [...blocks];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
        handleUpdateBlocks(newBlocks);
    };

    const getDefaultContent = (type: ReportBlockType) => {
        switch (type) {
            case 'text': return 'Start typing...';
            case 'heading1': return 'New Heading 1';
            case 'heading2': return 'New Heading 2';
            case 'heading3': return 'New Heading 3';
            case 'bullet': return 'List item';
            case 'ordered': return 'List item';
            case 'divider': return '';
            case 'chart': return {}; // Ideally trigger a chart picker or creation wizard
            case 'kpi': return { title: 'New KPI', value: 0 };
            default: return '';
        }
    };

    return (
        <section className="mb-12 group/section relative border-l-4 border-transparent hover:border-slate-200 dark:hover:border-slate-800 pl-4 -ml-5 transition-colors duration-300">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-4 group-hover/section:opacity-100 transition-opacity">
                <input
                    value={section.title}
                    onChange={(e) => onUpdate({ ...section, title: e.target.value })}
                    className="text-2xl font-black bg-transparent border-none focus:ring-0 p-0 text-slate-900 dark:text-white placeholder-slate-300 w-full"
                    placeholder="Section Title"
                    readOnly={readOnly}
                />
                {!readOnly && (
                    <button
                        onClick={onDelete}
                        className="opacity-0 group-hover/section:opacity-100 p-2 text-slate-400 hover:text-rose-500 transition-all"
                        title="Delete Section"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Blocks */}
            <div className="space-y-2">
                {blocks.map((block, index) => (
                    <ReportBlockRenderer
                        key={block.id}
                        block={block}
                        index={index}
                        totalBlocks={blocks.length}
                        dataset={dataset}
                        readOnly={readOnly}
                        onUpdate={updateBlock}
                        onDelete={deleteBlock}
                        onMoveUp={(idx) => moveBlock(idx, 'up')}
                        onMoveDown={(idx) => moveBlock(idx, 'down')}
                    />
                ))}

                {blocks.length === 0 && (
                    <div className="text-slate-400 text-sm italic p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                        Empty section. Add a block to start.
                    </div>
                )}
            </div>

            {/* Add Block Menu */}
            {!readOnly && (
                <div className="mt-4 opacity-0 group-hover/section:opacity-100 transition-opacity duration-300">
                    <BlockAddMenu onAdd={addBlock} />
                </div>
            )}
        </section>
    );
};
