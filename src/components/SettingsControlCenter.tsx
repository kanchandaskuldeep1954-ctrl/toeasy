import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { PersonaProfile, studioAPI, WorkspacePolicySettings } from '../services/api';

const defaultPolicies: WorkspacePolicySettings = {
  aiAssistiveModeEnabled: true,
  approvalGateEnforced: true,
  autoCreateReportThreads: true,
  slackPublishRequiresReview: true,
  managerExceptionDigestEnabled: true,
  legacySurfacesEnabled: false,
  studioVisualsTabEnabled: true,
  studioCommsTabEnabled: true
};

const SettingsControlCenter: React.FC = () => {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ? String(activeWorkspace.id) : '';
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [profile, setProfile] = useState<PersonaProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    persona: 'analyst' as 'analyst' | 'manager' | 'executive',
    uiMode: 'guided' as 'guided' | 'expert',
    reportStyle: 'concise',
    aiStyle: 'tactical',
    notificationPreferences: {
      inApp: true,
      slack: true,
      email: false,
      dailyDigest: true
    } as Record<string, any>
  });

  const [policies, setPolicies] = useState<WorkspacePolicySettings>(defaultPolicies);

  useEffect(() => {
    const load = async () => {
      if (!workspaceId) return;
      setLoading(true);
      setError('');
      try {
        const [profileRes, policyRes] = await Promise.all([
          studioAPI.getPersonaProfile(workspaceId),
          studioAPI.getWorkspacePolicySettings(workspaceId)
        ]);
        const nextProfile = profileRes.data?.profile || null;
        setProfile(nextProfile);
        setProfileDraft({
          persona: nextProfile?.persona || 'analyst',
          uiMode: nextProfile?.uiMode || 'guided',
          reportStyle: nextProfile?.reportStyle || 'concise',
          aiStyle: nextProfile?.aiStyle || 'tactical',
          notificationPreferences: {
            inApp: Boolean(nextProfile?.notificationPreferences?.inApp ?? true),
            slack: Boolean(nextProfile?.notificationPreferences?.slack ?? true),
            email: Boolean(nextProfile?.notificationPreferences?.email ?? false),
            dailyDigest: Boolean(nextProfile?.notificationPreferences?.dailyDigest ?? true)
          }
        });
        setPolicies({
          ...defaultPolicies,
          ...(policyRes.data?.policies || {})
        });
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workspaceId]);

  const profileDirty = useMemo(() => {
    if (!profile) return true;
    return (
      profile.persona !== profileDraft.persona
      || profile.uiMode !== profileDraft.uiMode
      || profile.reportStyle !== profileDraft.reportStyle
      || profile.aiStyle !== profileDraft.aiStyle
      || JSON.stringify(profile.notificationPreferences || {}) !== JSON.stringify(profileDraft.notificationPreferences || {})
    );
  }, [profile, profileDraft]);

  const saveProfile = async () => {
    if (!workspaceId) return;
    setSavingProfile(true);
    setError('');
    setSuccessMessage('');
    try {
      const result = await studioAPI.updatePersonaProfile(workspaceId, {
        persona: profileDraft.persona,
        uiMode: profileDraft.uiMode,
        reportStyle: profileDraft.reportStyle,
        aiStyle: profileDraft.aiStyle,
        notificationPreferences: profileDraft.notificationPreferences
      });
      const nextProfile = result.data?.profile || profile;
      setProfile(nextProfile);
      setSuccessMessage('Profile preferences updated.');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save profile preferences');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePolicies = async () => {
    if (!workspaceId) return;
    setSavingPolicies(true);
    setError('');
    setSuccessMessage('');
    try {
      const result = await studioAPI.updateWorkspacePolicySettings(workspaceId, policies);
      setPolicies({
        ...defaultPolicies,
        ...(result.data?.policies || {})
      });
      setSuccessMessage('Workspace policies updated.');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save workspace policies');
    } finally {
      setSavingPolicies(false);
    }
  };

  if (!workspaceId) {
    return (
      <div className="min-h-full p-6 md:p-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 p-4 text-sm">
          Select a workspace to configure settings.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-12 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Settings Control Center</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure profile behavior, communication preferences, and workspace execution policies.
        </p>
      </header>

      {(error || successMessage) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          {error || successMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500">
          Loading settings...
        </div>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Profile Preferences</h2>
                <p className="text-xs text-slate-500 mt-1">Personalize how the app guides and communicates with you.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-500">
                  Persona
                  <select
                    value={profileDraft.persona}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, persona: event.target.value as any }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="analyst">Analyst</option>
                    <option value="manager">Manager</option>
                    <option value="executive">Executive</option>
                  </select>
                </label>

                <label className="text-xs text-slate-500">
                  UI Mode
                  <select
                    value={profileDraft.uiMode}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, uiMode: event.target.value as any }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="guided">Guided</option>
                    <option value="expert">Expert</option>
                  </select>
                </label>

                <label className="text-xs text-slate-500">
                  Report Style
                  <input
                    value={profileDraft.reportStyle}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, reportStyle: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    placeholder="concise, deep, tactical..."
                  />
                </label>

                <label className="text-xs text-slate-500">
                  AI Style
                  <input
                    value={profileDraft.aiStyle}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, aiStyle: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    placeholder="tactical, strategic..."
                  />
                </label>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Notification Preferences</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { key: 'inApp', label: 'In-app alerts' },
                    { key: 'slack', label: 'Slack updates' },
                    { key: 'email', label: 'Email notifications' },
                    { key: 'dailyDigest', label: 'Daily digest' }
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(profileDraft.notificationPreferences?.[item.key])}
                        onChange={(event) => setProfileDraft((prev) => ({
                          ...prev,
                          notificationPreferences: {
                            ...prev.notificationPreferences,
                            [item.key]: event.target.checked
                          }
                        }))}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile || !profileDirty}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile Preferences'}
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Workspace Policies</h2>
                <p className="text-xs text-slate-500 mt-1">Execution guardrails applied for your whole workspace.</p>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'aiAssistiveModeEnabled', label: 'AI assistive mode (non-forced)' },
                  { key: 'approvalGateEnforced', label: 'Approval gates enforced' },
                  { key: 'autoCreateReportThreads', label: 'Auto-create report threads' },
                  { key: 'slackPublishRequiresReview', label: 'Slack publish requires review' },
                  { key: 'managerExceptionDigestEnabled', label: 'Manager exception digest' },
                  { key: 'studioVisualsTabEnabled', label: 'Visuals tab enabled' },
                  { key: 'studioCommsTabEnabled', label: 'Comms tab enabled' },
                  { key: 'legacySurfacesEnabled', label: 'Legacy surfaces fallback enabled' }
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm">
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean((policies as any)[item.key])}
                      onChange={(event) => setPolicies((prev) => ({
                        ...prev,
                        [item.key]: event.target.checked
                      }))}
                    />
                  </label>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={savePolicies}
                  disabled={savingPolicies}
                  className="rounded-lg bg-slate-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-50"
                >
                  {savingPolicies ? 'Saving...' : 'Save Workspace Policies'}
                </button>
              </div>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-3">Operations Shortcuts</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link to="/app/billing" className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Billing and Plans
              </Link>
              <Link to="/app/team" className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Team Management
              </Link>
              <Link to="/app/control-tower" className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Manager Control Tower
              </Link>
              <Link to="/app/profile" className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Account Profile
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default SettingsControlCenter;
