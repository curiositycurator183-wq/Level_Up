import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Settings as SettingsIcon, 
  Cloud, 
  Download, 
  Upload, 
  Trash2, 
  Moon, 
  Sun, 
  Monitor, 
  ShieldCheck, 
  RefreshCw, 
  AlertTriangle,
  Clock,
  Sparkles,
  Laptop
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, token } = useAuth();
  const { syncStatus, syncNow, enqueueMutation } = useSync();
  const { theme, setTheme } = useTheme();

  // Queries
  const userSettings = useLiveQuery(
    () => db.user_settings.get(user?.id || ''),
    [user?.id]
  );

  // Server URL
  const [syncServerUrl, setSyncServerUrl] = useState(() => localStorage.getItem('level_up_server_url') || '');

  // Settings form states
  const [dailyTarget, setDailyTarget] = useState(120);
  const [streakMin, setStreakMin] = useState(20);
  const [timerFocus, setTimerFocus] = useState(25);
  const [timerShortBreak, setTimerShortBreak] = useState(5);
  const [timerLongBreak, setTimerLongBreak] = useState(15);
  const [timerCycles, setTimerCycles] = useState(4);
  const [showXP, setShowXP] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Devices
  const [devices, setDevices] = useState<{ id: string; label: string; last_seen_at: string }[]>([]);

  // Restore Modal
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backupFileContent, setBackupFileContent] = useState<any | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Reset Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (userSettings) {
      setDailyTarget(userSettings.daily_target_minutes || 120);
      setStreakMin(userSettings.streak_min_minutes || 20);
      setTimerFocus(userSettings.timer_focus_min || 25);
      setTimerShortBreak(userSettings.timer_short_break_min || 5);
      setTimerLongBreak(userSettings.timer_long_break_min || 15);
      setTimerCycles(userSettings.timer_long_break_interval || 4);
      setShowXP(userSettings.show_xp !== false);
    }
  }, [userSettings]);

  // Load devices list
  useEffect(() => {
    if (token) {
      fetch('/api/devices', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.devices) setDevices(data.devices);
        })
        .catch(() => {});
    }
  }, [token]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const now = new Date().toISOString();
    const updated = {
      user_id: user.id,
      timezone: user.timezone || 'UTC',
      daily_target_minutes: dailyTarget,
      theme,
      timer_focus_min: timerFocus,
      timer_short_break_min: timerShortBreak,
      timer_long_break_min: timerLongBreak,
      timer_long_break_interval: timerCycles,
      streak_min_minutes: streakMin,
      show_xp: showXP,
      updated_at: now,
      version: (userSettings?.version || 1) + 1
    };

    await db.user_settings.put(updated);
    await enqueueMutation('user_settings', user.id, 'UPSERT', updated);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Full Backup Export
  const handleExportFullBackup = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/backup', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Backup export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `level-up-full-backup-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Export error');
    }
  };

  // File Picker for Restore
  const handleSelectBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.schema_version || !json.data) {
          throw new Error('Invalid LEVEL UP backup schema.');
        }
        setBackupFileContent(json);
        setRestoreError(null);
        setShowRestoreModal(true);
      } catch (err: any) {
        alert('Failed to parse backup JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Execute Restore
  const handleConfirmRestore = async () => {
    if (!token || !backupFileContent) return;
    setRestoreError(null);

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ backup: backupFileContent })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Restore failed');
      }

      // Re-sync local replica
      await db.sync_meta.put({ key: 'last_cursor', value: 0 });
      await syncNow();

      setShowRestoreModal(false);
      alert('Backup restored successfully!');
      window.location.reload();
    } catch (err: any) {
      setRestoreError(err.message);
    }
  };

  // Destructive Reset
  const handleConfirmReset = async () => {
    if (!token) return;
    if (resetConfirmationText !== 'DELETE ALL MY DATA') {
      setResetError('Please type exact confirmation text: DELETE ALL MY DATA');
      return;
    }

    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirmation: resetConfirmationText })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Reset failed');
      }

      // Clear local IndexedDB tables
      await db.subjects.clear();
      await db.chapters.clear();
      await db.topics.clear();
      await db.tasks.clear();
      await db.exams.clear();
      await db.sessions.clear();
      await db.xp_events.clear();
      await db.achievements.clear();
      await db.sync_queue.clear();
      await db.sync_meta.clear();

      setShowResetModal(false);
      alert('All personal data has been completely erased.');
      window.location.reload();
    } catch (err: any) {
      setResetError(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-emerald-500" />
          <span>System & Study Settings</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Customise timer intervals, sync preferences, cross-device registration, and backups.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-bold text-emerald-700 dark:text-emerald-300">
          Preferences saved and synced!
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Study Targets & Streaks */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Study Targets & Streaks</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Daily Study Target (minutes)
              </label>
              <input
                type="number"
                min="15"
                step="5"
                value={dailyTarget}
                onChange={(e) => setDailyTarget(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {(dailyTarget / 60).toFixed(1)} hours per day
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Minimum Streak Qualifier (minutes)
              </label>
              <input
                type="number"
                min="5"
                step="5"
                value={streakMin}
                onChange={(e) => setStreakMin(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Recorded focus minutes needed to count towards continuous streak.
              </span>
            </div>
          </div>
        </div>

        {/* Pomodoro Timer Presets */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>Pomodoro Interval Presets</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Focus (mins)
              </label>
              <input
                type="number"
                min="5"
                value={timerFocus}
                onChange={(e) => setTimerFocus(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Short Break (mins)
              </label>
              <input
                type="number"
                min="1"
                value={timerShortBreak}
                onChange={(e) => setTimerShortBreak(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Long Break (mins)
              </label>
              <input
                type="number"
                min="5"
                value={timerLongBreak}
                onChange={(e) => setTimerLongBreak(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cycles for Long Break
              </label>
              <input
                type="number"
                min="1"
                value={timerCycles}
                onChange={(e) => setTimerCycles(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Appearance & Themes */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>Appearance & Theme</span>
          </h3>

          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'dark', label: 'Dark', icon: Moon },
              { id: 'system', label: 'System', icon: Monitor },
            ].map((m) => {
              const Icon = m.icon;
              const active = theme === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTheme(m.id as any)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition ${
                    active
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition"
          >
            Save Preferences
          </button>
        </div>
      </form>

      {/* Cross-Device Sync Status & Devices */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-500" />
            <span>Cross-Device Synchronisation</span>
          </h3>

          <button
            onClick={() => syncNow()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span>Sync Now</span>
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Current Device Sync Status:</span>
            <span className="font-bold capitalize text-emerald-600 dark:text-emerald-400">{syncStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Target Latency:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">&lt; 5 seconds (Realtime WS)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Connected Account:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{user?.email}</span>
          </div>
          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-750 flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Remote Sync Server URL (leave blank for local server):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={syncServerUrl}
                onChange={(e) => setSyncServerUrl(e.target.value)}
                placeholder="e.g. http://192.168.1.15:3000 or https://api.myserver.com"
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('level_up_server_url', syncServerUrl.trim());
                  syncNow();
                  alert('Sync Server URL updated!');
                }}
                className="px-3 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-xl"
              >
                Save URL
              </button>
            </div>
          </div>
        </div>

        {devices.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
              Registered Devices ({devices.length})
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {devices.map((d) => (
                <div key={d.id} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{d.label}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Last active: {new Date(d.last_seen_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Full Backup & Restore */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Full Data Backup & Restore</span>
        </h3>
        <p className="text-xs text-slate-400">
          Complete JSON export of all your subjects, syllabus chapters, tasks, exams, focus history, and achievements.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleExportFullBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs shadow-md transition"
          >
            <Download className="w-4 h-4" />
            <span>Export Full JSON Backup</span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition">
            <Upload className="w-4 h-4" />
            <span>Restore Backup File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleSelectBackupFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Destructive Danger Zone */}
      <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 shadow-sm space-y-3">
        <h3 className="font-extrabold text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <span>Danger Zone</span>
        </h3>
        <p className="text-xs text-rose-600/80 dark:text-rose-300/80">
          Permanently delete all study records, syllabus, sessions, and achievements from the server and local device.
        </p>

        <button
          onClick={() => {
            setResetConfirmationText('');
            setResetError(null);
            setShowResetModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Reset All My Data</span>
        </button>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && backupFileContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Confirm Backup Restore
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Preview of records in this backup file:
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs space-y-1">
              <div className="flex justify-between">
                <span>Subjects:</span>
                <span className="font-bold">{backupFileContent.data?.subjects?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Chapters:</span>
                <span className="font-bold">{backupFileContent.data?.chapters?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Tasks:</span>
                <span className="font-bold">{backupFileContent.data?.tasks?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Focus Sessions:</span>
                <span className="font-bold">{backupFileContent.data?.sessions?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Exported Date:</span>
                <span className="font-bold">{backupFileContent.exported_at?.slice(0, 10)}</span>
              </div>
            </div>

            {restoreError && (
              <p className="text-xs text-rose-500 font-semibold">{restoreError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Restore & Replace Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-rose-300 dark:border-rose-900 space-y-4">
            <h3 className="text-lg font-bold text-rose-600">
              Irreversible Data Purge
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              This action will completely wipe all subjects, syllabus progress, timer sessions, and achievements.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Type <strong className="text-rose-600 font-mono">DELETE ALL MY DATA</strong> to confirm:
            </p>

            <input
              type="text"
              value={resetConfirmationText}
              onChange={(e) => setResetConfirmationText(e.target.value)}
              placeholder="DELETE ALL MY DATA"
              className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 dark:text-white"
            />

            {resetError && (
              <p className="text-xs text-rose-500 font-semibold">{resetError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={resetConfirmationText !== 'DELETE ALL MY DATA'}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs disabled:opacity-40"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
