import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: `
        bg-blue-600 
        hover:bg-blue-700 
        text-white 
        shadow-lg shadow-blue-500/30 
        border-transparent
    `,
    secondary: `
        bg-slate-800 
        hover:bg-slate-700 
        text-slate-100 
        border-slate-700
    `,
    ghost: `
        bg-transparent 
        hover:bg-white/5 
        text-slate-300 
        hover:text-white 
        border-transparent
    `,
    danger: `
        bg-rose-600 
        hover:bg-rose-700 
        text-white 
        shadow-lg shadow-rose-500/30 
        border-transparent
    `,
    success: `
        bg-emerald-600 
        hover:bg-emerald-700 
        text-white 
        shadow-lg shadow-emerald-500/30 
        border-transparent
    `
};

const sizeStyles: Record<ButtonSize, string> = {
    xs: 'px-2 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
    xl: 'px-6 py-3 text-lg gap-2.5'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled,
    className = '',
    children,
    ...props
}, ref) => {
    const isDisabled = disabled || loading;

    return (
        <button
            ref={ref}
            disabled={isDisabled}
            className={`
                inline-flex items-center justify-center
                font-semibold
                rounded-xl
                border
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900
                disabled:opacity-50 disabled:cursor-not-allowed
                ${variantStyles[variant]}
                ${sizeStyles[size]}
                ${fullWidth ? 'w-full' : ''}
                ${className}
            `}
            {...props}
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : leftIcon ? (
                <span className="flex-shrink-0">{leftIcon}</span>
            ) : null}

            {children}

            {!loading && rightIcon && (
                <span className="flex-shrink-0">{rightIcon}</span>
            )}
        </button>
    );
});

Button.displayName = 'Button';

export default Button;
