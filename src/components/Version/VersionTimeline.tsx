/**
 * VersionTimeline Component
 * Phase 1.1: Visual git-like timeline of dataset versions
 * 
 * Features:
 * - Vertical timeline with branch visualization
 * - Version cards with metadata
 * - Click to select/preview
 * - Restore and compare actions
 */

import React, { useState, useEffect } from 'react';
import { GitBranch, Clock, FileText, Undo2, GitCompare, Check, User, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { Version, VersionTimelineProps } from './types';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';

const TOOL_ICONS: Record<string, React.ReactNode> = {
    upload: <FileText className="w-3.5 h-3.5" />,
    cleaning: <Wrench className="w-3.5 h-3.5" />,
    playground: <GitBranch className="w-3.5 h-3.5" />,
    dataflow: <GitBranch className="w-3.5 h-3.5" />,
    manual: <User className="w-3.5 h-3.5" />,
    api: <GitBranch className="w-3.5 h-3.5" />,
};

const TOOL_COLORS: Record<string, string> = {
    upload: 'bg-blue-500',
    cleaning: 'bg-emerald-500',
    playground: 'bg-purple-500',
    dataflow: 'bg-orange-500',
    manual: 'bg-slate-500',
    api: 'bg-indigo-500',
};

export const VersionTimeline: React.FC<VersionTimelineProps> = ({
    datasetId,
    workspaceId,
    currentVersionId,
    onVersionSelect,
    onRestore,
    onCompare,
}) => {
    const { versions, isLoading: loading, error } = useVersion();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [compareSelection, setCompareSelection] = useState<Version[]>([]);

    const handleVersionClick = (version: Version) => {
        if (compareMode) {
            handleCompareSelect(version);
        } else {
            onVersionSelect(version);
        }
    };

    const handleCompareSelect = (version: Version) => {
        setCompareSelection(prev => {
            if (prev.find(v => v.id === version.id)) {
                return prev.filter(v => v.id !== version.id);
            }
            if (prev.length >= 2) {
                return [prev[1], version];
            }
            return [...prev, version];
        });
    };

    const handleCompare = () => {
        if (compareSelection.length === 2 && onCompare) {
            onCompare(compareSelection[0], compareSelection[1]);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor(diff / (1000 * 60));

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <div className="text-red-500 mb-2">⚠️ {error}</div>
                <button
                    onClick={loadVersions}
                    className="text-sm text-indigo-500 hover:text-indigo-600"
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-indigo-500" />
                        Version History
                    </h3>
                    <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                        {versions.length} versions
                    </span>
                </div>

                {/* Compare Toggle */}
                <button
                    onClick={() => {
                        setCompareMode(!compareMode);
                        setCompareSelection([]);
                    }}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${compareMode
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                >
                    <GitCompare className="w-3.5 h-3.5" />
                    {compareMode ? `Select 2 versions (${compareSelection.length}/2)` : 'Compare Versions'}
                </button>

                {compareMode && compareSelection.length === 2 && (
                    <button
                        onClick={handleCompare}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                    >
                        <GitCompare className="w-3.5 h-3.5" />
                        Compare Selected
                    </button>
                )}
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="relative">
                    {/* Timeline Line */}
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

                    {/* Version Items */}
                    <div className="space-y-4">
                        {versions.map((version, index) => {
                            const isCurrent = version.id === currentVersionId || (index === 0 && !currentVersionId);
                            const isSelected = compareSelection.find(v => v.id === version.id);
                            const isExpanded = expandedId === version.id;
                            const toolColor = TOOL_COLORS[version.created_by_tool] || TOOL_COLORS.api;

                            return (
                                <div
                                    key={version.id}
                                    className={`relative pl-12 transition-all ${compareMode ? 'cursor-pointer' : ''
                                        }`}
                                >
                                    {/* Timeline Node */}
                                    <div
                                        className={`absolute left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isCurrent
                                            ? 'bg-indigo-500 border-indigo-500 text-white'
                                            : isSelected
                                                ? 'bg-purple-500 border-purple-500 text-white'
                                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                                            }`}
                                        style={{ top: '8px' }}
                                    >
                                        {isCurrent && <Check className="w-3 h-3" />}
                                        {isSelected && !isCurrent && <span className="text-[10px] font-bold">{compareSelection.indexOf(version) + 1}</span>}
                                    </div>

                                    {/* Version Card */}
                                    <div
                                        onClick={() => handleVersionClick(version)}
                                        className={`group p-4 rounded-xl border transition-all cursor-pointer ${isCurrent
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                                            : isSelected
                                                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                                                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                            }`}
                                    >
                                        {/* Header Row */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className={`font-semibold text-sm ${isCurrent ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white'
                                                        }`}>
                                                        {version.version_name}
                                                    </h4>
                                                    {isCurrent && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider">
                                                            Current
                                                        </span>
                                                    )}
                                                    {version.isVirtual && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-medium">
                                                            Original
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatDate(version.created_at)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <div className={`w-4 h-4 rounded flex items-center justify-center text-white ${toolColor}`}>
                                                            {TOOL_ICONS[version.created_by_tool] || TOOL_ICONS.api}
                                                        </div>
                                                        {version.created_by_tool}
                                                    </span>
                                                    {version.row_count > 0 && (
                                                        <span>{version.row_count.toLocaleString()} rows</span>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedId(isExpanded ? null : version.id);
                                                }}
                                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {/* Description */}
                                        {version.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                                                {version.description}
                                            </p>
                                        )}

                                        {/* Expanded Actions */}
                                        {isExpanded && (
                                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onVersionSelect(version);
                                                    }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all"
                                                >
                                                    <FileText className="w-3.5 h-3.5" />
                                                    View
                                                </button>
                                                {!isCurrent && !version.isVirtual && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onRestore(version);
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all"
                                                    >
                                                        <Undo2 className="w-3.5 h-3.5" />
                                                        Restore
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {versions.length === 0 && (
                        <div className="text-center py-12">
                            <GitBranch className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                            <p className="text-sm text-slate-500">No versions yet</p>
                            <p className="text-xs text-slate-400 mt-1">Versions are created when you save changes</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VersionTimeline;
