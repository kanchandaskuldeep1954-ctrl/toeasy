import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
    Plus,
    GripVertical,
    Trash2,
    Copy,
    Settings,
    Eye,
    Save,
    ChevronDown,
    MoreHorizontal
} from 'lucide-react';
import { FormField, FIELD_TYPES, FormFieldInput } from './FormFieldInput';
import { Button, Input, Modal, Badge, Card } from '../UI';

interface FormBuilderProps {
    fields: FormField[];
    onChange: (fields: FormField[]) => void;
    title?: string;
    onTitleChange?: (title: string) => void;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
    fields,
    onChange,
    title = 'Untitled Form',
    onTitleChange
}) => {
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [showFieldPicker, setShowFieldPicker] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    const generateId = () => `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const addField = (type: FormField['type']) => {
        const fieldType = FIELD_TYPES.find(f => f.type === type);
        const newField: FormField = {
            id: generateId(),
            type,
            label: fieldType?.label || 'New Field',
            required: false
        };

        // Add default options for select types
        if (type === 'select' || type === 'multiSelect') {
            newField.options = [
                { label: 'Option 1', value: 'option1' },
                { label: 'Option 2', value: 'option2' },
                { label: 'Option 3', value: 'option3' }
            ];
        }

        onChange([...fields, newField]);
        setSelectedFieldId(newField.id);
        setShowFieldPicker(false);
    };

    const updateField = (id: string, updates: Partial<FormField>) => {
        onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const deleteField = (id: string) => {
        onChange(fields.filter(f => f.id !== id));
        if (selectedFieldId === id) setSelectedFieldId(null);
    };

    const duplicateField = (id: string) => {
        const field = fields.find(f => f.id === id);
        if (!field) return;

        const newField = { ...field, id: generateId(), label: `${field.label} (copy)` };
        const index = fields.findIndex(f => f.id === id);
        const newFields = [...fields];
        newFields.splice(index + 1, 0, newField);
        onChange(newFields);
    };

    const selectedField = fields.find(f => f.id === selectedFieldId);

    if (previewMode) {
        return (
            <div className="h-full flex flex-col bg-slate-950">
                <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white">Preview: {title}</h2>
                    <Button variant="secondary" onClick={() => setPreviewMode(false)}>
                        Exit Preview
                    </Button>
                </header>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-2xl mx-auto">
                        <FormRenderer fields={fields} onSubmit={(data) => console.log('Form data:', data)} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex bg-slate-950">
            {/* Main Builder Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => onTitleChange?.(e.target.value)}
                        className="text-xl font-semibold text-white bg-transparent border-none outline-none"
                        placeholder="Form title..."
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Eye className="w-4 h-4" />}
                            onClick={() => setPreviewMode(true)}
                        >
                            Preview
                        </Button>
                        <Button leftIcon={<Save className="w-4 h-4" />}>
                            Save Form
                        </Button>
                    </div>
                </header>

                {/* Fields List */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-2xl mx-auto space-y-3">
                        <Reorder.Group
                            values={fields}
                            onReorder={onChange}
                            className="space-y-3"
                        >
                            <AnimatePresence>
                                {fields.map((field, index) => (
                                    <Reorder.Item
                                        key={field.id}
                                        value={field}
                                        className="list-none"
                                    >
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            onClick={() => setSelectedFieldId(field.id)}
                                            className={`group relative p-4 rounded-xl border transition-all cursor-pointer ${selectedFieldId === field.id
                                                ? 'bg-slate-800/50 border-blue-500'
                                                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                                                }`}
                                        >
                                            {/* Drag Handle */}
                                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-1 rounded cursor-grab text-slate-500 hover:text-white">
                                                    <GripVertical className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Field Preview */}
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge variant="default" size="sm">
                                                            {FIELD_TYPES.find(f => f.type === field.type)?.label}
                                                        </Badge>
                                                        {field.required && (
                                                            <Badge variant="danger" size="sm">Required</Badge>
                                                        )}
                                                    </div>
                                                    <p className="font-medium text-white">{field.label}</p>
                                                    {field.description && (
                                                        <p className="text-sm text-slate-500">{field.description}</p>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            duplicateField(field.id);
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteField(field.id);
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </Reorder.Item>
                                ))}
                            </AnimatePresence>
                        </Reorder.Group>

                        {/* Add Field Button */}
                        <button
                            onClick={() => setShowFieldPicker(true)}
                            className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-blue-500 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Add Field
                        </button>
                    </div>
                </div>
            </div>

            {/* Field Settings Panel */}
            {selectedField && (
                <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    className="border-l border-slate-800 bg-slate-900/50 overflow-y-auto"
                >
                    <div className="w-80 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-white">Field Settings</h3>
                            <button
                                onClick={() => setSelectedFieldId(null)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400"
                            >
                                ×
                            </button>
                        </div>

                        <Input
                            label="Label"
                            value={selectedField.label}
                            onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                        />

                        <Input
                            label="Placeholder"
                            value={selectedField.placeholder || ''}
                            onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                        />

                        <Input
                            label="Description"
                            value={selectedField.description || ''}
                            onChange={(e) => updateField(selectedField.id, { description: e.target.value })}
                        />

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedField.required}
                                onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500"
                            />
                            <span className="text-slate-300">Required field</span>
                        </label>

                        {/* Options for select types */}
                        {(selectedField.type === 'select' || selectedField.type === 'multiSelect') && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white">Options</label>
                                {selectedField.options?.map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input
                                            value={opt.label}
                                            onChange={(e) => {
                                                const newOptions = [...(selectedField.options || [])];
                                                newOptions[i] = { ...opt, label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                                                updateField(selectedField.id, { options: newOptions });
                                            }}
                                            inputSize="sm"
                                        />
                                        <button
                                            onClick={() => {
                                                const newOptions = selectedField.options?.filter((_, idx) => idx !== i);
                                                updateField(selectedField.id, { options: newOptions });
                                            }}
                                            className="p-2 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        const newOptions = [...(selectedField.options || []), { label: 'New Option', value: 'new_option' }];
                                        updateField(selectedField.id, { options: newOptions });
                                    }}
                                    leftIcon={<Plus className="w-4 h-4" />}
                                >
                                    Add Option
                                </Button>
                            </div>
                        )}
                    </div>
                </motion.aside>
            )}

            {/* Field Type Picker Modal */}
            <Modal
                isOpen={showFieldPicker}
                onClose={() => setShowFieldPicker(false)}
                title="Add Field"
                size="lg"
            >
                <div className="grid grid-cols-3 gap-3">
                    {FIELD_TYPES.map((fieldType) => (
                        <button
                            key={fieldType.type}
                            onClick={() => addField(fieldType.type)}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 transition-all"
                        >
                            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                                <fieldType.icon className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-sm text-white">{fieldType.label}</span>
                        </button>
                    ))}
                </div>
            </Modal>
        </div>
    );
};

// Form Renderer Component
interface FormRendererProps {
    fields: FormField[];
    onSubmit: (data: Record<string, any>) => void;
    submitLabel?: string;
}

export const FormRenderer: React.FC<FormRendererProps> = ({
    fields,
    onSubmit,
    submitLabel = 'Submit'
}) => {
    const [values, setValues] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (fieldId: string, value: any) => {
        setValues(prev => ({ ...prev, [fieldId]: value }));
        if (errors[fieldId]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        fields.forEach(field => {
            if (field.required && !values[field.id]) {
                newErrors[field.id] = 'This field is required';
            }
            // Add more validation rules as needed
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSubmit(values);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {fields.map((field) => (
                <FormFieldInput
                    key={field.id}
                    field={field}
                    value={values[field.id]}
                    onChange={(value) => handleChange(field.id, value)}
                    error={errors[field.id]}
                />
            ))}

            <Button type="submit" fullWidth>
                {submitLabel}
            </Button>
        </form>
    );
};

export default FormBuilder;
