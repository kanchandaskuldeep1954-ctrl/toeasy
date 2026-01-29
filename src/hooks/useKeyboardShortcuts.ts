import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    action: () => void;
    description: string;
}

/**
 * Global keyboard shortcuts hook for power users.
 * Usage: useKeyboardShortcuts([{ key: 's', ctrl: true, action: handleSave, description: 'Save' }])
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Don't trigger shortcuts when typing in inputs
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            // Allow Escape to work in inputs
            if (event.key !== 'Escape') return;
        }

        for (const shortcut of shortcuts) {
            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
            const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
            const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
            const altMatch = shortcut.alt ? event.altKey : !event.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                event.preventDefault();
                shortcut.action();
                return;
            }
        }
    }, [shortcuts]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}

/**
 * Common shortcuts for dashboard/report views
 */
export const commonShortcuts = {
    save: (action: () => void) => ({ key: 's', ctrl: true, action, description: 'Save' }),
    refresh: (action: () => void) => ({ key: 'r', ctrl: true, action, description: 'Refresh' }),
    escape: (action: () => void) => ({ key: 'Escape', action, description: 'Close/Cancel' }),
    edit: (action: () => void) => ({ key: 'e', ctrl: true, action, description: 'Edit Mode' }),
    newItem: (action: () => void) => ({ key: 'n', ctrl: true, action, description: 'New Item' }),
    search: (action: () => void) => ({ key: 'k', ctrl: true, action, description: 'Search' }),
    help: (action: () => void) => ({ key: '?', shift: true, action, description: 'Show Shortcuts' }),
};

export default useKeyboardShortcuts;
