import React, { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    inputSize?: 'sm' | 'md' | 'lg';
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    hint?: string;
    inputSize?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-4 py-3 text-base'
};

const iconPadding = {
    left: { sm: 'pl-8', md: 'pl-10', lg: 'pl-11' },
    right: { sm: 'pr-8', md: 'pr-10', lg: 'pr-11' }
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    inputSize = 'md',
    className = '',
    id,
    ...props
}, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

    return (
        <div className="w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                    {label}
                </label>
            )}

            <div className="relative">
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {leftIcon}
                    </div>
                )}

                <input
                    ref={ref}
                    id={inputId}
                    className={`
                        w-full
                        bg-slate-800
                        border border-slate-700
                        rounded-xl
                        text-white
                        placeholder-slate-500
                        transition-all duration-200
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${sizeStyles[inputSize]}
                        ${leftIcon ? iconPadding.left[inputSize] : ''}
                        ${rightIcon ? iconPadding.right[inputSize] : ''}
                        ${error ? 'border-rose-500 focus:ring-rose-500' : ''}
                        ${className}
                    `}
                    {...props}
                />

                {rightIcon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {rightIcon}
                    </div>
                )}
            </div>

            {error && (
                <p className="mt-1.5 text-sm text-rose-400">{error}</p>
            )}

            {hint && !error && (
                <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
    label,
    error,
    hint,
    inputSize = 'md',
    className = '',
    id,
    rows = 4,
    ...props
}, ref) => {
    const inputId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;

    return (
        <div className="w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                    {label}
                </label>
            )}

            <textarea
                ref={ref}
                id={inputId}
                rows={rows}
                className={`
                    w-full
                    bg-slate-800
                    border border-slate-700
                    rounded-xl
                    text-white
                    placeholder-slate-500
                    transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                    disabled:opacity-50 disabled:cursor-not-allowed
                    resize-none
                    ${sizeStyles[inputSize]}
                    ${error ? 'border-rose-500 focus:ring-rose-500' : ''}
                    ${className}
                `}
                {...props}
            />

            {error && (
                <p className="mt-1.5 text-sm text-rose-400">{error}</p>
            )}

            {hint && !error && (
                <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
            )}
        </div>
    );
});

Textarea.displayName = 'Textarea';

export default Input;
