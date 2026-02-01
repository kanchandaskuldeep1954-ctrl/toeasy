import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
    Plus,
    GripVertical,
    Type,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    CheckSquare,
    Quote,
    Code,
    Image,
    Table,
    Minus,
    MoreHorizontal,
    Trash2,
    Copy,
    ArrowUp,
    ArrowDown
} from 'lucide-react';

// Block Types
export type BlockType =
    | 'paragraph'
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'bulletList'
    | 'numberedList'
    | 'todo'
    | 'quote'
    | 'code'
    | 'divider'
    | 'image'
    | 'table'
    | 'embed';

export interface Block {
    id: string;
    type: BlockType;
    content: string;
    checked?: boolean; // For todo blocks
    language?: string; // For code blocks
    url?: string; // For image/embed blocks
    children?: Block[]; // For nested lists
}

interface BlockEditorProps {
    blocks: Block[];
    onChange: (blocks: Block[]) => void;
    placeholder?: string;
    readOnly?: boolean;
}

const BLOCK_TYPES: { type: BlockType; icon: React.ElementType; label: string; shortcut?: string }[] = [
    { type: 'paragraph', icon: Type, label: 'Text', shortcut: 'text' },
    { type: 'heading1', icon: Heading1, label: 'Heading 1', shortcut: 'h1' },
    { type: 'heading2', icon: Heading2, label: 'Heading 2', shortcut: 'h2' },
    { type: 'heading3', icon: Heading3, label: 'Heading 3', shortcut: 'h3' },
    { type: 'bulletList', icon: List, label: 'Bullet List', shortcut: 'bullet' },
    { type: 'numberedList', icon: ListOrdered, label: 'Numbered List', shortcut: 'number' },
    { type: 'todo', icon: CheckSquare, label: 'To-do', shortcut: 'todo' },
    { type: 'quote', icon: Quote, label: 'Quote', shortcut: 'quote' },
    { type: 'code', icon: Code, label: 'Code', shortcut: 'code' },
    { type: 'divider', icon: Minus, label: 'Divider', shortcut: 'divider' },
    { type: 'image', icon: Image, label: 'Image', shortcut: 'image' },
    { type: 'table', icon: Table, label: 'Table', shortcut: 'table' }
];

// Slash Command Menu
const SlashMenu: React.FC<{
    isOpen: boolean;
    position: { x: number; y: number };
    onSelect: (type: BlockType) => void;
    onClose: () => void;
    filter: string;
}> = ({ isOpen, position, onSelect, onClose, filter }) => {
    const filteredTypes = BLOCK_TYPES.filter(
        t => t.label.toLowerCase().includes(filter.toLowerCase()) ||
            t.shortcut?.includes(filter.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed z-50 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden"
            style={{ left: position.x, top: position.y }}
        >
            <div className="p-2 border-b border-slate-700">
                <span className="text-xs text-slate-500 uppercase">Basic Blocks</span>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
                {filteredTypes.map((blockType) => (
                    <button
                        key={blockType.type}
                        onClick={() => onSelect(blockType.type)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                            <blockType.icon className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-sm font-medium">{blockType.label}</div>
                            <div className="text-xs text-slate-500">/{blockType.shortcut}</div>
                        </div>
                    </button>
                ))}
                {filteredTypes.length === 0 && (
                    <div className="px-3 py-4 text-center text-slate-500 text-sm">
                        No blocks found
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// Single Block Component
const BlockItem: React.FC<{
    block: Block;
    index: number;
    focused: boolean;
    onFocus: () => void;
    onChange: (content: string) => void;
    onTypeChange: (type: BlockType) => void;
    onDelete: () => void;
    onAddBelow: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
    onToggleCheck?: () => void;
}> = ({
    block,
    index,
    focused,
    onFocus,
    onChange,
    onTypeChange,
    onDelete,
    onAddBelow,
    onMoveUp,
    onMoveDown,
    onKeyDown,
    onToggleCheck
}) => {
        const inputRef = useRef<HTMLTextAreaElement>(null);
        const [showSlashMenu, setShowSlashMenu] = useState(false);
        const [slashFilter, setSlashFilter] = useState('');
        const [slashPosition, setSlashPosition] = useState({ x: 0, y: 0 });
        const [showActions, setShowActions] = useState(false);

        const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const value = e.target.value;

            // Detect slash command
            if (value.startsWith('/') && block.content === '') {
                const rect = inputRef.current?.getBoundingClientRect();
                if (rect) {
                    setSlashPosition({ x: rect.left, y: rect.bottom + 4 });
                    setShowSlashMenu(true);
                    setSlashFilter(value.slice(1));
                }
            } else {
                setShowSlashMenu(false);
            }

            onChange(value);
        };

        const handleSlashSelect = (type: BlockType) => {
            onTypeChange(type);
            onChange('');
            setShowSlashMenu(false);
        };

        const getBlockStyles = () => {
            switch (block.type) {
                case 'heading1':
                    return 'text-3xl font-bold text-white';
                case 'heading2':
                    return 'text-2xl font-semibold text-white';
                case 'heading3':
                    return 'text-xl font-medium text-white';
                case 'quote':
                    return 'text-lg italic text-slate-400 border-l-4 border-indigo-500 pl-4';
                case 'code':
                    return 'font-mono text-sm bg-slate-800 p-4 rounded-lg text-emerald-400';
                default:
                    return 'text-slate-300';
            }
        };

        const renderBlockContent = () => {
            if (block.type === 'divider') {
                return <hr className="border-slate-700 my-4" />;
            }

            if (block.type === 'todo') {
                return (
                    <div className="flex items-start gap-3">
                        <button
                            onClick={onToggleCheck}
                            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${block.checked
                                    ? 'bg-indigo-600 border-indigo-600'
                                    : 'border-slate-600 hover:border-indigo-500'
                                }`}
                        >
                            {block.checked && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                        <textarea
                            ref={inputRef}
                            value={block.content}
                            onChange={handleInput}
                            onFocus={onFocus}
                            onKeyDown={onKeyDown}
                            placeholder="To-do item..."
                            className={`flex-1 bg-transparent resize-none outline-none ${block.checked ? 'line-through text-slate-500' : 'text-slate-300'
                                }`}
                            rows={1}
                        />
                    </div>
                );
            }

            if (block.type === 'bulletList' || block.type === 'numberedList') {
                const marker = block.type === 'bulletList' ? '•' : `${index + 1}.`;
                return (
                    <div className="flex items-start gap-3">
                        <span className="text-slate-500 select-none w-6">{marker}</span>
                        <textarea
                            ref={inputRef}
                            value={block.content}
                            onChange={handleInput}
                            onFocus={onFocus}
                            onKeyDown={onKeyDown}
                            placeholder="List item..."
                            className="flex-1 bg-transparent resize-none outline-none text-slate-300"
                            rows={1}
                        />
                    </div>
                );
            }

            return (
                <textarea
                    ref={inputRef}
                    value={block.content}
                    onChange={handleInput}
                    onFocus={onFocus}
                    onKeyDown={onKeyDown}
                    placeholder={block.type === 'paragraph' ? "Type '/' for commands..." : 'Type here...'}
                    className={`w-full bg-transparent resize-none outline-none ${getBlockStyles()}`}
                    rows={1}
                />
            );
        };

        return (
            <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative"
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                {/* Block Controls (left side) */}
                <div className={`absolute -left-10 top-1 flex items-center gap-1 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        onClick={onAddBelow}
                        className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white cursor-grab">
                        <GripVertical className="w-4 h-4" />
                    </button>
                </div>

                {/* Block Content */}
                <div className={`py-1 px-2 rounded-lg transition-colors ${focused ? 'bg-slate-800/30' : ''}`}>
                    {renderBlockContent()}
                </div>

                {/* Actions Menu (right side) */}
                {showActions && (
                    <div className="absolute -right-8 top-1 flex items-center gap-1">
                        <button
                            onClick={onDelete}
                            className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Slash Command Menu */}
                <AnimatePresence>
                    <SlashMenu
                        isOpen={showSlashMenu}
                        position={slashPosition}
                        filter={slashFilter}
                        onSelect={handleSlashSelect}
                        onClose={() => setShowSlashMenu(false)}
                    />
                </AnimatePresence>
            </motion.div>
        );
    };

// Main Block Editor
export const BlockEditor: React.FC<BlockEditorProps> = ({
    blocks,
    onChange,
    placeholder = "Start typing or press '/' for commands...",
    readOnly = false
}) => {
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    const generateId = () => `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const createBlock = (type: BlockType = 'paragraph'): Block => ({
        id: generateId(),
        type,
        content: ''
    });

    const updateBlock = (index: number, updates: Partial<Block>) => {
        const newBlocks = [...blocks];
        newBlocks[index] = { ...newBlocks[index], ...updates };
        onChange(newBlocks);
    };

    const deleteBlock = (index: number) => {
        if (blocks.length <= 1) return;
        const newBlocks = blocks.filter((_, i) => i !== index);
        onChange(newBlocks);
        setFocusedIndex(Math.max(0, index - 1));
    };

    const addBlockBelow = (index: number) => {
        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, createBlock());
        onChange(newBlocks);
        setFocusedIndex(index + 1);
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= blocks.length) return;

        const newBlocks = [...blocks];
        [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
        onChange(newBlocks);
        setFocusedIndex(newIndex);
    };

    const handleKeyDown = (index: number, e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addBlockBelow(index);
        }
        if (e.key === 'Backspace' && blocks[index].content === '') {
            e.preventDefault();
            deleteBlock(index);
        }
        if (e.key === 'ArrowUp' && e.metaKey) {
            e.preventDefault();
            moveBlock(index, 'up');
        }
        if (e.key === 'ArrowDown' && e.metaKey) {
            e.preventDefault();
            moveBlock(index, 'down');
        }
    };

    return (
        <div className="block-editor pl-10 py-4 space-y-1">
            <AnimatePresence>
                {blocks.map((block, index) => (
                    <BlockItem
                        key={block.id}
                        block={block}
                        index={index}
                        focused={focusedIndex === index}
                        onFocus={() => setFocusedIndex(index)}
                        onChange={(content) => updateBlock(index, { content })}
                        onTypeChange={(type) => updateBlock(index, { type })}
                        onDelete={() => deleteBlock(index)}
                        onAddBelow={() => addBlockBelow(index)}
                        onMoveUp={() => moveBlock(index, 'up')}
                        onMoveDown={() => moveBlock(index, 'down')}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onToggleCheck={() => updateBlock(index, { checked: !block.checked })}
                    />
                ))}
            </AnimatePresence>

            {blocks.length === 0 && (
                <button
                    onClick={() => onChange([createBlock()])}
                    className="w-full text-left p-4 text-slate-500 hover:text-slate-400"
                >
                    {placeholder}
                </button>
            )}
        </div>
    );
};

export default BlockEditor;
