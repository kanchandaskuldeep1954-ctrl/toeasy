import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import axios from 'axios';
import { Check, ChevronRight, Loader2, Users, Briefcase, Rocket } from 'lucide-react';

export const OnboardingWizard = () => {
    const { user, refreshProfile } = useAuth();
    const { addWorkspace } = useWorkspace();
    const [isOpen, setIsOpen] = useState(true);
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form States
    const [workspaceName, setWorkspaceName] = useState('');
    const [inviteEmails, setInviteEmails] = useState('');

    if (!user || user.onboarding_completed) return null;

    const handleCreateWorkspace = async () => {
        if (!workspaceName.trim()) return;
        setIsLoading(true);
        setError(null);
        try {
            await addWorkspace({ name: workspaceName });
            setStep(2);
        } catch (err: any) {
            setError(err.message || 'Failed to create workspace');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInviteMembers = async () => {
        // Skipping empty invites is allowed
        if (inviteEmails.trim()) {
            setIsLoading(true);
            setError(null);
            try {
                const emails = inviteEmails.split(',').map(e => e.trim()).filter(Boolean);
                await axios.post(
                    `${import.meta.env.VITE_BACKEND_URL}/api/invites/send`,
                    { emails, workspaceId: localStorage.getItem('active_workspace_id') || undefined }, // Backend should handle current workspace context or we pass it
                    { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                );
            } catch (err: any) {
                console.error('Failed to send invites:', err);
                // Don't block onboarding for invite failure, just log it
            } finally {
                setIsLoading(false);
            }
        }
        setStep(3);
    };

    const handleComplete = async () => {
        setIsLoading(true);
        try {
            await axios.put(
                `${import.meta.env.VITE_BACKEND_URL}/api/users/me`,
                { onboarding_completed: true },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            await refreshProfile();
            setIsOpen(false);
        } catch (err) {
            console.error('Failed to complete onboarding:', err);
            setError('Failed to finish setup. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={() => { }}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-left align-middle shadow-2xl transition-all">

                                {/* Progress Bar */}
                                <div className="flex items-center justify-center mb-8 gap-2">
                                    <div className={`h-2 rounded-full w-12 transition-colors ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                    <div className={`h-2 rounded-full w-12 transition-colors ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                    <div className={`h-2 rounded-full w-12 transition-colors ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                </div>

                                {step === 1 && (
                                    <div className="space-y-6">
                                        <div className="text-center">
                                            <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
                                                <Briefcase className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <Dialog.Title as="h3" className="text-2xl font-bold leading-6 text-slate-900 dark:text-white">
                                                Let's set up your workspace
                                            </Dialog.Title>
                                            <p className="mt-2 text-sm text-slate-500">
                                                Workspaces are where your team collaborates on data, reports, and dashboards.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Workspace Name
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                                                placeholder="e.g. Acme Analytics, Marketing Team"
                                                value={workspaceName}
                                                onChange={(e) => setWorkspaceName(e.target.value)}
                                                autoFocus
                                            />
                                        </div>

                                        <div className="mt-6 flex justify-end">
                                            <button
                                                onClick={handleCreateWorkspace}
                                                disabled={!workspaceName.trim() || isLoading}
                                                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
                                            >
                                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Workspace'}
                                                {!isLoading && <ChevronRight className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-6">
                                        <div className="text-center">
                                            <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
                                                <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <Dialog.Title as="h3" className="text-2xl font-bold leading-6 text-slate-900 dark:text-white">
                                                Invite your team
                                            </Dialog.Title>
                                            <p className="mt-2 text-sm text-slate-500">
                                                Data is better with friends. Invite colleagues to collaborate.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Email Addresses
                                            </label>
                                            <textarea
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all min-h-[100px]"
                                                placeholder="colleague@company.com, boss@company.com"
                                                value={inviteEmails}
                                                onChange={(e) => setInviteEmails(e.target.value)}
                                            />
                                            <p className="text-xs text-slate-500 mt-2">Separate multiple emails with commas.</p>
                                        </div>

                                        <div className="mt-6 flex justify-between">
                                            <button
                                                onClick={() => setStep(3)} // Skip
                                                className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium"
                                            >
                                                Skip for now
                                            </button>
                                            <button
                                                onClick={handleInviteMembers}
                                                disabled={isLoading}
                                                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
                                            >
                                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Invites'}
                                                {!isLoading && <ChevronRight className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-6 text-center">
                                        <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-500">
                                            <Rocket className="w-10 h-10 text-green-600 dark:text-green-400" />
                                        </div>
                                        <Dialog.Title as="h3" className="text-2xl font-bold leading-6 text-slate-900 dark:text-white">
                                            You're all set!
                                        </Dialog.Title>
                                        <p className="text-slate-500">
                                            Your workspace is ready. Start by connecting a data source or exploring the dashboard.
                                        </p>

                                        <div className="mt-8">
                                            <button
                                                onClick={handleComplete}
                                                disabled={isLoading}
                                                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all shadow-xl"
                                            >
                                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Get Started'}
                                                {!isLoading && <Check className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg text-center">
                                        {error}
                                    </div>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};
