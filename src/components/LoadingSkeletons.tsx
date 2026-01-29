import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
    animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Base skeleton component with configurable shape and animation.
 */
export function Skeleton({
    className = '',
    variant = 'rectangular',
    width,
    height,
    animation = 'pulse'
}: SkeletonProps) {
    const baseClasses = 'bg-slate-200 dark:bg-slate-800';
    const animationClass = animation === 'pulse' ? 'animate-pulse' : animation === 'wave' ? 'animate-shimmer' : '';

    const variantClasses = {
        text: 'rounded h-4',
        circular: 'rounded-full',
        rectangular: '',
        rounded: 'rounded-xl',
    };

    const style: React.CSSProperties = {};
    if (width) style.width = typeof width === 'number' ? `${width}px` : width;
    if (height) style.height = typeof height === 'number' ? `${height}px` : height;

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${animationClass} ${className}`}
            style={style}
        />
    );
}

/**
 * Loading skeleton for KPI cards
 */
export function KPICardSkeleton() {
    return (
        <div className="min-w-[180px] flex-1 bg-white dark:bg-slate-900 rounded-[24px] p-6 border border-slate-100 dark:border-slate-800">
            <Skeleton variant="text" width="60%" height={12} className="mb-4" />
            <Skeleton variant="text" width="80%" height={32} className="mb-2" />
            <Skeleton variant="text" width="40%" height={10} />
        </div>
    );
}

/**
 * Loading skeleton for chart cards
 */
export function ChartCardSkeleton({ isWide = false }: { isWide?: boolean }) {
    return (
        <div className={`bg-white dark:bg-slate-900 p-8 rounded-[32px] min-h-[480px] flex flex-col border border-slate-200 dark:border-white/5 ${isWide ? 'md:col-span-2' : ''}`}>
            <div className="flex justify-between items-start mb-8">
                <div className="flex-1">
                    <Skeleton variant="text" width="50%" height={16} className="mb-2" />
                    <Skeleton variant="text" width="70%" height={12} />
                </div>
                <Skeleton variant="circular" width={32} height={32} />
            </div>
            <div className="flex-1 flex items-end gap-2 pt-8">
                {[40, 65, 45, 80, 55, 70, 35, 60, 75, 50].map((h, i) => (
                    <Skeleton key={i} variant="rectangular" className="flex-1 rounded-t-lg" height={`${h}%`} />
                ))}
            </div>
        </div>
    );
}

/**
 * Loading skeleton for table rows
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <tr className="border-b border-slate-100 dark:border-slate-800">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="py-4 px-4">
                    <Skeleton variant="text" width={`${60 + Math.random() * 30}%`} height={14} />
                </td>
            ))}
        </tr>
    );
}

/**
 * Loading skeleton for dashboard grid
 */
export function DashboardGridSkeleton() {
    return (
        <div className="p-6 md:p-10 max-w-[1800px] mx-auto space-y-10">
            {/* Health bar skeleton */}
            <Skeleton variant="rounded" width="100%" height={40} />

            {/* KPI strip skeleton */}
            <div className="flex flex-wrap gap-4">
                {[1, 2, 3, 4].map(i => <KPICardSkeleton key={i} />)}
            </div>

            {/* Chart grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
                <ChartCardSkeleton isWide />
                <ChartCardSkeleton />
                <ChartCardSkeleton />
                <ChartCardSkeleton />
                <ChartCardSkeleton isWide />
            </div>
        </div>
    );
}

/**
 * Loading skeleton for list items
 */
export function ListItemSkeleton() {
    return (
        <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
            <Skeleton variant="circular" width={48} height={48} />
            <div className="flex-1">
                <Skeleton variant="text" width="60%" height={16} className="mb-2" />
                <Skeleton variant="text" width="40%" height={12} />
            </div>
            <Skeleton variant="rounded" width={80} height={32} />
        </div>
    );
}

/**
 * Loading skeleton for library cards
 */
export function LibraryCardSkeleton() {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <Skeleton variant="rectangular" width="100%" height={120} />
            <div className="p-4">
                <Skeleton variant="text" width="70%" height={18} className="mb-2" />
                <Skeleton variant="text" width="50%" height={12} className="mb-4" />
                <div className="flex justify-between">
                    <Skeleton variant="text" width="30%" height={10} />
                    <Skeleton variant="rounded" width={60} height={24} />
                </div>
            </div>
        </div>
    );
}

export default Skeleton;
