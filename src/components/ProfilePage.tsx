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
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-slate-400">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
          <p className="text-slate-400">Manage your account and preferences</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Profile Card */}
        {profile && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-8">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {(profile.full_name || profile.name || profile.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{profile.full_name || profile.name || 'User'}</h2>
                  <p className="text-white/80">{profile.email}</p>
                </div>
              </div>
            </div>

            {/* Profile Content */}
            <div className="p-8 space-y-8">
              {/* Account Information */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-6">Account Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-slate-400">Full Name</label>
                    <p className="text-white mt-2">{profile.full_name || profile.name || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Email Address</label>
                    <p className="text-white mt-2">{profile.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Member Since</label>
                    <p className="text-white mt-2">
                      {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subscription Information */}
              <div className="pt-6 border-t border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-6">Subscription</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800 rounded-lg p-4">
                    <label className="text-sm text-slate-400 uppercase">Plan</label>
                    <p className="text-white mt-2 font-bold capitalize">
                      {profile.subscription_tier || 'basic'}
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <label className="text-sm text-slate-400 uppercase">Status</label>
                    <p className="text-white mt-2 font-bold capitalize flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${profile.subscription_status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {profile.subscription_status || 'inactive'}
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <label className="text-sm text-slate-400 uppercase">Expires</label>
                    <p className="text-white mt-2 font-bold">
                      {profile.subscription_expires_at ? new Date(profile.subscription_expires_at).toLocaleDateString() : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Usage Statistics */}
              <div className="pt-6 border-t border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-6">Usage</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800 rounded-lg p-4">
                    <label className="text-sm text-slate-400 uppercase">Workspaces</label>
                    <p className="text-white mt-2 text-2xl font-bold">{profile.workspace_count || 0}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <label className="text-sm text-slate-400 uppercase">Datasets</label>
                    <p className="text-white mt-2 text-2xl font-bold">{profile.dataset_count || 0}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <label className="text-sm text-slate-400 uppercase">Rows Processed</label>
                    <p className="text-white mt-2 text-2xl font-bold">
                      {((profile.total_rows_processed || 0) / 1000000).toFixed(2)}M
                    </p>
                  </div>
                </div>
              </div>

              {/* Change Password */}
              <div className="pt-6 border-t border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-6">Security</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Current Password</label>
                    <input
                      type="password"
                      value={passwordChange.currentPassword}
                      onChange={(e) => setPasswordChange({ ...passwordChange, currentPassword: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      placeholder="Enter current password"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">New Password</label>
                    <input
                      type="password"
                      value={passwordChange.newPassword}
                      onChange={(e) => setPasswordChange({ ...passwordChange, newPassword: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      placeholder="Enter new password (min 8 characters)"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Confirm Password</label>
                    <input
                      type="password"
                      value={passwordChange.confirmPassword}
                      onChange={(e) => setPasswordChange({ ...passwordChange, confirmPassword: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>

                  {passwordMessage && (
                    <div className={`p-3 rounded-lg text-sm ${
                      passwordMessage.type === 'success'
                        ? 'bg-green-900/20 text-green-200 border border-green-800'
                        : 'bg-red-900/20 text-red-200 border border-red-800'
                    }`}>
                      {passwordMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>

              {/* Logout Button */}
              <div className="pt-6 border-t border-slate-800">
                <button
                  onClick={handleLogout}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
