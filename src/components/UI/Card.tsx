import React, { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
    onClick?: () => void;
    as?: 'div' | 'article' | 'section' | 'button';
}

interface CardHeaderProps {
    children: ReactNode;
    className?: string;
    action?: ReactNode;
}

interface CardTitleProps {
    children: ReactNode;
    className?: string;
}

interface CardDescriptionProps {
    children: ReactNode;
    className?: string;
}

interface CardContentProps {
    children: ReactNode;
    className?: string;
}

interface CardFooterProps {
    children: ReactNode;
    className?: string;
}

const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
};

export const Card: React.FC<CardProps> & {
    Header: React.FC<CardHeaderProps>;
    Title: React.FC<CardTitleProps>;
    Description: React.FC<CardDescriptionProps>;
    Content: React.FC<CardContentProps>;
    Footer: React.FC<CardFooterProps>;
} = ({
    children,
    className = '',
    padding = 'md',
    hover = false,
    onClick,
    as: Component = 'div'
}) => {
        return (
            <Component
                onClick={onClick}
                className={`
                bg-slate-900/80
                border border-slate-800
                rounded-2xl
                backdrop-blur-xl
                transition-all duration-200
                ${hover ? 'hover:border-slate-700 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer' : ''}
                ${onClick ? 'cursor-pointer' : ''}
                ${paddingStyles[padding]}
                ${className}
            `}
            >
                {children}
            </Component>
        );
    };

Card.Header = ({ children, className = '', action }) => (
    <div className={`flex items-start justify-between ${className}`}>
        <div>{children}</div>
        {action && <div>{action}</div>}
    </div>
);

Card.Title = ({ children, className = '' }) => (
    <h3 className={`text-lg font-semibold text-white ${className}`}>
        {children}
    </h3>
);

Card.Description = ({ children, className = '' }) => (
    <p className={`text-sm text-slate-400 mt-1 ${className}`}>
        {children}
    </p>
);

Card.Content = ({ children, className = '' }) => (
    <div className={`mt-4 ${className}`}>
        {children}
    </div>
);

Card.Footer = ({ children, className = '' }) => (
    <div className={`mt-6 pt-4 border-t border-slate-800 flex items-center gap-3 ${className}`}>
        {children}
    </div>
);

Card.Header.displayName = 'Card.Header';
Card.Title.displayName = 'Card.Title';
Card.Description.displayName = 'Card.Description';
Card.Content.displayName = 'Card.Content';
Card.Footer.displayName = 'Card.Footer';

export default Card;
