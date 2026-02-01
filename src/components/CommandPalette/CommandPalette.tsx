import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    FileText,
    Table2,
    BarChart3,
    CheckSquare,
    MessageCircle,
    Zap,
    FolderOpen,
    Plus,
    Sparkles,
    ArrowRight,
    Clock,
    Hash,
    Command
} from 'lucide-react';

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ElementType;
    category: 'navigation' | 'create' | 'ai' | 'recent' | 'search';
    shortcut?: string;
    action: () => void;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    // Define all commands
    const commands: CommandItem[] = useMemo(() => [
        // Navigation
        { id: 'go-home', label: 'Go to Home', icon: FolderOpen, category: 'navigation', action: () => navigate('/app') },
        { id: 'go-docs', label: 'Go to Docs', icon: FileText, category: 'navigation', action: () => navigate('/app/docs') },
        { id: 'go-sheets', label: 'Go to Sheets', icon: Table2, category: 'navigation', action: () => navigate('/app/sheets') },
        { id: 'go-boards', label: 'Go to Dashboards', icon: BarChart3, category: 'navigation', action: () => navigate('/app/boards') },
        { id: 'go-tasks', label: 'Go to Tasks', icon: CheckSquare, category: 'navigation', action: () => navigate('/app/tasks') },
        { id: 'go-chat', label: 'Go to Chat', icon: MessageCircle, category: 'navigation', action: () => navigate('/app/chat') },
        { id: 'go-flows', label: 'Go to Flows', icon: Zap, category: 'navigation', action: () => navigate('/app/flows') },

        // Create
        { id: 'new-doc', label: 'New Document', description: 'Create a blank document', icon: FileText, category: 'create', action: () => navigate('/app/docs/new') },
        { id: 'new-sheet', label: 'New Sheet', description: 'Create a blank spreadsheet', icon: Table2, category: 'create', action: () => navigate('/app/sheets/new') },
        { id: 'new-board', label: 'New Dashboard', description: 'Create a new dashboard', icon: BarChart3, category: 'create', action: () => navigate('/app/boards/new') },
        { id: 'new-task', label: 'New Task', description: 'Create a new task', icon: CheckSquare, category: 'create', shortcut: 'T', action: () => navigate('/app/tasks/new') },
        { id: 'new-flow', label: 'New Automation', description: 'Create a new workflow', icon: Zap, category: 'create', action: () => navigate('/app/flows/new') },

        // AI
        { id: 'ai-ask', label: 'Ask AI anything...', description: 'Get help with AI', icon: Sparkles, category: 'ai', action: () => { } },
        { id: 'ai-analyze', label: 'AI: Analyze my data', icon: Sparkles, category: 'ai', action: () => { } },
        { id: 'ai-summarize', label: 'AI: Summarize this', icon: Sparkles, category: 'ai', action: () => { } },
        { id: 'ai-write', label: 'AI: Help me write', icon: Sparkles, category: 'ai', action: () => { } },

        // Recent (would be dynamic in real app)
        { id: 'recent-1', label: 'Sales Data Q1', description: 'Sheet • Edited 2 hours ago', icon: Table2, category: 'recent', action: () => navigate('/app/sheets/1') },
        { id: 'recent-2', label: 'Revenue Dashboard', description: 'Board • Edited yesterday', icon: BarChart3, category: 'recent', action: () => navigate('/app/boards/1') },
        { id: 'recent-3', label: 'Project Plan', description: 'Doc • Edited 3 days ago', icon: FileText, category: 'recent', action: () => navigate('/app/docs/1') },
    ], [navigate]);

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!query) {
            // Show recent first, then grouped by category
            return commands;
        }

        const lowerQuery = query.toLowerCase();
        return commands.filter(cmd =>
            cmd.label.toLowerCase().includes(lowerQuery) ||
            cmd.description?.toLowerCase().includes(lowerQuery)
        );
    }, [commands, query]);

    // Group commands by category
    const groupedCommands = useMemo(() => {
        const groups: Record<string, CommandItem[]> = {};
        filteredCommands.forEach(cmd => {
            if (!groups[cmd.category]) {
                groups[cmd.category] = [];
            }
            groups[cmd.category].push(cmd);
        });
        return groups;
    }, [filteredCommands]);

    const categoryLabels: Record<string, string> = {
        recent: 'Recent',
        navigation: 'Go to',
        create: 'Create',
        ai: 'AI Actions',
        search: 'Search Results'
    };

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].action();
                    onClose();
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    // Setup keyboard listener
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Global ⌘K listener
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (isOpen) {
                    onClose();
                } else {
                    // This would be handled by parent, but included for reference
                }
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isOpen, onClose]);

    if (typeof window === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[700] flex items-start justify-center pt-[15vh]">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Command Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.15, type: 'spring', bounce: 0.2 }}
                        className="relative w-full max-w-2xl mx-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Search Input */}
                        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
                            <Search className="w-5 h-5 text-slate-500" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setSelectedIndex(0);
                                }}
                                placeholder="Type a command or search..."
                                className="flex-1 bg-transparent text-white text-lg placeholder-slate-500 outline-none"
                            />
                            <kbd className="px-2 py-1 text-xs bg-slate-800 text-slate-400 rounded-lg border border-slate-700">
                                ESC
                            </kbd>
                        </div>

                        {/* Results */}
                        <div className="max-h-[400px] overflow-y-auto py-2 custom-scrollbar">
                            {Object.entries(groupedCommands).map(([category, items]) => (
                                <div key={category}>
                                    <div className="px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        {categoryLabels[category]}
                                    </div>
                                    {items.map((item, index) => {
                                        const globalIndex = filteredCommands.indexOf(item);
                                        const isSelected = globalIndex === selectedIndex;

                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    item.action();
                                                    onClose();
                                                }}
                                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                className={`
                                                    w-full flex items-center gap-3 px-4 py-3
                                                    transition-colors text-left
                                                    ${isSelected
                                                        ? 'bg-indigo-600/20 text-white'
                                                        : 'text-slate-300 hover:bg-slate-800/50'
                                                    }
                                                `}
                                            >
                                                <div className={`
                                                    w-10 h-10 rounded-xl flex items-center justify-center
                                                    ${isSelected ? 'bg-indigo-600/30' : 'bg-slate-800'}
                                                `}>
                                                    <item.icon className={`w-5 h-5 ${item.category === 'ai' ? 'text-amber-400' : ''
                                                        }`} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">{item.label}</div>
                                                    {item.description && (
                                                        <div className="text-sm text-slate-500 truncate">
                                                            {item.description}
                                                        </div>
                                                    )}
                                                </div>

                                                {item.shortcut && (
                                                    <kbd className="px-2 py-1 text-xs bg-slate-800 text-slate-400 rounded border border-slate-700">
                                                        {item.shortcut}
                                                    </kbd>
                                                )}

                                                {isSelected && (
                                                    <ArrowRight className="w-4 h-4 text-indigo-400" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}

                            {filteredCommands.length === 0 && (
                                <div className="px-4 py-8 text-center text-slate-500">
                                    No results found for "{query}"
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/50 text-xs text-slate-500">
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑</kbd>
                                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↓</kbd>
                                    to navigate
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↵</kbd>
                                    to select
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Command className="w-3 h-3" />
                                <span>K to toggle</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default CommandPalette;
