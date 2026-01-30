import React from 'react';

interface EmptyChartStateProps {
    height: number;
    message?: string;
    icon?: React.ReactNode;
}

export const EmptyChartState: React.FC<EmptyChartStateProps> = ({
    height,
    message = "No data available to visualize",
    icon
}) => {
    return (
        <div
            className="w-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800"
            style={{ height }}
        >
            <div className="text-slate-300 dark:text-slate-600 mb-3">
                {icon || (
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                    </svg>
                )}
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {message}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Try adjusting your filters or data source
            </p>
        </div>
    );
};
