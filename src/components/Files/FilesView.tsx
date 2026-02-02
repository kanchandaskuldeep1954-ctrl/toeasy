import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Folder,
    FolderPlus,
    File,
    FileText,
    FileSpreadsheet,
    FileImage,
    FileVideo,
    FileAudio,
    FileArchive,
    FileCode,
    Upload,
    Download,
    Trash2,
    Copy,
    Move,
    MoreHorizontal,
    Search,
    Grid,
    List,
    ChevronRight,
    Star,
    StarOff,
    Clock,
    SortAsc,
    Loader2
} from 'lucide-react';
import { Button, Input, Modal, Badge, Card } from '../UI';
import { filesService } from '../../../services/workOsService';
import { useWorkspace } from '../../contexts/WorkspaceContext';

// File Types
export interface FileItem {
    id: string;
    name: string;
    type: 'folder' | 'file';
    mimeType?: string;
    size?: number;
    starred?: boolean;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    owner: { id: string; name: string };
}

const FILE_ICONS: Record<string, React.ElementType> = {
    'folder': Folder,
    'application/pdf': FileText,
    'text/plain': FileText,
    'text/markdown': FileText,
    'application/vnd.ms-excel': FileSpreadsheet,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
    'text/csv': FileSpreadsheet,
    'image/': FileImage,
    'video/': FileVideo,
    'audio/': FileAudio,
    'application/zip': FileArchive,
    'application/x-rar': FileArchive,
    'text/javascript': FileCode,
    'text/typescript': FileCode,
    'application/json': FileCode,
    'text/html': FileCode,
    'text/css': FileCode
};

const getFileIcon = (item: FileItem) => {
    if (item.type === 'folder') return Folder;

    for (const [mime, icon] of Object.entries(FILE_ICONS)) {
        if (item.mimeType?.startsWith(mime)) return icon;
    }
    return File;
};

const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export const FilesView: React.FC = () => {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id;

    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [view, setView] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);

    // Fetch files on mount
    useEffect(() => {
        const fetchFiles = async () => {
            if (!workspaceId) return;
            setLoading(true);
            try {
                const [filesData, foldersData] = await Promise.all([
                    filesService.getAll(workspaceId),
                    filesService.getFolders(workspaceId)
                ]);

                const transformedFiles: FileItem[] = [
                    ...(foldersData || []).map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        type: 'folder' as const,
                        parentId: f.parent_id || null,
                        starred: f.is_starred,
                        createdAt: new Date(f.created_at),
                        updatedAt: new Date(f.updated_at),
                        owner: { id: f.created_by || '', name: 'User' }
                    })),
                    ...(filesData || []).map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        type: 'file' as const,
                        mimeType: f.mime_type,
                        size: f.size,
                        parentId: f.folder_id || null,
                        starred: f.is_starred,
                        createdAt: new Date(f.created_at),
                        updatedAt: new Date(f.updated_at),
                        owner: { id: f.uploaded_by || '', name: 'User' }
                    }))
                ];

                setFiles(transformedFiles);
            } catch (error) {
                console.error('Failed to fetch files:', error);
                setFiles([]);
            } finally {
                setLoading(false);
            }
        };
        fetchFiles();
    }, [workspaceId]);

    // Get breadcrumb path
    const breadcrumbs = useMemo(() => {
        const path: { id: string | null; name: string }[] = [{ id: null, name: 'Files' }];
        let folderId = currentFolderId;

        while (folderId) {
            const folder = files.find(f => f.id === folderId);
            if (folder) {
                path.splice(1, 0, { id: folder.id, name: folder.name });
                folderId = folder.parentId;
            } else {
                break;
            }
        }

        return path;
    }, [currentFolderId, files]);

    // Filter files for current folder
    const currentFiles = useMemo(() => {
        return files
            .filter(f => f.parentId === currentFolderId)
            .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => {
                // Folders first, then by name
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
    }, [files, currentFolderId, searchQuery]);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !workspaceId) return;
        setCreateLoading(true);

        try {
            const newFolder = await filesService.createFolder({
                name: newFolderName.trim(),
                parent_id: currentFolderId,
                workspace_id: workspaceId
            });

            const transformedFolder: FileItem = {
                id: newFolder.id,
                name: newFolder.name,
                type: 'folder',
                parentId: newFolder.parent_id || null,
                createdAt: new Date(),
                updatedAt: new Date(),
                owner: { id: '', name: 'User' }
            };

            setFiles([...files, transformedFolder]);
            setNewFolderName('');
            setShowNewFolder(false);
        } catch (error) {
            console.error('Failed to create folder:', error);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDelete = async (ids: string[]) => {
        try {
            await Promise.all(ids.map(id => {
                const item = files.find(f => f.id === id);
                if (item?.type === 'folder') {
                    return filesService.deleteFolder(id);
                }
                return filesService.delete(id);
            }));
            setFiles(files.filter(f => !ids.includes(f.id)));
            setSelectedIds(new Set());
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const handleToggleStar = async (id: string) => {
        const item = files.find(f => f.id === id);
        if (!item) return;

        // Optimistic update
        setFiles(files.map(f =>
            f.id === id ? { ...f, starred: !f.starred } : f
        ));

        try {
            if (item.type === 'folder') {
                await filesService.updateFolder(id, { is_starred: !item.starred });
            } else {
                await filesService.update(id, { is_starred: !item.starred });
            }
        } catch (error) {
            console.error('Failed to toggle star:', error);
            // Revert
            setFiles(files.map(f =>
                f.id === id ? { ...f, starred: item.starred } : f
            ));
        }
    };

    const handleNavigate = (item: FileItem) => {
        if (item.type === 'folder') {
            setCurrentFolderId(item.id);
            setSelectedIds(new Set());
        } else {
            // Open file preview or download
            console.log('Open file:', item);
        }
    };

    const handleUpload = async (fileList: FileList) => {
        if (!workspaceId) return;
        setUploadLoading(true);

        try {
            for (const file of Array.from(fileList)) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('workspace_id', workspaceId);
                if (currentFolderId) {
                    formData.append('folder_id', currentFolderId);
                }

                const uploaded = await filesService.upload(formData);

                const newFile: FileItem = {
                    id: uploaded.id,
                    name: uploaded.name || file.name,
                    type: 'file',
                    mimeType: uploaded.mime_type || file.type,
                    size: uploaded.size || file.size,
                    parentId: currentFolderId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    owner: { id: '', name: 'User' }
                };
                setFiles(prev => [...prev, newFile]);
            }
        } catch (error) {
            console.error('Failed to upload:', error);
        } finally {
            setUploadLoading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        if (e.dataTransfer.files.length > 0) {
            handleUpload(e.dataTransfer.files);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-950">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                    <p className="text-slate-400">Loading files...</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="h-full flex flex-col bg-slate-950"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
        >
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Folder className="w-6 h-6 text-amber-400" />
                        Files
                    </h1>
                    <div className="w-64">
                        <Input
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            inputSize="sm"
                            leftIcon={<Search className="w-4 h-4" />}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setView('grid')}
                            className={`p-2 transition-colors ${view === 'grid'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className={`p-2 transition-colors ${view === 'list'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowNewFolder(true)}
                        leftIcon={<FolderPlus className="w-4 h-4" />}
                    >
                        New Folder
                    </Button>

                    <Button
                        leftIcon={uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={uploadLoading}
                    >
                        {uploadLoading ? 'Uploading...' : 'Upload'}
                    </Button>
                    <input
                        id="file-upload"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && handleUpload(e.target.files)}
                    />
                </div>
            </header>

            {/* Breadcrumbs */}
            <div className="px-6 py-2 border-b border-slate-800 bg-slate-900/30 flex items-center gap-1 text-sm">
                {breadcrumbs.map((crumb, i) => (
                    <React.Fragment key={crumb.id ?? 'root'}>
                        {i > 0 && <ChevronRight className="w-4 h-4 text-slate-600" />}
                        <button
                            onClick={() => setCurrentFolderId(crumb.id)}
                            className={`px-2 py-1 rounded hover:bg-slate-800 transition-colors ${i === breadcrumbs.length - 1 ? 'text-white' : 'text-slate-400'
                                }`}
                        >
                            {crumb.name}
                        </button>
                    </React.Fragment>
                ))}
            </div>

            {/* Selection Actions */}
            {selectedIds.size > 0 && (
                <div className="px-6 py-2 bg-indigo-600/10 border-b border-indigo-500/30 flex items-center gap-4">
                    <span className="text-sm text-indigo-300">{selectedIds.size} selected</span>
                    <Button variant="ghost" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                        Download
                    </Button>
                    <Button variant="ghost" size="sm" leftIcon={<Move className="w-4 h-4" />}>
                        Move
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 className="w-4 h-4" />}
                        onClick={() => handleDelete(Array.from(selectedIds))}
                        className="text-rose-400 hover:text-rose-300"
                    >
                        Delete
                    </Button>
                </div>
            )}

            {/* File Grid/List */}
            <main className={`flex-1 overflow-y-auto p-6 ${dragOver ? 'bg-indigo-600/10' : ''}`}>
                {dragOver && (
                    <div className="absolute inset-6 border-2 border-dashed border-indigo-500 rounded-2xl flex items-center justify-center bg-indigo-600/10 z-10">
                        <div className="text-center">
                            <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-2" />
                            <p className="text-indigo-300 font-medium">Drop files here to upload</p>
                        </div>
                    </div>
                )}

                {view === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {currentFiles.map((item) => {
                            const Icon = getFileIcon(item);
                            const isSelected = selectedIds.has(item.id);

                            return (
                                <motion.div
                                    key={item.id}
                                    layout
                                    whileHover={{ scale: 1.02 }}
                                    onDoubleClick={() => handleNavigate(item)}
                                    onClick={(e) => {
                                        if (e.ctrlKey || e.metaKey) {
                                            setSelectedIds(prev => {
                                                const next = new Set(prev);
                                                if (next.has(item.id)) next.delete(item.id);
                                                else next.add(item.id);
                                                return next;
                                            });
                                        } else {
                                            setSelectedIds(new Set([item.id]));
                                        }
                                    }}
                                    className={`group relative p-4 rounded-xl border cursor-pointer transition-all ${isSelected
                                        ? 'bg-indigo-600/20 border-indigo-500'
                                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                                        }`}
                                >
                                    {/* Star */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleStar(item.id);
                                        }}
                                        className={`absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${item.starred ? 'opacity-100' : ''
                                            }`}
                                    >
                                        {item.starred ? (
                                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                        ) : (
                                            <StarOff className="w-4 h-4 text-slate-500 hover:text-amber-400" />
                                        )}
                                    </button>

                                    <div className="flex flex-col items-center text-center">
                                        <Icon className={`w-12 h-12 mb-3 ${item.type === 'folder' ? 'text-amber-400' : 'text-slate-400'
                                            }`} />
                                        <p className="text-sm text-white truncate w-full font-medium">
                                            {item.name}
                                        </p>
                                        {item.size && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                {formatFileSize(item.size)}
                                            </p>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {currentFiles.map((item) => {
                            const Icon = getFileIcon(item);
                            const isSelected = selectedIds.has(item.id);

                            return (
                                <motion.div
                                    key={item.id}
                                    layout
                                    onDoubleClick={() => handleNavigate(item)}
                                    onClick={(e) => {
                                        if (e.ctrlKey || e.metaKey) {
                                            setSelectedIds(prev => {
                                                const next = new Set(prev);
                                                if (next.has(item.id)) next.delete(item.id);
                                                else next.add(item.id);
                                                return next;
                                            });
                                        } else {
                                            setSelectedIds(new Set([item.id]));
                                        }
                                    }}
                                    className={`group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all ${isSelected
                                        ? 'bg-indigo-600/20 border border-indigo-500'
                                        : 'hover:bg-slate-800/50'
                                        }`}
                                >
                                    <Icon className={`w-6 h-6 flex-shrink-0 ${item.type === 'folder' ? 'text-amber-400' : 'text-slate-400'
                                        }`} />

                                    <div className="flex-1 min-w-0">
                                        <p className="text-white truncate">{item.name}</p>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                        {item.starred && (
                                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                        )}
                                        <span className="w-20 text-right">{formatFileSize(item.size)}</span>
                                        <span className="w-24 text-right">
                                            {item.updatedAt.toLocaleDateString()}
                                        </span>
                                        <span className="w-24 truncate">{item.owner.name}</span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {currentFiles.length === 0 && (
                    <div className="text-center py-12">
                        <Folder className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-400">No files here</h3>
                        <p className="text-slate-500 mt-1">
                            {searchQuery ? 'Try a different search' : 'Upload files or create a folder'}
                        </p>
                    </div>
                )}
            </main>

            {/* New Folder Modal */}
            <Modal
                isOpen={showNewFolder}
                onClose={() => setShowNewFolder(false)}
                title="New Folder"
            >
                <div className="space-y-4">
                    <Input
                        label="Folder Name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Enter folder name"
                        autoFocus
                        leftIcon={<Folder className="w-4 h-4" />}
                    />
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowNewFolder(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateFolder} disabled={createLoading}>
                            {createLoading ? 'Creating...' : 'Create'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default FilesView;
