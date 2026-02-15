import React, { useState } from 'react';
import { Modal } from '../Common/Modal';
import { Mail, Check, AlertCircle, Copy, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, workspaceId }) => {
    const { user } = useAuth();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [inviteLink, setInviteLink] = useState<string | null>(null);

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/invites`,
                { workspaceId, email, role },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );

            setSuccess(`Invite sent to ${email}`);
            setInviteLink(`${window.location.origin}/signup?invite=${response.data.token}`);
            setEmail('');
        } catch (err: any) {
            console.error('Failed to send invite:', err);
            setError(err.response?.data?.error || 'Failed to send invite');
        } finally {
            setIsLoading(false);
        }
    };

    const copyLink = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            // Could show toast here
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Invite Team Member">
            <div className="space-y-6">

                {/* Email Form */}
                <form onSubmit={handleSendInvite} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Email Address
                        </label>
                        <div className="relative">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="colleague@company.com"
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                required
                            />
                            <Mail className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Role
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setRole('viewer')}
                                className={`p-3 rounded-xl border text-left transition-all ${role === 'viewer'
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-500'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                    }`}
                            >
                                <div className="font-semibold text-sm text-slate-900 dark:text-white mb-0.5">Viewer</div>
                                <div className="text-xs text-slate-500">Can view dashboards and run existing queries.</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setRole('editor')}
                                className={`p-3 rounded-xl border text-left transition-all ${role === 'editor'
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-500'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                    }`}
                            >
                                <div className="font-semibold text-sm text-slate-900 dark:text-white mb-0.5">Editor</div>
                                <div className="text-xs text-slate-500">Can create datasets, edit dashboards, and invite others.</div>
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !email}
                        className="w-full flex items-center justify-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Invite'}
                    </button>
                </form>

                {/* Feedback Messages */}
                {error && (
                    <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-3 rounded-lg flex items-start gap-2 text-sm">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg flex items-start gap-2 text-sm">
                        <Check className="w-5 h-5 flex-shrink-0" />
                        <span>{success}</span>
                    </div>
                )}

                {/* Invite Link Copy (Fallback) */}
                {inviteLink && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Or copy invite link
                        </label>
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={inviteLink}
                                className="flex-1 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
                            />
                            <button
                                onClick={copyLink}
                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all"
                                title="Copy Link"
                            >
                                <Copy className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Share this link with your team member manually if they don't receive the email.
                        </p>
                    </div>
                )}

            </div>
        </Modal>
    );
};
