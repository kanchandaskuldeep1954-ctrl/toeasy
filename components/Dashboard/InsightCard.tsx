
import React from 'react';

interface InsightCardProps {
    title?: string;
    content: string;
    type?: 'info' | 'warning' | 'success' | 'anomaly' | 'trend';
    recommendation?: string;
    className?: string;
}

export const InsightCard: React.FC<InsightCardProps> = ({ title, content, type = 'info', recommendation, className = '' }) => {
    let bgColors = 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800';
    let icon = '💡';
    let iconBg = 'bg-slate-100 dark:bg-slate-800 text-slate-500';

    if (type === 'anomaly') {
        bgColors = 'bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20 border-rose-200 dark:border-rose-900/30';
        icon = '⚡';
        iconBg = 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400';
    } else if (type === 'success' || type === 'trend') {
        bgColors = 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-900/30';
        icon = '📈';
        iconBg = 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
    } else if (type === 'warning') {
        bgColors = 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30';
        icon = '⚠️';
        iconBg = 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
    }

    return (
        <div className={`p-4 rounded-2xl border shadow-sm ${bgColors} ${className}`}>
            <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center text-lg shrink-0`}>
                    {icon}
                </div>
                <div className="flex-1">
                    {title && (
                        <h4 className="font-bold text-xs uppercase tracking-wider opacity-70 mb-1">{title}</h4>
                    )}
                    <p className="text-sm font-medium leading-relaxed dark:text-slate-200">{content}</p>

                    {recommendation && (
                        <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Recommendation</p>
                            <p className="text-xs italic opacity-80">{recommendation}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
