import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Shield, Trash2, MoreVertical, Loader2 } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { InviteModal } from './InviteModal';
import { useWorkspaceRole } from '../../hooks/useWorkspaceRole';

interface Member {
    id: number;
    full_name: string;
    email: string;
    role: 'admin' | 'editor' | 'viewer';
    joined_at: string;
    avatar_url?: string;
}

interface TeamMembersProps {
    workspaceId: string;
}

export const TeamMembers: React.FC<TeamMembersProps> = ({ workspaceId }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { isAdmin } = useWorkspaceRole();

    const fetchMembers = async () => {
        try {
            const response = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/api/workspaces/${workspaceId}/members`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            setMembers(response.data);
        } catch (err) {
            console.error('Failed to fetch members:', err);
            setError('Failed to load team members');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (workspaceId) {
            fetchMembers();
        }
    }, [workspaceId]);

    const handleRemoveMember = async (userId: number) => {
        if (!confirm('Are you sure you want to remove this member?')) return;
        try {
            await axios.delete(
                `${import.meta.env.VITE_BACKEND_URL}/api/workspaces/${workspaceId}/members/${userId}`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            setMembers(members.filter(m => m.id !== userId));
        } catch (err) {
            alert('Failed to remove member');
        }
    };

    const handleChangeRole = async (userId: number, newRole: string) => {
        try {
            await axios.put(
                `${import.meta.env.VITE_BACKEND_URL}/api/workspaces/${workspaceId}/members/${userId}`,
                { role: newRole },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            setMembers(members.map(m => m.id === userId ? { ...m, role: newRole as any } : m));
        } catch (err) {
            alert('Failed to update role');
        }
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Team Members</h2>
                    <p className="text-sm text-slate-500">Manage access to this workspace.</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setIsInviteOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                    >
                        Invite Member
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                {member.full_name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                            </div>
                            <div>
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    {member.full_name || 'Unnamed User'}
                                    {member.role === 'admin' && (
                                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] uppercase font-bold tracking-wider rounded">
                                            Admin
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-500">{member.email}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{member.role}</span>

                            {isAdmin && (
                                <Menu as="div" className="relative">
                                    <Menu.Button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                                        <MoreVertical className="w-4 h-4" />
                                    </Menu.Button>
                                    <Transition
                                        enter="transition duration-100 ease-out"
                                        enterFrom="transform scale-95 opacity-0"
                                        enterTo="transform scale-100 opacity-100"
                                        leave="transition duration-75 ease-out"
                                        leaveFrom="transform scale-100 opacity-100"
                                        leaveTo="transform scale-95 opacity-0"
                                    >
                                        <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700 rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                            <div className="px-1 py-1">
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={() => handleChangeRole(member.id, 'admin')}
                                                            className={`${active ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                        >
                                                            Make Admin
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={() => handleChangeRole(member.id, 'editor')}
                                                            className={`${active ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                        >
                                                            Make Editor
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={() => handleChangeRole(member.id, 'viewer')}
                                                            className={`${active ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                        >
                                                            Make Viewer
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            </div>
                                            <div className="px-1 py-1">
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={() => handleRemoveMember(member.id)}
                                                            className={`${active ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'text-rose-600 dark:text-rose-400'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Remove Member
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            </div>
                                        </Menu.Items>
                                    </Transition>
                                </Menu>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <InviteModal
                isOpen={isInviteOpen}
                onClose={() => setIsInviteOpen(false)}
                workspaceId={workspaceId}
            />
        </div>
    );
};
