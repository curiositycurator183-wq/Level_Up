import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../db';
import { useAuth } from './AuthContext';
import { useSync } from './SyncContext';
import { Session, SessionType } from '../types';
import { awardXP, checkAndUnlockAchievements } from '../domain/gamification';
import { getServerUrl } from '../sync/syncEngine';
import { safeJson } from '../utils/http';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';
export type TimerStatus = 'idle' | 'running' | 'paused';

interface TimerPersistedState {
  mode: TimerMode;
  status: TimerStatus;
  subjectId?: string;
  topicId?: string;
  sessionType: SessionType;
  notes: string;
  plannedMinutes: number;
  targetEndTime: number | null;
  remainingSeconds: number;
  actualElapsedSeconds: number;
  sessionStartTime: string;
}

interface TimerContextType {
  mode: TimerMode;
  status: TimerStatus;
  subjectId?: string;
  topicId?: string;
  sessionType: SessionType;
  notes: string;
  plannedMinutes: number;
  remainingSeconds: number;
  actualElapsedSeconds: number;
  setMode: (mode: TimerMode) => void;
  setSubjectId: (id?: string) => void;
  setTopicId: (id?: string) => void;
  setSessionType: (type: SessionType) => void;
  setNotes: (notes: string) => void;
  setPlannedMinutes: (mins: number) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  finishSession: (abandoned?: boolean) => Promise<{ session: Session; xpAwarded: boolean } | null>;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

const STORAGE_KEY = 'level_up_timer_state';

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { enqueueMutation } = useSync();

  const [mode, setModeState] = useState<TimerMode>('focus');
  const [status, setStatusState] = useState<TimerStatus>('idle');
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [topicId, setTopicId] = useState<string | undefined>(undefined);
  const [sessionType, setSessionType] = useState<SessionType>('Study');
  const [notes, setNotes] = useState<string>('');
  const [plannedMinutes, setPlannedMinutes] = useState<number>(25);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(25 * 60);
  const [actualElapsedSeconds, setActualElapsedSeconds] = useState<number>(0);

  const targetEndTimeRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<string>(new Date().toISOString());

  // Cross-device server sync functions
  const syncActiveTimerToServer = useCallback(async (customPayload?: any) => {
    const token = localStorage.getItem('level_up_token');
    if (!token) return;

    const baseUrl = getServerUrl();
    const payload = customPayload || {
      mode,
      status,
      subjectId,
      topicId,
      sessionType,
      notes,
      plannedMinutes,
      targetEndTime: targetEndTimeRef.current,
      remainingSeconds,
      actualElapsedSeconds,
      sessionStartTime: sessionStartTimeRef.current
    };

    try {
      await fetch(`${baseUrl}/api/timer/active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    } catch {
      // Network or offline, fallback to local storage
    }
  }, [mode, status, subjectId, topicId, sessionType, notes, plannedMinutes, remainingSeconds, actualElapsedSeconds]);

  const deleteActiveTimerOnServer = useCallback(async () => {
    const token = localStorage.getItem('level_up_token');
    if (!token) return;

    const baseUrl = getServerUrl();
    try {
      await fetch(`${baseUrl}/api/timer/active`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch {
      // Ignore
    }
  }, []);

  const fetchRemoteTimer = useCallback(async () => {
    const token = localStorage.getItem('level_up_token');
    if (!token) return;

    const baseUrl = getServerUrl();
    try {
      const res = await fetch(`${baseUrl}/api/timer/active`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await safeJson(res);
        if (data?.active && data?.timer) {
          const t = data.timer;
          setModeState(t.mode);
          setSubjectId(t.subjectId);
          setTopicId(t.topicId);
          setSessionType(t.sessionType);
          setNotes(t.notes || '');
          setPlannedMinutes(t.plannedMinutes);
          setActualElapsedSeconds(t.actualElapsedSeconds || 0);
          sessionStartTimeRef.current = t.sessionStartTime;

          if (t.status === 'running' && t.targetEndTime) {
            const now = Date.now();
            const left = Math.max(0, Math.round((t.targetEndTime - now) / 1000));
            targetEndTimeRef.current = t.targetEndTime;
            setRemainingSeconds(left);
            setStatusState(left > 0 ? 'running' : 'paused');
          } else {
            targetEndTimeRef.current = null;
            setRemainingSeconds(t.remainingSeconds);
            setStatusState(t.status);
          }
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Fetch remote timer on initial mount and when user / auth changes
  useEffect(() => {
    fetchRemoteTimer();
  }, [user?.id, fetchRemoteTimer]);

  // Periodic poll every 5s and on window focus/visibility to maintain 100% cross-device sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && navigator.onLine) {
        fetchRemoteTimer();
      }
    }, 5000);

    const onFocus = () => {
      if (user && navigator.onLine) {
        fetchRemoteTimer();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [user, fetchRemoteTimer]);

  // Load persisted timer state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state: TimerPersistedState = JSON.parse(saved);
        setModeState(state.mode);
        setSubjectId(state.subjectId);
        setTopicId(state.topicId);
        setSessionType(state.sessionType);
        setNotes(state.notes || '');
        setPlannedMinutes(state.plannedMinutes);
        sessionStartTimeRef.current = state.sessionStartTime;

        if (state.status === 'running' && state.targetEndTime) {
          const now = Date.now();
          const left = Math.max(0, Math.round((state.targetEndTime - now) / 1000));
          const elapsed = state.actualElapsedSeconds + Math.max(0, Math.round((now - (state.targetEndTime - state.remainingSeconds * 1000)) / 1000));
          
          targetEndTimeRef.current = state.targetEndTime;
          setRemainingSeconds(left);
          setActualElapsedSeconds(elapsed);
          setStatusState(left > 0 ? 'running' : 'paused');
        } else {
          setStatusState(state.status);
          setRemainingSeconds(state.remainingSeconds);
          setActualElapsedSeconds(state.actualElapsedSeconds);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save persisted state whenever timer details change
  useEffect(() => {
    if (status !== 'idle') {
      const state: TimerPersistedState = {
        mode,
        status,
        subjectId,
        topicId,
        sessionType,
        notes,
        plannedMinutes,
        targetEndTime: targetEndTimeRef.current,
        remainingSeconds,
        actualElapsedSeconds,
        sessionStartTime: sessionStartTimeRef.current
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [mode, status, subjectId, topicId, sessionType, notes, plannedMinutes, remainingSeconds, actualElapsedSeconds]);

  // Timer interval clock (timestamp-based to survive background tab throttle)
  useEffect(() => {
    if (status !== 'running') return;

    const interval = setInterval(() => {
      if (targetEndTimeRef.current) {
        const now = Date.now();
        const left = Math.max(0, Math.round((targetEndTimeRef.current - now) / 1000));
        setRemainingSeconds(left);

        if (mode === 'focus') {
          setActualElapsedSeconds(prev => prev + 1);
        }

        if (left <= 0) {
          setStatusState('paused');
          targetEndTimeRef.current = null;
          // Play notification chime
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
            osc.start();
            osc.stop(ctx.currentTime + 0.8);
          } catch {
            // Audio context not allowed or unsupported
          }

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('LEVEL UP Timer Finished!', {
              body: mode === 'focus' ? 'Focus session completed! Take a break.' : 'Break time over! Ready to focus?',
              icon: '/icon-192.png'
            });
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, mode]);

  const setMode = (newMode: TimerMode) => {
    setModeState(newMode);
    setStatusState('idle');
    targetEndTimeRef.current = null;
    let mins = 25;
    if (newMode === 'shortBreak') mins = 5;
    if (newMode === 'longBreak') mins = 15;
    setPlannedMinutes(mins);
    setRemainingSeconds(mins * 60);
    setActualElapsedSeconds(0);
  };

  const startTimer = () => {
    const end = Date.now() + remainingSeconds * 1000;
    const startTime = new Date().toISOString();
    targetEndTimeRef.current = end;
    sessionStartTimeRef.current = startTime;
    setStatusState('running');

    syncActiveTimerToServer({
      mode,
      status: 'running',
      subjectId,
      topicId,
      sessionType,
      notes,
      plannedMinutes,
      targetEndTime: end,
      remainingSeconds,
      actualElapsedSeconds,
      sessionStartTime: startTime
    });
  };

  const pauseTimer = () => {
    targetEndTimeRef.current = null;
    setStatusState('paused');

    syncActiveTimerToServer({
      mode,
      status: 'paused',
      subjectId,
      topicId,
      sessionType,
      notes,
      plannedMinutes,
      targetEndTime: null,
      remainingSeconds,
      actualElapsedSeconds,
      sessionStartTime: sessionStartTimeRef.current
    });
  };

  const resumeTimer = () => {
    const end = Date.now() + remainingSeconds * 1000;
    targetEndTimeRef.current = end;
    setStatusState('running');

    syncActiveTimerToServer({
      mode,
      status: 'running',
      subjectId,
      topicId,
      sessionType,
      notes,
      plannedMinutes,
      targetEndTime: end,
      remainingSeconds,
      actualElapsedSeconds,
      sessionStartTime: sessionStartTimeRef.current
    });
  };

  const resetTimer = () => {
    targetEndTimeRef.current = null;
    setStatusState('idle');
    setRemainingSeconds(plannedMinutes * 60);
    setActualElapsedSeconds(0);
    localStorage.removeItem(STORAGE_KEY);
    deleteActiveTimerOnServer();
  };

  const finishSession = async (abandoned = false): Promise<{ session: Session; xpAwarded: boolean } | null> => {
    if (!user) return null;

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const focusDurationSeconds = actualElapsedSeconds;

    const sessionStatus = abandoned 
      ? 'Abandoned' 
      : remainingSeconds <= 0 
        ? 'Completed' 
        : 'Interrupted';

    const session: Session = {
      id: sessionId,
      user_id: user.id,
      subject_id: subjectId,
      topic_id: topicId,
      type: sessionType,
      planned_minutes: plannedMinutes,
      actual_seconds: focusDurationSeconds,
      start_at: sessionStartTimeRef.current,
      end_at: now,
      status: sessionStatus,
      notes,
      created_at: now,
      updated_at: now,
      version: 1
    };

    // Save session locally
    await db.sessions.put(session);
    await enqueueMutation('sessions', sessionId, 'UPSERT', session);

    // Gamification: Award 10 XP if completed focus session and >= 10 mins (600s)
    let xpAwarded = false;
    if (mode === 'focus' && sessionStatus === 'Completed' && focusDurationSeconds >= 600) {
      xpAwarded = await awardXP(
        user.id,
        'session',
        sessionId,
        10,
        `Focus Session Completed (${Math.round(focusDurationSeconds / 60)} mins)`,
        `session_${sessionId}`,
        enqueueMutation
      );
    }

    // Check achievements
    await checkAndUnlockAchievements(user.id, enqueueMutation);

    // Reset timer
    resetTimer();

    return { session, xpAwarded };
  };

  return (
    <TimerContext.Provider value={{
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
      setPlannedMinutes: (mins: number) => {
        setPlannedMinutes(mins);
        if (status === 'idle') {
          setRemainingSeconds(mins * 60);
        }
      },
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      finishSession
    }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) throw new Error('useTimer must be used within a TimerProvider');
  return context;
};
