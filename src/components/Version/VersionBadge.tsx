/**
 * VersionBadge Component
 * Phase 1.1: Small indicator showing current version and dirty state
 * 
 * Features:
 * - Compact display of current version
 * - Visual dirty indicator
 * - Click to open version panel
 */

import React from 'react';
import { GitBranch, AlertCircle } from 'lucide-react';
import { VersionBadgeProps } from './types';

export const VersionBadge: React.FC<VersionBadgeProps> = ({
    version,
    isDirty,
    onClick,
    className = '',
}) => {
    return (
        <button
            onClick={onClick}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${isDirty
                    ? 'bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                } ${className}`}
            title={isDirty ? 'Unsaved changes' : 'Click to view version history'}
        >
            <GitBranch className={`w-3.5 h-3.5 ${isDirty ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-500'
                }`} />

            <span className={`text-xs font-medium max-w-[100px] truncate ${isDirty ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'
                }`}>
                {version?.version_name || 'No version'}
            </span>

            {isDirty && (
                <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Modified
                    </span>
                </div>
            )}
        </button>
    );
};

export default VersionBadge;
