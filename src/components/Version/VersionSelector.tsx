/**
 * VersionSelector Component
 * Phase 1.1: Dropdown selector for dataset versions
 * 
 * Features:
 * - Compact dropdown for quick version switching
 * - Shows current version with visual indicator
 * - Quick access to commit new version
 * - Dirty state warning
 */

import React, { useState, useEffect, useRef } from 'react';
import { GitBranch, ChevronDown, Check, Clock, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Version, VersionSelectorProps } from './types';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';

export const VersionSelector: React.FC<VersionSelectorProps> = ({
    datasetId,
    workspaceId,
    currentVersionId,
    onVersionSelect,
    onCommit,
    compact = false,
    showCommitButton = true,
    className = '',
}) => {
    const { token } = useAuth();
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:3000/api';

    useEffect(() => {
        loadVersions();
    }, [datasetId, workspaceId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadVersions = async () => {
        if (!datasetId || !workspaceId) return;

        try {
            setLoading(true);
            const response = await axios.get(
                `${backendUrl}/workspaces/${workspaceId}/datasets/${datasetId}/versions`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setVersions(response.data);
        } catch (err) {
            console.error('Failed to load versions:', err);
        } finally {
            setLoading(false);
        }
    };

    const currentVersion = versions.find(v => v.id === currentVersionId) || versions[0];

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const handleSelect = (version: Version) => {
        onVersionSelect(version);
        setIsOpen(false);
    };

    if (loading) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg ${className}`}>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                <span className="text-sm text-slate-500">Loading...</span>
            </div>
        );
    }

    if (compact) {
        return (
            <div ref={dropdownRef} className={`relative inline-block ${className}`}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm"
                >
                    <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                        {currentVersion?.version_name || 'Select version'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute z-50 mt-1 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                            {versions.map((version) => (
                                <button
                                    key={version.id}
                                    onClick={() => handleSelect(version)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${version.id === currentVersion?.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${version.id === currentVersion?.id
                                            ? 'bg-indigo-500 text-white'
                                            : 'bg-slate-200 dark:bg-slate-700'
                                        }`}>
                                        {version.id === currentVersion?.id && <Check className="w-3 h-3" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                                            {version.version_name}
                                        </div>
                                        <div className="text-xs text-slate-500">{formatDate(version.created_at)}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {showCommitButton && onCommit && (
                            <div className="border-t border-slate-200 dark:border-slate-700 p-2">
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        onCommit();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Commit New Version
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Full-width selector
    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl transition-all"
            >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <GitBranch className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 text-left">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Current Version</div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                        {currentVersion?.version_name || 'No version selected'}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                        {versions.length} versions
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Version History
                        </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {versions.map((version, index) => (
                            <button
                                key={version.id}
                                onClick={() => handleSelect(version)}
                                className={`w-full flex items-center gap-4 px-4 py-4 text-left border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${version.id === currentVersion?.id ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''
                                    }`}
                            >
                                {/* Node indicator */}
                                <div className="relative">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${version.id === currentVersion?.id
                                            ? 'bg-indigo-500 text-white'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                        }`}>
                                        {version.id === currentVersion?.id ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <span className="text-xs font-bold">v{versions.length - index}</span>
                                        )}
                                    </div>
                                    {index < versions.length - 1 && (
                                        <div className="absolute top-8 left-1/2 w-0.5 h-4 bg-slate-200 dark:bg-slate-700 -translate-x-1/2" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`font-semibold ${version.id === currentVersion?.id
                                                ? 'text-indigo-700 dark:text-indigo-300'
                                                : 'text-slate-900 dark:text-white'
                                            }`}>
                                            {version.version_name}
                                        </span>
                                        {version.isVirtual && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500">
                                                Original
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatDate(version.created_at)}
                                        </span>
                                        <span className="capitalize">{version.created_by_tool}</span>
                                        {version.row_count > 0 && (
                                            <span>{version.row_count.toLocaleString()} rows</span>
                                        )}
                                    </div>
                                    {version.description && (
                                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                            {version.description}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    {showCommitButton && onCommit && (
                        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onCommit();
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                            >
                                <Plus className="w-4 h-4" />
                                Commit New Version
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VersionSelector;
