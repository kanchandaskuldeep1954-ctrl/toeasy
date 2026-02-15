import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Shield, Trash2, MoreVertical, Loader2, Mail, Calendar, CheckCircle, Search, Filter } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { InviteModal } from './InviteModal';
import { useWorkspaceRole } from '../../hooks/useWorkspaceRole';
import { Card, Badge, Button, Input } from '../UI';

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
    const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const { isAdmin } = useWorkspaceRole();

    const fetchMembers = async () => {
        try {
            const response = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/api/workspaces/${workspaceId}/members`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            setMembers(response.data);
            setFilteredMembers(response.data);
        } catch (err) {
            console.error('Failed to fetch members:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (workspaceId) {
            fetchMembers();
        }
    }, [workspaceId]);

    useEffect(() => {
        let result = members;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(m =>
                m.full_name?.toLowerCase().includes(query) ||
                m.email.toLowerCase().includes(query)
            );
        }
        if (roleFilter !== 'all') {
            result = result.filter(m => m.role === roleFilter);
        }
        setFilteredMembers(result);
    }, [searchQuery, roleFilter, members]);

    const handleRemoveMember = async (userId: number) => {
        if (!confirm('Are you sure you want to remove this member?')) return;
        try {
            // Optimistic update
            setMembers(prev => prev.filter(m => m.id !== userId));
            await axios.delete(
                `${import.meta.env.VITE_BACKEND_URL}/api/workspaces/${workspaceId}/members/${userId}`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
        } catch (err) {
            alert('Failed to remove member');
            fetchMembers(); // Revert on error
        }
    };

    const handleChangeRole = async (userId: number, newRole: string) => {
        try {
            // Optimistic update
            setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole as any } : m));
            await axios.put(
                `${import.meta.env.VITE_BACKEND_URL}/api/workspaces/${workspaceId}/members/${userId}`,
                { role: newRole },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
        } catch (err) {
            alert('Failed to update role');
            fetchMembers();
        }
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
            <p className="text-slate-500 font-medium">Loading your team...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <select
                        className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg py-2 pl-3 pr-8 text-sm focus:ring-2 focus:ring-indigo-500"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="all">All Roles</option>
                        <option value="admin">Admins</option>
                        <option value="editor">Editors</option>
                        <option value="viewer">Viewers</option>
                    </select>

                    {isAdmin && (
                        <Button
                            onClick={() => setIsInviteOpen(true)}
                            leftIcon={<Mail className="w-4 h-4" />}
                            className="whitespace-nowrap"
                        >
                            Invite Member
                        </Button>
                    )}
                </div>
            </div>

            {/* Members Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                    {filteredMembers.map((member) => (
                        <motion.div
                            key={member.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                        >
                            <Card className="relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
                                <div className="absolute top-0 right-0 p-4">
                                    <Badge
                                        variant={member.role === 'admin' ? 'warning' : member.role === 'editor' ? 'info' : 'default'}
                                        size="sm"
                                        className="uppercase tracking-wider font-bold"
                                    >
                                        {member.role}
                                    </Badge>
                                </div>

                                <div className="p-6">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-500/20">
                                            {member.full_name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]" title={member.full_name}>
                                                {member.full_name || 'Unnamed User'}
                                            </h3>
                                            <p className="text-sm text-slate-500 truncate max-w-[160px]" title={member.email}>
                                                {member.email}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-6 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                                        <Calendar className="w-3 h-3" />
                                        <span>Joined {new Date(member.joined_at).toLocaleDateString()}</span>
                                    </div>

                                    {/* Action Footer */}
                                    {isAdmin && (
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <Menu as="div" className="relative w-full">
                                                <Menu.Button className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                                    Manage Access
                                                    <MoreVertical className="w-3 h-3" />
                                                </Menu.Button>
                                                <Transition
                                                    enter="transition duration-100 ease-out"
                                                    enterFrom="transform scale-95 opacity-0"
                                                    enterTo="transform scale-100 opacity-100"
                                                    leave="transition duration-75 ease-out"
                                                    leaveFrom="transform scale-100 opacity-100"
                                                    leaveTo="transform scale-95 opacity-0"
                                                >
                                                    <Menu.Items className="absolute bottom-full left-0 mb-2 w-full origin-bottom-left bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700 rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                                        <div className="px-1 py-1">
                                                            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Role</div>
                                                            {['admin', 'editor', 'viewer'].map((role) => (
                                                                <Menu.Item key={role}>
                                                                    {({ active }) => (
                                                                        <button
                                                                            onClick={() => handleChangeRole(member.id, role)}
                                                                            disabled={member.role === role}
                                                                            className={`${active ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'} ${member.role === role ? 'opacity-50 cursor-default' : ''} group flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm capitalize`}
                                                                        >
                                                                            {role}
                                                                            {member.role === role && <CheckCircle className="w-4 h-4" />}
                                                                        </button>
                                                                    )}
                                                                </Menu.Item>
                                                            ))}
                                                        </div>
                                                        <div className="px-1 py-1">
                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <button
                                                                        onClick={() => handleRemoveMember(member.id)}
                                                                        className={`${active ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'text-rose-600 dark:text-rose-400'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                                    >
                                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                                        Remove from Team
                                                                    </button>
                                                                )}
                                                            </Menu.Item>
                                                        </div>
                                                    </Menu.Items>
                                                </Transition>
                                            </Menu>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {filteredMembers.length === 0 && (
                    <div className="col-span-full py-12 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">No members found</h3>
                        <p className="text-slate-500">Try adjusting your search or filters.</p>
                        <Button
                            variant="link"
                            onClick={() => { setSearchQuery(''); setRoleFilter('all'); }}
                            className="mt-2 text-indigo-500"
                        >
                            Clear Filters
                        </Button>
                    </div>
                )}
            </div>

            <InviteModal
                isOpen={isInviteOpen}
                onClose={() => setIsInviteOpen(false)}
                workspaceId={workspaceId}
            />
        </div>
    );
};
