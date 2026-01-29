import React, { useState, useEffect } from 'react';

interface ShortcutItem {
    keys: string[];
    description: string;
}

interface KeyboardShortcutsHelpProps {
    isOpen: boolean;
    onClose: () => void;
    shortcuts?: ShortcutItem[];
}

const defaultShortcuts: ShortcutItem[] = [
    { keys: ['Ctrl', 'S'], description: 'Save changes' },
    { keys: ['Ctrl', 'R'], description: 'Refresh data' },
    { keys: ['Ctrl', 'E'], description: 'Toggle edit mode' },
    { keys: ['Ctrl', 'N'], description: 'New item' },
    { keys: ['Ctrl', 'K'], description: 'Quick search' },
    { keys: ['Escape'], description: 'Close modal / Cancel' },
    { keys: ['?'], description: 'Show keyboard shortcuts' },
    { keys: ['←', '→'], description: 'Navigate items' },
    { keys: ['Enter'], description: 'Confirm / Open' },
];

export function KeyboardShortcutsHelp({
    isOpen,
    onClose,
    shortcuts = defaultShortcuts
}: KeyboardShortcutsHelpProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Keyboard Shortcuts</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Power user mode</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {shortcuts.map((shortcut, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span className="text-sm text-slate-600 dark:text-slate-300">{shortcut.description}</span>
                            <div className="flex items-center gap-1">
                                {shortcut.keys.map((key, keyIndex) => (
                                    <React.Fragment key={keyIndex}>
                                        <kbd className="px-2 py-1 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600 shadow-sm">
                                            {key}
                                        </kbd>
                                        {keyIndex < shortcut.keys.length - 1 && (
                                            <span className="text-slate-400 text-xs">+</span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 text-center uppercase tracking-wider">
                        Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-mono">Esc</kbd> to close
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Hook to show keyboard shortcuts help with Shift+? 
 */
export function useKeyboardShortcutsHelp() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '?' && e.shiftKey) {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
    };
}

export default KeyboardShortcutsHelp;
