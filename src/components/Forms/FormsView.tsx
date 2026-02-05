import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FileInput,
    Plus,
    Search,
    MoreHorizontal,
    Clock,
    Eye,
    ChevronRight,
    BarChart2,
    Users,
    Copy,
    Trash2,
    ExternalLink,
    Loader2
} from 'lucide-react';
import { FormBuilder, FormRenderer } from './FormBuilder';
import { FormField } from './FormFieldInput';
import { Button, Input, Badge, Card, Modal } from '../UI';
import { formsService } from '../../services/workOsService';
import { useWorkspace } from '../../context/WorkspaceContext';

interface Form {
    id: string;
    title: string;
    description?: string;
    fields: FormField[];
    responses: number;
    createdAt: Date;
    updatedAt: Date;
    status: 'draft' | 'published' | 'closed';
}

export const FormsView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id;

    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeForm, setActiveForm] = useState<Form | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showResponses, setShowResponses] = useState(false);

    // Fetch forms on mount
    useEffect(() => {
        const fetchForms = async () => {
            if (!workspaceId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const data = await formsService.getAll(workspaceId);
                const transformedForms: Form[] = (data || []).map((f: any) => ({
                    id: f.id,
                    title: f.title,
                    description: f.description,
                    fields: [],
                    responses: f.response_count || 0,
                    createdAt: new Date(f.created_at),
                    updatedAt: new Date(f.updated_at),
                    status: f.status || 'draft'
                }));
                setForms(transformedForms);
            } catch (error) {
                console.error('Failed to fetch forms:', error);
                setForms([]);
            } finally {
                setLoading(false);
            }
        };
        fetchForms();
    }, [workspaceId]);

    // Fetch form fields when selecting a form
    useEffect(() => {
        const fetchFormDetails = async () => {
            if (!id) {
                setActiveForm(null);
                return;
            }

            try {
                const data = await formsService.getById(id);
                const form: Form = {
                    id: data.id,
                    title: data.title,
                    description: data.description,
                    fields: (data.fields || []).map((f: any) => ({
                        id: f.id,
                        type: f.type,
                        label: f.label,
                        placeholder: f.placeholder,
                        required: f.required,
                        options: f.options
                    })),
                    responses: data.response_count || 0,
                    createdAt: new Date(data.created_at),
                    updatedAt: new Date(data.updated_at),
                    status: data.status || 'draft'
                };
                setActiveForm(form);
            } catch (error) {
                console.error('Failed to fetch form:', error);
                setActiveForm(null);
            }
        };
        fetchFormDetails();
    }, [id]);

    const filteredForms = forms.filter(f =>
        f.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateForm = async () => {
        if (!workspaceId) return;
        try {
            const newForm = await formsService.create({
                title: 'Untitled Form',
                workspace_id: workspaceId,
                status: 'draft'
            });

            const transformedForm: Form = {
                id: newForm.id,
                title: newForm.title,
                description: newForm.description,
                fields: [],
                responses: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'draft'
            };

            setForms([transformedForm, ...forms]);
            setActiveForm(transformedForm);
            navigate(`/app/forms/${newForm.id}`);
        } catch (error) {
            console.error('Failed to create form:', error);
        }
    };

    const handleUpdateForm = useCallback(async (updates: Partial<Form>) => {
        if (!activeForm) return;

        const updatedForm = { ...activeForm, ...updates, updatedAt: new Date() };
        setActiveForm(updatedForm);
        setForms(fs => fs.map(f => f.id === activeForm.id ? updatedForm : f));

        try {
            if (updates.title !== undefined) {
                await formsService.update(activeForm.id, { title: updates.title });
            }
            if (updates.fields !== undefined) {
                await formsService.updateFields(activeForm.id, updates.fields.map((f, i) => ({
                    id: f.id,
                    type: f.type,
                    label: f.label,
                    placeholder: f.placeholder,
                    required: f.required,
                    options: f.options,
                    position: i
                })));
            }
        } catch (error) {
            console.error('Failed to update form:', error);
        }
    }, [activeForm]);

    const handleDeleteForm = async (formId: string) => {
        try {
            await formsService.delete(formId);
            setForms(fs => fs.filter(f => f.id !== formId));
            if (activeForm?.id === formId) {
                setActiveForm(null);
                navigate('/app/forms');
            }
        } catch (error) {
            console.error('Failed to delete form:', error);
        }
    };

    const statusColors = {
        draft: 'default',
        published: 'success',
        closed: 'warning'
    } as const;

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-950">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                    <p className="text-slate-400">Loading forms...</p>
                </div>
            </div>
        );
    }

    // Form List View
    if (!activeForm) {
        return (
            <div className="h-full flex flex-col bg-slate-950">
                <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <FileInput className="w-6 h-6 text-emerald-400" />
                            Forms
                        </h1>
                        <div className="w-64">
                            <Input
                                placeholder="Search forms..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                inputSize="sm"
                                leftIcon={<Search className="w-4 h-4" />}
                            />
                        </div>
                    </div>
                    <Button onClick={handleCreateForm} leftIcon={<Plus className="w-4 h-4" />}>
                        Create Form
                    </Button>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredForms.map(form => (
                            <Card
                                key={form.id}
                                hover
                                padding="none"
                                onClick={() => {
                                    setActiveForm(form);
                                    navigate(`/app/forms/${form.id}`);
                                }}
                                className="overflow-hidden"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-medium text-white">{form.title}</h3>
                                            {form.description && (
                                                <p className="text-sm text-slate-500 mt-1">{form.description}</p>
                                            )}
                                        </div>
                                        <Badge variant={statusColors[form.status]} size="sm">
                                            {form.status}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <FileInput className="w-4 h-4" />
                                            {form.fields.length} fields
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Users className="w-4 h-4" />
                                            {form.responses} responses
                                        </span>
                                    </div>
                                </div>

                                <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/30 flex items-center justify-between">
                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {form.updatedAt.toLocaleDateString()}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(`${window.location.origin}/forms/${form.id}`);
                                            }}
                                            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteForm(form.id);
                                            }}
                                            className="p-1.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    {filteredForms.length === 0 && (
                        <div className="text-center py-12">
                            <FileInput className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-400">No forms yet</h3>
                            <p className="text-slate-500 mt-1">Create your first form to get started</p>
                            <Button onClick={handleCreateForm} className="mt-4">
                                Create Form
                            </Button>
                        </div>
                    )}
                </main>
            </div>
        );
    }

    // Form Builder View
    return (
        <div className="h-full flex flex-col bg-slate-950">
            {/* Navigation */}
            <div className="px-6 py-2 border-b border-slate-800 bg-slate-900/30 flex items-center gap-2 text-sm">
                <button
                    onClick={() => {
                        setActiveForm(null);
                        navigate('/app/forms');
                    }}
                    className="text-slate-400 hover:text-white transition-colors"
                >
                    Forms
                </button>
                <ChevronRight className="w-4 h-4 text-slate-600" />
                <span className="text-white">{activeForm.title}</span>
            </div>

            {/* Builder */}
            <div className="flex-1 overflow-hidden">
                <FormBuilder
                    fields={activeForm.fields}
                    onChange={(fields) => handleUpdateForm({ fields })}
                    title={activeForm.title}
                    onTitleChange={(title) => handleUpdateForm({ title })}
                />
            </div>
        </div>
    );
};

export default FormsView;
