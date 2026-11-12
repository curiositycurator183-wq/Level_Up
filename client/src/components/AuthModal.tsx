import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Shield, AlertCircle, Server, CheckCircle2, KeyRound, Mail, Lock, User } from 'lucide-react';
import { getServerUrl, DEFAULT_PRODUCTION_SERVER } from '../sync/syncEngine';
import { validateLegitEmail, validatePassword } from '../utils/validation';

type AuthView = 'login' | 'register' | 'forgot_request' | 'forgot_verify' | 'guest';

export const AuthModal: React.FC = () => {
  const { login, register, forgotPassword, resetPassword, continueAsGuest } = useAuth();

  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [deviceLabel, setDeviceLabel] = useState(
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Android') ? 'Android Phone' : 'Windows Laptop'
  );
  const [customServerUrl, setCustomServerUrl] = useState(getServerUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSaveServerUrl = () => {
    const trimmed = customServerUrl.trim();
    if (trimmed) {
      localStorage.setItem('level_up_server_url', trimmed);
    } else {
      localStorage.removeItem('level_up_server_url');
    }
    setSuccessMsg('Sync server address updated.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const resetMessages = () => {
    setError(null);
    setSuccessMsg(null);
    setDevCode(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const emailCheck = validateLegitEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.reason || 'Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await login(emailCheck.cleanEmail, password, deviceLabel);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials or server URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const emailCheck = validateLegitEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.reason || 'Please enter a valid email address.');
      return;
    }

    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      setError(passCheck.reason || 'Password must be at least 6 characters.');
      return;
    }

    if (!displayName.trim()) {
      setError('Please provide your name.');
      return;
    }

    setLoading(true);
    try {
      await register(emailCheck.cleanEmail, password, displayName.trim());
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const emailCheck = validateLegitEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.reason || 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const result = await forgotPassword(emailCheck.cleanEmail);
      setSuccessMsg(result.message);
      if (result.previewCode) {
        setDevCode(result.previewCode);
      }
      setView('forgot_verify');
    } catch (err: any) {
      setError(err.message || 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const emailCheck = validateLegitEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.reason || 'Please enter a valid email address.');
      return;
    }

    if (!resetCode.trim() || !/^\d{6}$/.test(resetCode.trim())) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    const passCheck = validatePassword(newPassword);
    if (!passCheck.valid) {
      setError(passCheck.reason || 'New password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(emailCheck.cleanEmail, resetCode.trim(), newPassword);
      setSuccessMsg('Password reset successfully! Logging you in...');
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!guestName.trim()) {
      setError('Please provide a name.');
      return;
    }
    continueAsGuest(guestName.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 font-black text-2xl">
            ▲
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            LEVEL UP
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {view === 'guest' && 'Local-first offline mode (No server needed)'}
            {view === 'register' && 'Create your persistent study account'}
            {view === 'login' && 'Sign in to sync your study headquarters across all devices'}
            {view === 'forgot_request' && 'Reset your password via email verification code'}
            {view === 'forgot_verify' && 'Enter your 6-digit code and choose a new password'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-rose-600 dark:text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {devCode && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Verification Code Preview</span>
            </div>
            <p className="text-[11px] mb-1.5 text-amber-700 dark:text-amber-300">
              In development or when external SMTP is not yet configured, use this code:
            </p>
            <div className="font-mono text-center font-black text-lg tracking-widest bg-white dark:bg-slate-900 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800">
              {devCode}
            </div>
          </div>
        )}

        {/* ---------------- LOGIN VIEW ---------------- */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setView('forgot_request');
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Device Label (for cross-device sync)
              </label>
              <input
                type="text"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                placeholder="e.g. Laptop, Phone"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <span>Sign In & Sync Across Devices</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ---------------- REGISTER VIEW ---------------- */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Your Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Laabhesh"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Legitimate Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. laabheshthallam@gmail.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Only valid personal, university, or work email addresses are accepted.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <span>Create Account & Start Syncing</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ---------------- FORGOT PASSWORD: STEP 1 (REQUEST CODE) ---------------- */}
        {view === 'forgot_request' && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="laabheshthallam@gmail.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                We will send a 6-digit security verification code to this email.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ---------------- FORGOT PASSWORD: STEP 2 (ENTER CODE & NEW PASSWORD) ---------------- */}
        {view === 'forgot_verify' && (
          <form onSubmit={handleVerifyReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                6-Digit Verification Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  pattern="\d{6}"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <span>Reset Password & Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ---------------- GUEST VIEW ---------------- */}
        {view === 'guest' && (
          <form onSubmit={handleGuestLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Your Scholar Name
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Data is stored in local browser storage. You can register for cross-device cloud sync anytime.
              </p>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
            >
              <span>Start Studying Offline</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ---------------- VIEW TOGGLES ---------------- */}
        <div className="mt-5 space-y-2 text-center">
          {view === 'login' && (
            <>
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setView('register');
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline block w-full"
              >
                New to Level Up? Create account
              </button>
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setView('guest');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 block w-full pt-1"
              >
                ⚡ Continue directly in Local Offline Mode
              </button>
            </>
          )}

          {view === 'register' && (
            <button
              type="button"
              onClick={() => {
                resetMessages();
                setView('login');
              }}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline block w-full"
            >
              Already have an account? Sign In
            </button>
          )}

          {(view === 'forgot_request' || view === 'forgot_verify' || view === 'guest') && (
            <button
              type="button"
              onClick={() => {
                resetMessages();
                setView('login');
              }}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline block w-full"
            >
              ← Back to Sign In
            </button>
          )}
        </div>

        {/* ---------------- CUSTOM SYNC SERVER CONFIG ---------------- */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowServerConfig(!showServerConfig)}
            className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1.5 mx-auto"
          >
            <Server className="w-3.5 h-3.5" />
            <span>{showServerConfig ? 'Hide Server Configuration' : 'Sync Server Endpoint'}</span>
          </button>

          {showServerConfig && (
            <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 text-left">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Backend Server Address
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  placeholder={`Default: ${DEFAULT_PRODUCTION_SERVER}`}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={handleSaveServerUrl}
                  className="px-3 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg text-xs font-semibold"
                >
                  Save
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Defaults to <code>{DEFAULT_PRODUCTION_SERVER}</code> on Android app and relative origin on web.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>Real-time cross-device encrypted sync • Zero third-party trackers</span>
        </div>
      </div>
    </div>
  );
};
