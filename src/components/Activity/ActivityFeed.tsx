import React, { useEffect } from 'react';
import { useActivity, Activity } from '../../context/ActivityContext';
// import { formatDistanceToNow } from 'date-fns'; 
import { Loader2, RotateCcw, Activity as ActivityIcon } from 'lucide-react';

export const ActivityFeed: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
    const { activities, loadActivities, isLoading, refreshActivities } = useActivity();

    useEffect(() => {
        if (workspaceId) {
            loadActivities(workspaceId);
        }
    }, [workspaceId, loadActivities]);

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-80">
            <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <ActivityIcon className="w-4 h-4" />
                    Activity Log
                </h3>
                <button
                    onClick={() => refreshActivities()}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Refresh Activity"
                >
                    <RotateCcw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!isLoading && activities.length === 0 && (
                    <div className="text-center text-gray-400 py-8 text-sm">
                        No activity recorded yet
                    </div>
                )}

                {activities.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} />
                ))}
            </div>
        </div>
    );
};

const ActivityItem: React.FC<{ activity: Activity }> = ({ activity }) => {
    const timeString = new Date(activity.created_at).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="flex gap-3 text-sm group">
            <div className="mt-1.5 flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-50 group-hover:ring-indigo-100 transition-all"></div>
            </div>
            <div>
                <p className="font-medium text-gray-900 leading-snug">{activity.action_detail}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span className="font-medium">{activity.user_name || 'User'}</span>
                    <span>•</span>
                    <span>{timeString}</span>
                </div>
                {activity.source_component && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded uppercase tracking-wider font-semibold">
                        {activity.source_component}
                    </span>
                )}
            </div>
        </div>
    );
};
