import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

// Safely access environment variables
const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000/api';

interface UserUsage {
  tier: string;
  limits: {
    maxWorkspaces: number;
    maxDatasets: number;
    aiQueriesPerDay: number;
    maxRowsPerDataset: number;
    maxGenerateRows: number;
  };
  stats: {
    workspaces: number;
    datasets: number;
    dashboards: number;
    queriesExecuted: number;
  };
}

interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  tier: string;
}

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordChange, setPasswordChange] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      if (!token) {
        navigate('/login');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch profile and usage in parallel
      const [profileRes, usageRes] = await Promise.all([
        fetch(`${BACKEND_URL}/users/me`, { headers }),
        fetch(`${BACKEND_URL}/users/me/usage`, { headers })
      ]);

      if (!profileRes.ok || !usageRes.ok) {
        if (profileRes.status === 401 || usageRes.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch account data');
      }

      const profileData = await profileRes.json();
      const usageData = await usageRes.json();

      setProfile(profileData);
      setUsage(usageData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (passwordChange.newPassword !== passwordChange.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwordChange.newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    try {
      setPasswordLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/users/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordChange.currentPassword,
          newPassword: passwordChange.newPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
      setPasswordChange({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to change password'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
          </div>
        </div>
        <p className="mt-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Synchronizing Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-12 max-w-6xl mx-auto space-y-10">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Settings</h1>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Configure your personal hub and security</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 p-2 rounded-2xl">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-${200 + i * 100}`}></div>
            ))}
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
            {usage?.stats.workspaces || 0} active workspaces
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-black uppercase tracking-widest text-center shadow-xl">
          {error}
        </div>
      )}

      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Panel: Profile Detail */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-card rounded-[32px] overflow-hidden relative group">
              {/* Banner */}
              <div className="h-32 bg-blue-600 relative">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,#fff,transparent)] scale-150"></div>
              </div>

              <div className="px-8 pb-8 flex flex-col items-center text-center -mt-12">
                <div className="w-24 h-24 rounded-[28px] bg-white dark:bg-slate-950 p-1.5 shadow-2xl relative z-10 group-hover:scale-105 transition-transform duration-500">
                  <div className="w-full h-full rounded-[20px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center text-3xl font-black text-indigo-600 shadow-inner">
                    {profile.full_name?.charAt(0) || profile.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 border-4 border-white dark:border-slate-950 rounded-full flex items-center justify-center text-white">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
                  </div>
                </div>

                <div className="mt-4 space-y-1">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{profile.full_name || 'System User'}</h2>
                  <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">{profile.email}</p>
                </div>

                <div className="w-full grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/50">
                  <div className="text-center group/stat">
                    <p className="text-2xl font-black text-slate-900 dark:text-white transition-colors group-hover/stat:text-indigo-600">{usage?.stats.workspaces || 0}</p>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Workspaces</p>
                  </div>
                  <div className="text-center group/stat border-l border-slate-100 dark:border-slate-800/50">
                    <p className="text-2xl font-black text-slate-900 dark:text-white transition-colors group-hover/stat:text-indigo-600">{usage?.stats.datasets || 0}</p>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Datasets</p>
                  </div>
                </div>

                <div className="w-full mt-8 flex flex-col gap-2">
                  <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:translate-y-0">
                    Edit Public Profile
                  </button>
                  <button
                    onClick={logout}
                    className="w-full py-4 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600/20 dark:hover:text-rose-400 transition-all"
                  >
                    Terminate Session
                  </button>
                </div>
              </div>
            </div>

            {/* Subscription Mini Card */}
            <div className="glass-card rounded-[32px] p-8 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Tier</span>
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border ${profile.tier === 'pro' || profile.tier === 'enterprise'
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}>
                  {profile.tier || 'Basic'}
                </span>
              </div>
              <div className="pt-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white capitalize">{profile.tier === 'basic' ? 'Free Forever' : `${profile.tier} Access`}</h3>
                <p className="text-xs text-slate-500 mt-1">Full access to AI features through 2026.</p>
              </div>
              <button
                onClick={() => navigate('/app/billing')}
                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
              >
                Manage Subscription
              </button>
            </div>
          </div>

          {/* Right Panel: Metrics & Security */}
          <div className="lg:col-span-8 space-y-8">

            {/* Real-time Metrics */}
            <div className="glass-card rounded-[32px] p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Usage Insights</h3>
                  <p className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Accurate account telemetry</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <svg className="w-5 h-5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'Workspaces Created', value: usage?.stats.workspaces || 0, color: 'indigo', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', target: usage?.limits?.maxWorkspaces || 1 },
                  { label: 'AI Queries (Last 24h)', value: usage?.stats.queriesExecuted || 0, color: 'emerald', icon: 'M13 10V3L4 14h7v7l9-11h-7z', target: usage?.limits?.aiQueriesPerDay || 10 }
                ].map((stat, idx) => (
                  <div key={idx} className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/50 group hover:border-indigo-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2 bg-${stat.color}-100 dark:bg-${stat.color}-900/30 rounded-lg text-${stat.color}-600 dark:text-${stat.color}-400`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={stat.icon} /></svg>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{stat.value.toLocaleString()} / {stat.target > 10000 ? '∞' : stat.target}</p>
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{stat.label}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-400">
                        <span>Current Progress</span>
                        <span>{Math.min(100, Math.round((stat.value / stat.target) * 100))}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`bg-${stat.color}-500 h-full rounded-full shadow-lg shadow-${stat.color}-500/20 transition-all duration-1000`}
                          style={{ width: `${Math.min(100, (stat.value / stat.target) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Section Refresh */}
            <div className="glass-card rounded-[32px] p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Security & Encryption</h3>
                  <p className="text-xs text-slate-500 font-medium">Update password and manage session keys</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Password</label>
                    <input
                      type="password"
                      value={passwordChange.newPassword}
                      onChange={(e) => setPasswordChange({ ...passwordChange, newPassword: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Min 8 characters"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordChange.confirmPassword}
                      onChange={(e) => setPasswordChange({ ...passwordChange, confirmPassword: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Repeat password"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Password (Identity Verification)</label>
                  <input
                    type="password"
                    value={passwordChange.currentPassword}
                    onChange={(e) => setPasswordChange({ ...passwordChange, currentPassword: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Enter current password"
                    required
                  />
                </div>

                {passwordMessage && (
                  <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-2 duration-300 ${passwordMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'bg-rose-50 text-rose-600 border border-rose-100'
                    }`}>
                    {passwordMessage.text}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {passwordLoading ? 'Verifying...' : 'Update Security Key'}
                  </button>
                </div>
              </form>
            </div>

            {/* Legal Links Refresh */}
            <div className="glass-card rounded-[32px] p-8">
              <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-6">Legal & Transparency</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'Support', path: '/contact', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
                  { name: 'Terms of Use', path: '/terms', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                  { name: 'Data Privacy', path: '/privacy', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
                  { name: 'Refunds', path: '/refunds', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => navigate(item.path)}
                    className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/50 hover:border-indigo-500/50 hover:bg-white dark:hover:bg-slate-900 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-200/50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                      </div>
                      <span className="text-sm font-black text-slate-600 dark:text-slate-300 tracking-tight">{item.name}</span>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
