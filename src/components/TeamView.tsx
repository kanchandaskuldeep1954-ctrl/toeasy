import React from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { TeamMembers } from './Workspaces/TeamMembers';
import { Users } from 'lucide-react';

const TeamView: React.FC = () => {
    const { activeWorkspace, isLoading } = useWorkspace();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!activeWorkspace) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 p-8 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Workspace Selected</h3>
                <p>Please select a workspace to manage team members.</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6 md:p-12">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Team Management</h1>
                <p className="text-slate-600 dark:text-slate-400">
                    Manage members and permissions for <span className="font-bold text-indigo-600 dark:text-indigo-400">{activeWorkspace.name}</span>
                </p>
            </div>

            <TeamMembers workspaceId={String(activeWorkspace.id)} />
        </div>
    );
};

export default TeamView;
