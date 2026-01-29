import { useMemo } from 'react';

/**
 * Formats a date into a human-readable "time ago" string.
 * Examples: "Just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago"
 */
export function formatTimeAgo(date: Date | string | null | undefined): string {
    if (!date) return 'Never';

    const now = new Date();
    const then = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now.getTime() - then.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
}

/**
 * Hook to get a formatted "last updated" string that updates periodically.
 */
export function useLastUpdated(date: Date | string | null | undefined) {
    return useMemo(() => formatTimeAgo(date), [date]);
}

/**
 * Returns true if data is considered "stale" (older than threshold hours)
 */
export function isDataStale(date: Date | string | null | undefined, hoursThreshold: number = 24): boolean {
    if (!date) return true;
    const then = typeof date === 'string' ? new Date(date) : date;
    const diffMs = new Date().getTime() - then.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > hoursThreshold;
}

/**
 * Component-friendly timestamp display
 */
export interface LastUpdatedDisplayProps {
    date: Date | string | null | undefined;
    prefix?: string;
    className?: string;
    showStaleWarning?: boolean;
    staleThresholdHours?: number;
}

export function LastUpdatedDisplay({
    date,
    prefix = 'Updated',
    className = '',
    showStaleWarning = true,
    staleThresholdHours = 24
}: LastUpdatedDisplayProps) {
    const timeAgo = useLastUpdated(date);
    const stale = isDataStale(date, staleThresholdHours);

    return (
        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${stale && showStaleWarning ? 'text-amber-500' : 'text-slate-400'} ${className}`}>
            {stale && showStaleWarning && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
            {prefix} {timeAgo}
        </span>
    );
}

export default useLastUpdated;
