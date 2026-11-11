import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ArrowRight, Shield, AlertCircle, Server, UserCheck } from 'lucide-react';
import { getServerUrl } from '../sync/syncEngine';

export const AuthModal: React.FC = () => {
  const { login, register, continueAsGuest } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [deviceLabel, setDeviceLabel] = useState(
    navigator.userAgent.includes('Android') ? 'Android Phone' : 'Windows Laptop'
  );
  const [customServerUrl, setCustomServerUrl] = useState(getServerUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSaveServerUrl = () => {
    localStorage.setItem('level_up_server_url', customServerUrl.trim());
    setError('Sync server URL updated');
    setTimeout(() => setError(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (customServerUrl.trim()) {
      localStorage.setItem('level_up_server_url', customServerUrl.trim());
    }

    try {
      if (isGuestMode) {
        if (!guestName.trim()) {
          setError('Please provide a name');
          setLoading(false);
          return;
        }
        continueAsGuest(guestName.trim());
      } else if (isRegister) {
        if (!displayName.trim()) {
          setError('Please provide your name');
          setLoading(false);
          return;
        }
        await register(email.trim(), password, displayName.trim());
      } else {
        await login(email.trim(), password, deviceLabel);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error. Check server URL or offline mode.');
    } finally {
      setLoading(false);
    }
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
            {isGuestMode
              ? 'Local-first offline mode (No server required)'
              : isRegister
                ? 'Create your personal study headquarters'
                : 'Welcome back to your study headquarters'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isGuestMode ? (
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
                Everything is stored securely right in your device's IndexedDB. You can connect to a sync server anytime later in Settings.
              </p>
            </div>
          ) : (
            <>
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {!isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Device Label (for sync)
                  </label>
                  <input
                    type="text"
                    value={deviceLabel}
                    onChange={(e) => setDeviceLabel(e.target.value)}
                    placeholder="e.g. Laptop, Phone"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>{isGuestMode ? 'Start Studying Offline' : isRegister ? 'Create Account' : 'Sign In & Sync'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-center">
          {!isGuestMode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline block w-full"
              >
                {isRegister ? 'Already have an account? Sign In' : 'New to Level Up? Create account'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsGuestMode(true);
                  setError(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 block w-full pt-1"
              >
                ⚡ Continue directly in Local Offline Mode
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsGuestMode(false);
                setError(null);
              }}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline block w-full"
            >
              ← Back to Sign In / Sync Account
            </button>
          )}
        </div>

        {/* Custom Server URL configuration option */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowServerConfig(!showServerConfig)}
            className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1.5 mx-auto"
          >
            <Server className="w-3.5 h-3.5" />
            <span>{showServerConfig ? 'Hide Server Configuration' : 'Custom Sync Server URL'}</span>
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
                  placeholder="e.g. http://192.168.1.15:3000"
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
                Leave empty for same-origin server. Use your computer's IP when testing on a mobile device on local Wi-Fi.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>Local-first encrypted data • Zero third-party trackers</span>
        </div>
      </div>
    </div>
  );
};
