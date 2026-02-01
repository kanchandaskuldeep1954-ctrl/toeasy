import React from 'react';
import { User } from 'lucide-react';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
    src?: string;
    alt?: string;
    name?: string;
    size?: AvatarSize;
    status?: 'online' | 'offline' | 'busy' | 'away';
    className?: string;
}

interface AvatarGroupProps {
    children: React.ReactNode;
    max?: number;
    size?: AvatarSize;
}

const sizeStyles: Record<AvatarSize, { container: string; text: string; status: string }> = {
    xs: { container: 'w-6 h-6', text: 'text-xs', status: 'w-2 h-2' },
    sm: { container: 'w-8 h-8', text: 'text-sm', status: 'w-2.5 h-2.5' },
    md: { container: 'w-10 h-10', text: 'text-base', status: 'w-3 h-3' },
    lg: { container: 'w-12 h-12', text: 'text-lg', status: 'w-3.5 h-3.5' },
    xl: { container: 'w-16 h-16', text: 'text-xl', status: 'w-4 h-4' }
};

const statusColors: Record<NonNullable<AvatarProps['status']>, string> = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-500',
    busy: 'bg-rose-500',
    away: 'bg-amber-500'
};

// Generate consistent color from name
const getColorFromName = (name: string): string => {
    const colors = [
        'bg-indigo-500',
        'bg-purple-500',
        'bg-pink-500',
        'bg-rose-500',
        'bg-orange-500',
        'bg-amber-500',
        'bg-emerald-500',
        'bg-teal-500',
        'bg-cyan-500',
        'bg-sky-500'
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

export const Avatar: React.FC<AvatarProps> & { Group: React.FC<AvatarGroupProps> } = ({
    src,
    alt,
    name,
    size = 'md',
    status,
    className = ''
}) => {
    const styles = sizeStyles[size];

    return (
        <div className={`relative inline-block ${className}`}>
            <div
                className={`
                    ${styles.container}
                    rounded-full
                    overflow-hidden
                    flex items-center justify-center
                    ring-2 ring-slate-900
                    ${!src && name ? getColorFromName(name) : 'bg-slate-700'}
                `}
            >
                {src ? (
                    <img
                        src={src}
                        alt={alt || name || 'Avatar'}
                        className="w-full h-full object-cover"
                    />
                ) : name ? (
                    <span className={`font-semibold text-white ${styles.text}`}>
                        {getInitials(name)}
                    </span>
                ) : (
                    <User className="w-1/2 h-1/2 text-slate-400" />
                )}
            </div>

            {status && (
                <span
                    className={`
                        absolute bottom-0 right-0
                        ${styles.status}
                        rounded-full
                        ring-2 ring-slate-900
                        ${statusColors[status]}
                    `}
                />
            )}
        </div>
    );
};

Avatar.Group = ({ children, max = 4, size = 'md' }) => {
    const childrenArray = React.Children.toArray(children);
    const visibleChildren = childrenArray.slice(0, max);
    const hiddenCount = childrenArray.length - max;

    return (
        <div className="flex -space-x-2">
            {visibleChildren.map((child, index) => (
                <div key={index} className="relative" style={{ zIndex: max - index }}>
                    {React.isValidElement(child)
                        ? React.cloneElement(child as React.ReactElement<AvatarProps>, { size })
                        : child
                    }
                </div>
            ))}

            {hiddenCount > 0 && (
                <div
                    className={`
                        ${sizeStyles[size].container}
                        rounded-full
                        bg-slate-700
                        flex items-center justify-center
                        ring-2 ring-slate-900
                        ${sizeStyles[size].text}
                        font-medium text-slate-300
                    `}
                >
                    +{hiddenCount}
                </div>
            )}
        </div>
    );
};

Avatar.Group.displayName = 'Avatar.Group';

export default Avatar;
