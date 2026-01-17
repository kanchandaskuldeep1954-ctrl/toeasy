import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  id: string;
  full_name?: string;
  name?: string;
  email: string;
  subscription_tier?: 'basic' | 'pro' | 'enterprise';
  subscription_status?: 'active' | 'cancelled' | 'expired';
  subscription_expires_at?: string;
  created_at?: string;
  workspace_count?: number;
  dataset_count?: number;
  total_rows_processed?: number;
}

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordChange, setPasswordChange] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${backendUrl}/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const response = await fetch(`${backendUrl}/users/change-password`, {
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

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to change password');
      }

      setPasswordMessage({ type: 'success', text: 'Password changed successfully' });
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full p-8 md:p-12 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Account Settings</h1>
          <p className="text-slate-500 font-medium">Manage your personal profile and security</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
            System Operational
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm font-bold shadow-sm">
          {error}
        </div>
      )}

      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: ID Card */}
          <div className="space-y-6">
            <div className="glass-card rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-indigo-500 to-purple-600"></div>
              <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 p-1 shadow-xl relative z-10 mb-4 group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl font-black text-indigo-600">
                  {(profile.full_name || profile.name || profile.email || 'U').charAt(0).toUpperCase()}
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{profile.full_name || profile.name || 'User'}</h2>
              <p className="text-sm text-slate-500 font-mono mb-6">{profile.email}</p>

              <div className="w-full grid grid-cols-2 gap-2 text-center border-t border-slate-100 dark:border-slate-800 pt-6">
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{profile.workspace_count || 0}</p>
                  <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Workspaces</p>
                </div>
                <div className="border-l border-slate-100 dark:border-slate-800">
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{profile.dataset_count || 0}</p>
                  <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Datasets</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Subscription Plan</h3>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-lg font-bold text-slate-900 dark:text-white capitalize">{profile.subscription_tier || 'Free Tier'}</span>
                  <span className={`w-2 h-2 rounded-full ${profile.subscription_status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </div>
                <p className="text-xs text-slate-500">
                  {profile.subscription_status === 'active' ? 'Active Subscription' : 'Limited Access'}
                </p>
              </div>
              <button className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
                Upgrade Plan
              </button>
            </div>
          </div>

          {/* Right Column: details & Password */}
          <div className="lg:col-span-2 space-y-6">
            {/* Usage Stats Visuals */}
            <div className="glass-card rounded-3xl p-8">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Usage Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-slate-800/50 border border-indigo-100 dark:border-indigo-900/30">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <span className="text-xs font-bold text-slate-400">Monthly Cap</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                    {((profile.total_rows_processed || 0) / 1000).toFixed(1)}k
                  </p>
                  <p className="text-xs text-slate-500 font-medium">Rows Processed</p>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: '15%' }}></div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-slate-800/50 border border-emerald-100 dark:border-emerald-900/30">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <span className="text-xs font-bold text-slate-400">Efficiency</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mb-1">98%</p>
                  <p className="text-xs text-slate-500 font-medium">Processing Success Rate</p>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '98%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="glass-card rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Security & Password</h3>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2 block">New Password</label>
                    <input
                      type="password"
                      value={passwordChange.newPassword}
                      onChange={(e) => setPasswordChange({ ...passwordChange, newPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2 block">Confirm Password</label>
                    <input
                      type="password"
                      value={passwordChange.confirmPassword}
                      onChange={(e) => setPasswordChange({ ...passwordChange, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2 block">Current Password (to verify)</label>
                  <input
                    type="password"
                    value={passwordChange.currentPassword}
                    onChange={(e) => setPasswordChange({ ...passwordChange, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {passwordMessage && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${passwordMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : 'bg-rose-50 text-rose-600 border border-rose-100'
                    }`}>
                    {passwordMessage.text}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                  >
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

            <div className="flex justify-center pt-8">
              <button
                onClick={handleLogout}
                className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign Out & End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
