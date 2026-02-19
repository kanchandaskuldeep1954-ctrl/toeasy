import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, verifyOTP, resendOTP, isLoading, error } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email || !password || !confirmPassword || !name) {
      setFormError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    try {
      await register(email, password, name);
      setOtpSent(true);
    } catch (err: any) {
      if (err.message && err.message.includes('User already exists')) {
        setFormError('User already exists. Please login.');
      } else {
        setFormError(error || 'Signup failed. Please try again.');
      }
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!otp || otp.length !== 6) {
      setFormError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      // Check for invite token in URL
      const searchParams = new URLSearchParams(window.location.search);
      const inviteToken = searchParams.get('invite');

      const response = await verifyOTP(email, otp, inviteToken) as any;

      // If we joined a workspace via invite, go there
      if (response && response.joinedWorkspaceId) {
        navigate(`/app/studio?workspace=${response.joinedWorkspaceId}`);
      } else {
        navigate('/app/studio');
      }
    } catch (err: any) {
      setFormError(error || 'Verification failed. Please check the OTP.');
    }
  };

  const handleResendOTP = async () => {
    try {
      await resendOTP(email);
      alert('OTP resent successfully!');
    } catch (err) {
      setFormError('Failed to resend OTP');
    }
  };

  if (otpSent) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
        {/* Background Orbs */}
        <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -left-4 w-72 h-72 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-[120px]" />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-white dark:bg-white/5 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-white/10 transition-all">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white text-center mb-2 uppercase tracking-tight">Verify Email</h1>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-8 text-sm font-medium">
              Code sent to <span className="text-indigo-600 dark:text-indigo-400 font-bold">{email}</span>
            </p>

            {(formError || error) && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-xl mb-6 text-sm">
                {formError || error}
              </div>
            )}

            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">One-Time Password</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isLoading}
                  className="w-full text-center text-3xl tracking-[0.5em] px-4 py-5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 font-mono transition-all"
                  placeholder="000000"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
              >
                {isLoading ? 'Verifying...' : 'Initialize Access'}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                onClick={handleResendOTP}
                className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                Didn't receive code? <span className="text-indigo-600 dark:text-indigo-400 underline underline-offset-4">Resend</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 -right-4 w-72 h-72 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-[120px]" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white dark:bg-white/5 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-white/10 transition-all">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white text-center mb-2 uppercase tracking-tight">Create Account</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-8 text-sm uppercase tracking-widest font-medium">Join the Data OS</p>

          {(formError || error) && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-xl mb-6 text-sm">
              {formError || error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                placeholder="Elon Musk"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                placeholder="elon@spacex.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Confirm</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
            >
              {isLoading ? 'Processing...' : 'Start Free Trial'}
            </button>
          </form>

          <p className="text-slate-500 dark:text-slate-600 text-center mt-8 text-xs font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-white font-bold transition-colors">
              LOGIN
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
