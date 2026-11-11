import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../context/AuthContext';
import { useTimer, TimerMode } from '../context/TimerContext';
import { SessionType } from '../types';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Square, 
  Clock, 
  BookOpen, 
  Filter, 
  Sparkles, 
  CheckCircle2, 
  Coffee,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const FocusTimerPage: React.FC = () => {
  const { user } = useAuth();
  const {
    mode,
    status,
    subjectId,
    topicId,
    sessionType,
    notes,
    plannedMinutes,
    remainingSeconds,
    actualElapsedSeconds,
    setMode,
    setSubjectId,
    setTopicId,
    setSessionType,
    setNotes,
    setPlannedMinutes,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    finishSession
  } = useTimer();

  // Queries
  const subjects = useLiveQuery(
    () => db.subjects.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const chapters = useLiveQuery(
    () => db.chapters.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const sessions = useLiveQuery(
    () => db.sessions.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const activeSubjects = subjects.filter(s => !s.deleted_at);
  const activeChapters = subjectId ? chapters.filter(c => !c.deleted_at && c.subject_id === subjectId) : [];
  const activeSessions = sessions.filter(s => !s.deleted_at);

  const subjectMap = new Map(activeSubjects.map(s => [s.id, s]));

  // Filters for session history
  const [historySubjectFilter, setHistorySubjectFilter] = useState<string>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');

  const filteredSessions = activeSessions
    .filter(s => {
      if (historySubjectFilter !== 'all' && s.subject_id !== historySubjectFilter) return false;
      if (historyTypeFilter !== 'all' && s.type !== historyTypeFilter) return false;
      return true;
    })
    .sort((a, b) => b.start_at.localeCompare(a.start_at));

  // Timer formatting
  const totalSeconds = plannedMinutes * 60;
  const progressPercent = totalSeconds > 0 ? Math.min(100, Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100)) : 0;

  const displayMinutes = Math.floor(remainingSeconds / 60);
  const displaySeconds = remainingSeconds % 60;
  const formattedTime = `${String(displayMinutes).padStart(2, '0')}:${String(displaySeconds).padStart(2, '0')}`;

  const elapsedMins = Math.floor(actualElapsedSeconds / 60);
  const elapsedSecs = actualElapsedSeconds % 60;

  const handleFinish = async () => {
    if (actualElapsedSeconds < 60) {
      if (!window.confirm('You have studied for less than a minute. End session anyway?')) {
        return;
      }
    }
    const result = await finishSession(false);
    if (result?.xpAwarded) {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
    }
  };

  const handleDiscard = async () => {
    if (window.confirm('Discard current in-progress timer and notes?')) {
      await finishSession(true);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-6 h-6 text-emerald-500" />
          <span>Focus Mode & Timer</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Pomodoro & deep work sessions with background persistence and real activity logs.
        </p>
      </div>

      {/* Main Focus Control Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        {/* Mode Selector Tabs */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setMode('focus')}
            disabled={status === 'running'}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
              mode === 'focus'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Focus Session</span>
          </button>
          <button
            onClick={() => setMode('shortBreak')}
            disabled={status === 'running'}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
              mode === 'shortBreak'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Short Break (5m)</span>
          </button>
          <button
            onClick={() => setMode('longBreak')}
            disabled={status === 'running'}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
              mode === 'longBreak'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Long Break (15m)</span>
          </button>
        </div>

        {/* Circular Countdown Display */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                className="stroke-slate-100 dark:stroke-slate-800"
                strokeWidth="6"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                className={`transition-all duration-1000 ${
                  mode === 'focus' ? 'stroke-emerald-500' : mode === 'shortBreak' ? 'stroke-blue-500' : 'stroke-purple-500'
                }`}
                strokeWidth="6"
                strokeDasharray={276.46}
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute flex flex-col items-center text-center">
              <span className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
                {formattedTime}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">
                {mode === 'focus' ? (status === 'running' ? 'Focusing...' : 'Ready to Focus') : 'Resting'}
              </span>
              {mode === 'focus' && actualElapsedSeconds > 0 && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  {elapsedMins}m {elapsedSecs}s actual elapsed
                </span>
              )}
            </div>
          </div>

          {/* Quick preset minute buttons (when idle) */}
          {status === 'idle' && mode === 'focus' && (
            <div className="flex items-center gap-2 mt-4">
              {[15, 25, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setPlannedMinutes(mins)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                    plannedMinutes === mins
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Timer Control Action Buttons */}
        <div className="flex items-center justify-center gap-4 mt-6">
          {status === 'idle' ? (
            <button
              onClick={startTimer}
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg shadow-emerald-600/25 transition transform active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Timer</span>
            </button>
          ) : status === 'running' ? (
            <>
              <button
                onClick={pauseTimer}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm transition transform active:scale-95"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </button>
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition transform active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Finish Session</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={resumeTimer}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume</span>
              </button>
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm transition"
              >
                <Check className="w-4 h-4" />
                <span>Save & Finish</span>
              </button>
              <button
                onClick={handleDiscard}
                className="p-3 rounded-2xl text-slate-400 hover:text-rose-500 transition"
                title="Discard session"
              >
                <Square className="w-4 h-4" />
              </button>
            </>
          )}

          {status !== 'idle' && (
            <button
              onClick={resetTimer}
              className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Session Metadata / Link to Subject & Chapter */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject
            </label>
            <select
              disabled={status === 'running'}
              value={subjectId || ''}
              onChange={(e) => {
                setSubjectId(e.target.value || undefined);
                setTopicId(undefined);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">General (No specific subject)</option>
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chapter / Topic
            </label>
            <select
              disabled={status === 'running' || !subjectId}
              value={topicId || ''}
              onChange={(e) => setTopicId(e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">General chapter</option>
              {activeChapters.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Session Type
            </label>
            <select
              disabled={status === 'running'}
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as SessionType)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Study">Study (New Material)</option>
              <option value="Revision">Revision</option>
              <option value="Practice">Practice / Problems</option>
              <option value="Reading">Reading</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
        </div>

        {/* Session Note */}
        <div className="mt-3">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add brief note for this session (e.g. Completed Chapter 3 practice set)..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Session History Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Study Session History</span>
            <span className="text-xs font-normal text-slate-400">({filteredSessions.length} logged)</span>
          </h3>

          <div className="flex items-center gap-2">
            <select
              value={historySubjectFilter}
              onChange={(e) => setHistorySubjectFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Subjects</option>
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              value={historyTypeFilter}
              onChange={(e) => setHistoryTypeFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Types</option>
              <option value="Study">Study</option>
              <option value="Revision">Revision</option>
              <option value="Practice">Practice</option>
              <option value="Reading">Reading</option>
            </select>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No study sessions found matching filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredSessions.map((s) => {
              const subj = s.subject_id ? subjectMap.get(s.subject_id) : undefined;
              const focusMins = Math.round(s.actual_seconds / 60);

              return (
                <div key={s.id} className="py-3 flex items-center justify-between gap-3 first:pt-1 last:pb-1 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {subj?.name || 'General Focus'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {s.type}
                      </span>
                      {s.status === 'Interrupted' && (
                        <span className="text-[10px] text-amber-500 font-semibold">
                          Interrupted
                        </span>
                      )}
                    </div>
                    {s.notes && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {s.notes}
                      </p>
                    )}
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {new Date(s.start_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {focusMins}m
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      / {s.planned_minutes}m target
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
