import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Check, ChevronRight, Loader2, Rocket, Users, Briefcase } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { invitesAPI, userAPI, workspaceAPI } from '../../services/api';

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    updateWorkspace,
    setWorkspaces
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(true);
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');

  const hasWorkspace = workspaces.length > 0;
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => String(workspace.id) === String(selectedWorkspaceId)) || null,
    [workspaces, selectedWorkspaceId]
  );

  useEffect(() => {
    if (!user || user.onboarding_completed) return;
    const urlWorkspace = searchParams.get('workspace');
    const preferredWorkspaceId = urlWorkspace || (activeWorkspace?.id ? String(activeWorkspace.id) : '');
    const fallbackWorkspace = workspaces[0] ? String(workspaces[0].id) : '';
    const resolvedWorkspaceId = preferredWorkspaceId || fallbackWorkspace;
    if (resolvedWorkspaceId && resolvedWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(resolvedWorkspaceId);
    }
  }, [user, workspaces, activeWorkspace, selectedWorkspaceId, searchParams]);

  useEffect(() => {
    if (!selectedWorkspace) return;
    if (!workspaceName) {
      setWorkspaceName(selectedWorkspace.name || '');
    }
  }, [selectedWorkspace, workspaceName]);

  if (!user || user.onboarding_completed) return null;

  const handleWorkspaceSetup = async () => {
    setError(null);

    if (hasWorkspace && selectedWorkspace) {
      setIsLoading(true);
      try {
        if (!activeWorkspace || activeWorkspace.id !== selectedWorkspace.id) {
          setActiveWorkspace(selectedWorkspace);
        }
        if (workspaceName.trim() && workspaceName.trim() !== selectedWorkspace.name) {
          await updateWorkspace(selectedWorkspace.id, { name: workspaceName.trim() });
        }
        setStep(2);
      } catch (err: any) {
        setError(err.message || 'Failed to prepare workspace');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!workspaceName.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsLoading(true);
    try {
      const createdResponse = await workspaceAPI.create({ name: workspaceName.trim() });
      const createdWorkspace = createdResponse.data;
      if (createdWorkspace) {
        setWorkspaces([createdWorkspace, ...workspaces]);
        setActiveWorkspace(createdWorkspace);
        setSelectedWorkspaceId(String(createdWorkspace.id));
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const resolveInviteWorkspaceId = () => {
    if (activeWorkspace?.id) return String(activeWorkspace.id);
    if (selectedWorkspaceId) return selectedWorkspaceId;
    const savedWorkspace = localStorage.getItem('active_workspace');
    if (savedWorkspace) {
      try {
        const parsed = JSON.parse(savedWorkspace);
        return parsed?.id ? String(parsed.id) : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  const handleInviteMembers = async () => {
    setError(null);
    if (!inviteEmails.trim()) {
      setStep(3);
      return;
    }

    setIsLoading(true);
    try {
      const workspaceId = resolveInviteWorkspaceId();
      const emails = inviteEmails
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (emails.length) {
        await invitesAPI.send(emails, workspaceId);
      }
      setStep(3);
    } catch (err) {
      // Do not block onboarding due to invite failures.
      console.error('Failed to send invites:', err);
      setStep(3);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await userAPI.updateProfile({ onboarding_completed: true });
      await refreshProfile();
      setIsOpen(false);
      const workspaceQuery = selectedWorkspaceId ? `?workspace=${selectedWorkspaceId}` : '';
      navigate(`/app/studio${workspaceQuery}`, { replace: true });
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setError('Failed to finish setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
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
                        Set your primary workspace
                      </Dialog.Title>
                      <p className="mt-2 text-sm text-slate-500">
                        Choose and rename your workspace before entering Decision Room.
                      </p>
                    </div>

                    {hasWorkspace ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Workspace
                          </label>
                          <select
                            value={selectedWorkspaceId}
                            onChange={(event) => {
                              const nextId = event.target.value;
                              setSelectedWorkspaceId(nextId);
                              const nextWorkspace = workspaces.find((workspace) => String(workspace.id) === nextId);
                              if (nextWorkspace) {
                                setWorkspaceName(nextWorkspace.name || '');
                                setActiveWorkspace(nextWorkspace);
                              }
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                          >
                            {workspaces.map((workspace) => (
                              <option key={workspace.id} value={workspace.id}>
                                {workspace.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Workspace Name
                          </label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                            value={workspaceName}
                            onChange={(event) => setWorkspaceName(event.target.value)}
                            placeholder="e.g. RevOps Decision Team"
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Workspace Name
                        </label>
                        <input
                          type="text"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                          placeholder="e.g. RevOps Decision Team"
                          value={workspaceName}
                          onChange={(event) => setWorkspaceName(event.target.value)}
                          autoFocus
                        />
                      </div>
                    )}

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={handleWorkspaceSetup}
                        disabled={isLoading || !workspaceName.trim()}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
                      >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
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
                        Invite collaborators
                      </Dialog.Title>
                      <p className="mt-2 text-sm text-slate-500">
                        Optional. Invite teammates now or skip and do it later.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Email Addresses
                      </label>
                      <textarea
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all min-h-[100px]"
                        placeholder="ops-lead@company.com, sales-manager@company.com"
                        value={inviteEmails}
                        onChange={(event) => setInviteEmails(event.target.value)}
                      />
                      <p className="text-xs text-slate-500 mt-2">Separate multiple emails with commas.</p>
                    </div>

                    <div className="mt-6 flex justify-between">
                      <button
                        onClick={() => setStep(3)}
                        className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium"
                      >
                        Skip for now
                      </button>
                      <button
                        onClick={handleInviteMembers}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
                      >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
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
                      Workspace ready
                    </Dialog.Title>
                    <p className="text-slate-500">
                      Enter Decision Room Studio and start from data to decision with evidence.
                    </p>

                    <div className="mt-8">
                      <button
                        onClick={handleComplete}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all shadow-xl"
                      >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Open Studio'}
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

