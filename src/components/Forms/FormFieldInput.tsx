import React from 'react';
import {
    Type,
    Mail,
    Phone,
    Hash,
    Calendar,
    List,
    CheckSquare,
    ToggleLeft,
    FileUp,
    Star,
    AlignLeft
} from 'lucide-react';
import { Input } from '../UI';

// Field Types
export type FieldType =
    | 'text'
    | 'email'
    | 'phone'
    | 'number'
    | 'date'
    | 'select'
    | 'multiSelect'
    | 'checkbox'
    | 'toggle'
    | 'textarea'
    | 'file'
    | 'rating';

export interface FieldOption {
    label: string;
    value: string;
}

export interface FormField {
    id: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    required?: boolean;
    description?: string;
    options?: FieldOption[]; // For select/multiSelect
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        minLength?: number;
        maxLength?: number;
    };
    value?: any;
}

export const FIELD_TYPES: { type: FieldType; icon: React.ElementType; label: string }[] = [
    { type: 'text', icon: Type, label: 'Short Text' },
    { type: 'email', icon: Mail, label: 'Email' },
    { type: 'phone', icon: Phone, label: 'Phone' },
    { type: 'number', icon: Hash, label: 'Number' },
    { type: 'date', icon: Calendar, label: 'Date' },
    { type: 'select', icon: List, label: 'Dropdown' },
    { type: 'multiSelect', icon: CheckSquare, label: 'Multiple Choice' },
    { type: 'checkbox', icon: CheckSquare, label: 'Checkbox' },
    { type: 'toggle', icon: ToggleLeft, label: 'Toggle' },
    { type: 'textarea', icon: AlignLeft, label: 'Long Text' },
    { type: 'file', icon: FileUp, label: 'File Upload' },
    { type: 'rating', icon: Star, label: 'Rating' }
];

interface FormFieldInputProps {
    field: FormField;
    value: any;
    onChange: (value: any) => void;
    error?: string;
    readOnly?: boolean;
}

export const FormFieldInput: React.FC<FormFieldInputProps> = ({
    field,
    value,
    onChange,
    error,
    readOnly = false
}) => {
    const renderField = () => {
        switch (field.type) {
            case 'text':
            case 'email':
            case 'phone':
                return (
                    <Input
                        type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.placeholder}
                        disabled={readOnly}
                        error={error}
                    />
                );

            case 'number':
                return (
                    <Input
                        type="number"
                        value={value || ''}
                        onChange={(e) => onChange(parseFloat(e.target.value) || '')}
                        placeholder={field.placeholder}
                        disabled={readOnly}
                        error={error}
                    />
                );

            case 'date':
                return (
                    <input
                        type="date"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={readOnly}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                    />
                );

            case 'textarea':
                return (
                    <textarea
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.placeholder}
                        disabled={readOnly}
                        rows={4}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 resize-none"
                    />
                );

            case 'select':
                return (
                    <select
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={readOnly}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                    >
                        <option value="">Select an option</option>
                        {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                );

            case 'multiSelect':
                return (
                    <div className="space-y-2">
                        {field.options?.map((opt) => {
                            const isChecked = Array.isArray(value) && value.includes(opt.value);
                            return (
                                <label
                                    key={opt.value}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-600 transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                            const newValue = Array.isArray(value) ? [...value] : [];
                                            if (e.target.checked) {
                                                newValue.push(opt.value);
                                            } else {
                                                const idx = newValue.indexOf(opt.value);
                                                if (idx > -1) newValue.splice(idx, 1);
                                            }
                                            onChange(newValue);
                                        }}
                                        disabled={readOnly}
                                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-500"
                                    />
                                    <span className="text-slate-300">{opt.label}</span>
                                </label>
                            );
                        })}
                    </div>
                );

            case 'checkbox':
                return (
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => onChange(e.target.checked)}
                            disabled={readOnly}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-500"
                        />
                        <span className="text-slate-300">
                            {field.placeholder || 'Yes'}
                        </span>
                    </label>
                );

            case 'toggle':
                return (
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => onChange(e.target.checked)}
                            disabled={readOnly}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        <span className="ml-3 text-sm text-slate-300">
                            {value ? 'On' : 'Off'}
                        </span>
                    </label>
                );

            case 'file':
                return (
                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer">
                        <FileUp className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">
                            Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            PNG, JPG, PDF up to 10MB
                        </p>
                        <input
                            type="file"
                            onChange={(e) => onChange(e.target.files?.[0])}
                            disabled={readOnly}
                            className="hidden"
                        />
                    </div>
                );

            case 'rating':
                return (
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => !readOnly && onChange(star)}
                                className={`p-1 transition-colors ${star <= (value || 0)
                                        ? 'text-amber-400'
                                        : 'text-slate-600 hover:text-slate-400'
                                    }`}
                            >
                                <Star
                                    className={`w-8 h-8 ${star <= (value || 0) ? 'fill-amber-400' : ''}`}
                                />
                            </button>
                        ))}
                    </div>
                );

            default:
                return <p className="text-slate-500">Unknown field type</p>;
        }
    };

    return (
        <div className="space-y-2">
            <label className="block">
                <span className="text-sm font-medium text-white">
                    {field.label}
                    {field.required && <span className="text-rose-500 ml-1">*</span>}
                </span>
                {field.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{field.description}</p>
                )}
            </label>
            {renderField()}
            {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>
    );
};

export default FormFieldInput;
