/**
 * Version Control Types
 * Phase 1.1: Dataset Version Control System
 */

export interface Version {
    id: string;
    version_name: string;
    description?: string;
    row_count: number;
    created_by_tool: string; // 'playground' | 'cleaning' | 'dataflow' | 'upload' | 'manual' | 'api'
    parent_version_id?: string | null;
    created_at: string;
    isVirtual?: boolean; // For legacy "root" version
    data?: any[]; // Actual data when loaded
    headers?: string[];
}

export interface VersionDiff {
    addedRows: number;
    deletedRows: number;
    modifiedRows: number;
    addedColumns: string[];
    deletedColumns: string[];
    changes: CellChange[];
}

export interface CellChange {
    row: number;
    column: string;
    oldValue: any;
    newValue: any;
}

export interface VersionContextValue {
    // State
    versions: Version[];
    currentVersion: Version | null;
    isLoading: boolean;
    isDirty: boolean;
    error: string | null;

    // Actions
    loadVersions: (datasetId: string) => Promise<void>;
    selectVersion: (versionId: string) => Promise<void>;
    commitVersion: (name: string, description: string, data: any[], headers: string[], tool: string) => Promise<Version>;
    restoreVersion: (versionId: string) => Promise<void>;
    compareVersions: (v1Id: string, v2Id: string) => Promise<VersionDiff>;

    // State setters
    setDirty: (dirty: boolean) => void;
}

export interface VersionSelectorProps {
    datasetId: string;
    workspaceId: string;
    currentVersionId?: string | null;
    onVersionSelect: (version: Version) => void;
    onCommit?: () => void;
    compact?: boolean;
    showCommitButton?: boolean;
    className?: string;
}

export interface VersionTimelineProps {
    datasetId: string;
    workspaceId: string;
    currentVersionId?: string | null;
    onVersionSelect: (version: Version) => void;
    onRestore: (version: Version) => void;
    onCompare?: (v1: Version, v2: Version) => void;
}

export interface CommitVersionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCommit: (name: string, description: string) => Promise<void>;
    isCommitting: boolean;
    suggestedName?: string;
    tool: string;
}

export interface VersionBadgeProps {
    version: Version | null;
    isDirty: boolean;
    onClick?: () => void;
    className?: string;
}

export interface VersionCompareProps {
    version1: Version;
    version2: Version;
    diff: VersionDiff | null;
    onClose: () => void;
}
