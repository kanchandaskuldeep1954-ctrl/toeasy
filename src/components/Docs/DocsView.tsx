import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FileText,
    Plus,
    Search,
    Star,
    StarOff,
    MoreHorizontal,
    Clock,
    Users,
    Lock,
    Globe,
    ChevronRight,
    Sparkles,
    Share2,
    Download,
    Trash2,
    Copy,
    Loader2
} from 'lucide-react';
import { BlockEditor, Block } from './BlockEditor';
import { Button, Input, Modal, Badge, Avatar, Card } from '../UI';
import { docsService } from '../../../services/workOsService';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface Document {
    id: string;
    title: string;
    icon?: string;
    cover?: string;
    starred?: boolean;
    shared?: boolean;
    updatedAt: Date;
    author: { id: string; name: string };
    blocks: Block[];
}

export const DocsView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id;

    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDoc, setActiveDoc] = useState<Document | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);

    // Fetch documents on mount
    useEffect(() => {
        const fetchDocuments = async () => {
            if (!workspaceId) return;
            setLoading(true);
            try {
                const data = await docsService.getAll(workspaceId);
                const transformedDocs: Document[] = (data || []).map((d: any) => ({
                    id: d.id,
                    title: d.title,
                    icon: d.icon || '📄',
                    cover: d.cover_image,
                    starred: d.is_starred,
                    shared: false,
                    updatedAt: new Date(d.updated_at),
                    author: { id: d.created_by || '', name: 'User' },
                    blocks: []
                }));
                setDocuments(transformedDocs);
            } catch (error) {
                console.error('Failed to fetch documents:', error);
                setDocuments([]);
            } finally {
                setLoading(false);
            }
        };
        fetchDocuments();
    }, [workspaceId]);

    // Fetch document blocks when selecting a document
    useEffect(() => {
        const fetchDocBlocks = async () => {
            if (!id) {
                setActiveDoc(null);
                return;
            }

            try {
                const data = await docsService.getById(id);
                const doc: Document = {
                    id: data.id,
                    title: data.title,
                    icon: data.icon || '📄',
                    cover: data.cover_image,
                    starred: data.is_starred,
                    shared: false,
                    updatedAt: new Date(data.updated_at),
                    author: { id: data.created_by || '', name: 'User' },
                    blocks: (data.blocks || []).map((b: any) => ({
                        id: b.id,
                        type: b.type,
                        content: b.content,
                        checked: b.properties?.checked
                    }))
                };
                setActiveDoc(doc);
            } catch (error) {
                console.error('Failed to fetch document:', error);
                setActiveDoc(null);
            }
        };
        fetchDocBlocks();
    }, [id]);

    const filteredDocs = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const starredDocs = filteredDocs.filter(d => d.starred);
    const recentDocs = filteredDocs.filter(d => !d.starred);

    const handleCreateDoc = async () => {
        if (!workspaceId) return;
        try {
            const newDoc = await docsService.create({
                title: 'Untitled',
                icon: '📄',
                workspace_id: workspaceId
            });

            const transformedDoc: Document = {
                id: newDoc.id,
                title: newDoc.title,
                icon: newDoc.icon || '📄',
                updatedAt: new Date(),
                author: { id: '', name: 'User' },
                blocks: []
            };

            setDocuments([transformedDoc, ...documents]);
            setActiveDoc(transformedDoc);
            navigate(`/app/docs/${newDoc.id}`);
        } catch (error) {
            console.error('Failed to create document:', error);
        }
    };

    const handleUpdateBlocks = useCallback(async (blocks: Block[]) => {
        if (!activeDoc) return;

        // Optimistic update
        const updatedDoc = { ...activeDoc, blocks, updatedAt: new Date() };
        setActiveDoc(updatedDoc);
        setDocuments(docs => docs.map(d => d.id === activeDoc.id ? updatedDoc : d));

        // Save to backend (debounced in production)
        setSaveLoading(true);
        try {
            await docsService.updateBlocks(activeDoc.id, blocks.map(b => ({
                id: b.id,
                type: b.type,
                content: b.content,
                properties: b.checked !== undefined ? { checked: b.checked } : {},
                position: blocks.indexOf(b)
            })));
        } catch (error) {
            console.error('Failed to save blocks:', error);
        } finally {
            setSaveLoading(false);
        }
    }, [activeDoc]);

    const handleToggleStar = async (docId: string) => {
        const doc = documents.find(d => d.id === docId);
        if (!doc) return;

        // Optimistic update
        setDocuments(docs => docs.map(d =>
            d.id === docId ? { ...d, starred: !d.starred } : d
        ));

        try {
            await docsService.update(docId, { is_starred: !doc.starred });
        } catch (error) {
            console.error('Failed to toggle star:', error);
            // Revert
            setDocuments(docs => docs.map(d =>
                d.id === docId ? { ...d, starred: doc.starred } : d
            ));
        }
    };

    const handleAIWrite = async () => {
        if (!aiPrompt.trim()) return;

        // Simulate AI response (would call AI service in production)
        const aiBlock: Block = {
            id: `block-${Date.now()}`,
            type: 'paragraph',
            content: `[AI Generated] Here's content about: ${aiPrompt}. This would be generated by the AI in production.`
        };

        if (activeDoc) {
            handleUpdateBlocks([...activeDoc.blocks, aiBlock]);
        }

        setAiPrompt('');
        setShowAIPanel(false);
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-950">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                    <p className="text-slate-400">Loading documents...</p>
                </div>
            </div>
        );
    }

    // Document List View
    if (!activeDoc) {
        return (
            <div className="h-full flex flex-col bg-slate-950">
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <FileText className="w-6 h-6 text-indigo-400" />
                            Documents
                        </h1>
                        <div className="w-64">
                            <Input
                                placeholder="Search docs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                inputSize="sm"
                                leftIcon={<Search className="w-4 h-4" />}
                            />
                        </div>
                    </div>
                    <Button onClick={handleCreateDoc} leftIcon={<Plus className="w-4 h-4" />}>
                        New Doc
                    </Button>
                </header>

                {/* Document Grid */}
                <main className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Starred Section */}
                    {starredDocs.length > 0 && (
                        <section>
                            <h2 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
                                <Star className="w-4 h-4" />
                                Starred
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {starredDocs.map(doc => (
                                    <DocCard
                                        key={doc.id}
                                        doc={doc}
                                        onClick={() => {
                                            setActiveDoc(doc);
                                            navigate(`/app/docs/${doc.id}`);
                                        }}
                                        onToggleStar={() => handleToggleStar(doc.id)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Recent Section */}
                    <section>
                        <h2 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Recent
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {recentDocs.map(doc => (
                                <DocCard
                                    key={doc.id}
                                    doc={doc}
                                    onClick={() => {
                                        setActiveDoc(doc);
                                        navigate(`/app/docs/${doc.id}`);
                                    }}
                                    onToggleStar={() => handleToggleStar(doc.id)}
                                />
                            ))}
                        </div>
                    </section>

                    {filteredDocs.length === 0 && (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-400">No documents found</h3>
                            <p className="text-slate-500 mt-1">Create your first document to get started</p>
                            <Button onClick={handleCreateDoc} className="mt-4">
                                Create Document
                            </Button>
                        </div>
                    )}
                </main>
            </div>
        );
    }

    // Single Document Editor View
    return (
        <div className="h-full flex bg-slate-950">
            {/* Main Editor */}
            <div className="flex-1 flex flex-col">
                {/* Editor Header */}
                <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setActiveDoc(null);
                                navigate('/app/docs');
                            }}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>

                        <span className="text-2xl">{activeDoc.icon}</span>

                        <input
                            type="text"
                            value={activeDoc.title}
                            onChange={async (e) => {
                                const updated = { ...activeDoc, title: e.target.value };
                                setActiveDoc(updated);
                                setDocuments(docs => docs.map(d => d.id === activeDoc.id ? updated : d));
                                try {
                                    await docsService.update(activeDoc.id, { title: e.target.value });
                                } catch (error) {
                                    console.error('Failed to update title:', error);
                                }
                            }}
                            className="text-xl font-semibold text-white bg-transparent border-none outline-none"
                            placeholder="Untitled"
                        />

                        {saveLoading && (
                            <span className="text-xs text-slate-500">Saving...</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAIPanel(!showAIPanel)}
                            leftIcon={<Sparkles className="w-4 h-4 text-amber-400" />}
                        >
                            AI Write
                        </Button>
                        <Button variant="ghost" size="sm" leftIcon={<Share2 className="w-4 h-4" />}>
                            Share
                        </Button>
                        <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                            <MoreHorizontal className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Editor Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto py-8 px-4">
                        <BlockEditor
                            blocks={activeDoc.blocks}
                            onChange={handleUpdateBlocks}
                        />
                    </div>
                </div>

                {/* Footer */}
                <footer className="px-6 py-2 border-t border-slate-800 bg-slate-900/50 text-xs text-slate-500 flex items-center justify-between">
                    <span>
                        Last edited {activeDoc.updatedAt.toLocaleTimeString()}
                    </span>
                    <span>
                        {activeDoc.blocks.length} blocks
                    </span>
                </footer>
            </div>

            {/* AI Panel */}
            {showAIPanel && (
                <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="border-l border-slate-800 bg-slate-900/50"
                >
                    <div className="w-80 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-amber-400" />
                                AI Writer
                            </h3>
                            <button
                                onClick={() => setShowAIPanel(false)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4">
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="Describe what you want AI to write..."
                                className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 resize-none"
                            />

                            <div className="space-y-2">
                                <p className="text-xs text-slate-500">Quick prompts:</p>
                                {['Summarize this document', 'Write an introduction', 'Create an outline', 'Make it more concise'].map((prompt) => (
                                    <button
                                        key={prompt}
                                        onClick={() => setAiPrompt(prompt)}
                                        className="block w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>

                            <Button onClick={handleAIWrite} fullWidth>
                                Generate
                            </Button>
                        </div>
                    </div>
                </motion.aside>
            )}
        </div>
    );
};

// Document Card Component
const DocCard: React.FC<{
    doc: Document;
    onClick: () => void;
    onToggleStar: () => void;
}> = ({ doc, onClick, onToggleStar }) => {
    return (
        <Card hover padding="none" onClick={onClick} className="overflow-hidden">
            {/* Cover (optional) */}
            {doc.cover && (
                <div
                    className="h-24 bg-cover bg-center"
                    style={{ backgroundImage: `url(${doc.cover})` }}
                />
            )}

            <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{doc.icon}</span>
                        <h3 className="font-medium text-white truncate">{doc.title}</h3>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleStar();
                        }}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
                    >
                        {doc.starred ? (
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ) : (
                            <StarOff className="w-4 h-4" />
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {doc.updatedAt.toLocaleDateString()}
                    </span>
                    {doc.shared && (
                        <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            Shared
                        </span>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default DocsView;
