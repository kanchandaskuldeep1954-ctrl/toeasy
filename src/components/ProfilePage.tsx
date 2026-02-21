import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  billingAPI,
  ManagerSummary,
  ReadinessDecision,
  studioAPI,
  SubscriptionState,
  userAPI,
  UserProfile,
  UserUsage
} from '../services/api';

type PasswordState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ? String(activeWorkspace.id) : '';

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [managerSummary, setManagerSummary] = useState<ManagerSummary | null>(null);
  const [readiness, setReadiness] = useState<ReadinessDecision | null>(null);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [activeRoomName, setActiveRoomName] = useState('No active room');

  const [displayName, setDisplayName] = useState('');
  const [passwordState, setPasswordState] = useState<PasswordState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const initials = useMemo(() => {
    const name = profile?.full_name || user?.email || 'U';
    const parts = name.split(' ').filter(Boolean);
    if (!parts.length) return 'U';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'U';
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }, [profile?.full_name, user?.email]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [profileResult, usageResult, subscriptionResult, navResult] = await Promise.all([
          userAPI.getProfile(),
          userAPI.getUsage(),
          workspaceId ? billingAPI.getSubscription(workspaceId) : Promise.resolve({ data: null }),
          workspaceId ? studioAPI.getNavigationState(workspaceId) : Promise.resolve({ data: null })
        ]);

        const nextProfile = profileResult.data;
        setProfile(nextProfile);
        setDisplayName(nextProfile?.full_name || '');
        setUsage(usageResult.data || null);
        setSubscription(subscriptionResult.data || null);

        const nav = navResult.data;
        if (workspaceId && nav) {
          const roomId = nav?.active?.roomId || nav?.rooms?.[0]?.id;
          const roomLabel = nav?.rooms?.find((room) => Number(room.id) === Number(roomId))?.name;
          setActiveRoomName(roomLabel || 'No active room');

          if (roomId) {
            const [summaryResult, readinessResult, incidentsResult] = await Promise.all([
              studioAPI.getManagerSummary(workspaceId, String(roomId), { periodDays: 14 }),
              studioAPI.getReadinessDecision(workspaceId, String(roomId), { periodDays: 14 }),
              studioAPI.listPilotIncidents(workspaceId, { periodDays: 14, status: 'open', severity: 'all' })
            ]);
            setManagerSummary(summaryResult.data?.summary || null);
            setReadiness(readinessResult.data || null);
            setOpenIncidents(Number(incidentsResult.data?.counts?.open || 0));
          } else {
            setManagerSummary(null);
            setReadiness(null);
            setOpenIncidents(0);
          }
        } else {
          setManagerSummary(null);
          setReadiness(null);
          setOpenIncidents(0);
          setActiveRoomName('No active room');
        }
      } catch (err: any) {
        if (err?.response?.status === 401) {
          navigate('/login');
          return;
        }
        setError(err?.response?.data?.error || err?.message || 'Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workspaceId, navigate]);

  const saveDisplayName = async () => {
    if (!displayName.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    setError('');
    setSuccess('');
    try {
      const result = await userAPI.updateProfile({ full_name: displayName.trim() });
      setProfile(result.data || profile);
      setSuccess('Profile updated.');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (passwordState.newPassword !== passwordState.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (passwordState.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSavingPassword(true);
    try {
      await userAPI.changePassword(passwordState.currentPassword, passwordState.newPassword);
      setPasswordState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setSuccess('Password updated.');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full p-8 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Profile and Operations</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage account identity, security, plan, and workspace operations context in one place.
        </p>
      </header>

      {(error || success) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 space-y-6">
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg font-black">
                {initials}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Account</div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">{profile?.email || user?.email}</div>
                  <div className="text-xs text-slate-500">Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'n/a'}</div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    placeholder="Your display name"
                  />
                  <button
                    onClick={saveDisplayName}
                    disabled={savingProfile}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Name'}
                  </button>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Workspace Ops Snapshot</h2>
            <div className="text-xs text-slate-500">Active room: {activeRoomName}</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-[11px] text-slate-500">Readiness</div>
                <div className={`text-xl font-black ${
                  readiness?.overall === 'go' ? 'text-emerald-600' : readiness?.overall === 'no_go' ? 'text-rose-600' : 'text-slate-500'
                }`}>
                  {readiness?.overall === 'go' ? 'GO' : readiness?.overall === 'no_go' ? 'NO-GO' : 'N/A'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-[11px] text-slate-500">Pending Approvals</div>
                <div className="text-xl font-black text-slate-900 dark:text-white">{managerSummary?.pendingApprovals ?? 0}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-[11px] text-slate-500">Blocked Publishes</div>
                <div className="text-xl font-black text-amber-600">{managerSummary?.blockedPublishes ?? 0}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-[11px] text-slate-500">Open Incidents</div>
                <div className="text-xl font-black text-rose-600">{openIncidents}</div>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Security</h2>
            <form onSubmit={updatePassword} className="grid gap-3 md:grid-cols-2">
              <input
                type="password"
                value={passwordState.currentPassword}
                onChange={(event) => setPasswordState((prev) => ({ ...prev, currentPassword: event.target.value }))}
                placeholder="Current password"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                required
              />
              <input
                type="password"
                value={passwordState.newPassword}
                onChange={(event) => setPasswordState((prev) => ({ ...prev, newPassword: event.target.value }))}
                placeholder="New password"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                required
              />
              <input
                type="password"
                value={passwordState.confirmPassword}
                onChange={(event) => setPasswordState((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                placeholder="Confirm new password"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm md:col-span-2"
                required
              />
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="rounded-lg bg-slate-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-50"
                >
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </article>
        </section>

        <aside className="space-y-6">
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Usage and Plan</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                <div className="text-slate-500">Workspaces</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{usage?.stats?.workspaces ?? 0}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                <div className="text-slate-500">Datasets</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{usage?.stats?.datasets ?? 0}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                <div className="text-slate-500">Dashboards</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{usage?.stats?.dashboards ?? 0}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                <div className="text-slate-500">Queries</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{usage?.stats?.queriesExecuted ?? 0}</div>
              </div>
            </div>
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-900/10 p-3">
              <div className="text-xs text-indigo-700 dark:text-indigo-300">
                Tier: <span className="font-semibold">{subscription?.tier || usage?.tier || 'basic'}</span>
              </div>
              <div className="text-xs text-indigo-700 dark:text-indigo-300">
                Status: <span className="font-semibold">{subscription?.status || 'active'}</span>
              </div>
              <div className="text-xs text-indigo-700 dark:text-indigo-300">
                Renewal: <span className="font-semibold">{subscription?.renewalAt ? new Date(subscription.renewalAt).toLocaleDateString() : 'n/a'}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/app/billing')}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Manage Billing
            </button>
          </article>

          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Quick Access</h2>
            <div className="grid gap-2">
              <Link to="/app/settings" className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Settings Control Center
              </Link>
              <Link to="/app/team" className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Team Workspace
              </Link>
              <Link to="/app/chat" className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Workspace Chat
              </Link>
              <Link to="/app/control-tower" className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Manager Control Tower
              </Link>
            </div>
            <button
              onClick={logout}
              className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
            >
              Sign Out
            </button>
          </article>
        </aside>
      </div>
    </div>
  );
};
