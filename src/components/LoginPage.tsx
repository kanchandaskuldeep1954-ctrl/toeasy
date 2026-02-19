import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    try {
      await login(email, password);
      navigate('/app/studio');
    } catch (err) {
      setFormError(error || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 -right-4 w-72 h-72 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-[120px]" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white dark:bg-white/5 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-white/10 transition-all">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white text-center mb-2 uppercase tracking-tight">ToEasy AI</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-8 text-sm uppercase tracking-widest font-medium">Data Operating System</p>

          {(formError || error) && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-xl mb-6 text-sm">
              {formError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
            >
              {isLoading ? 'Decrypting...' : 'Access Dashboard'}
            </button>
          </form>

          <p className="text-slate-500 dark:text-slate-600 text-center mt-8 text-xs font-medium">
            New to the OS?{' '}
            <Link to="/signup" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-white font-bold transition-colors">
              CREATE ACCOUNT
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
};
