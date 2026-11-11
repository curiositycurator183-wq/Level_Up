import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { calculateLevel, calculateStreaks, LevelInfo, awardXP } from '../domain/gamification';
import { 
  Flame, 
  Target, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Calendar, 
  ArrowRight, 
  Plus, 
  BookOpen, 
  Sparkles, 
  Edit3,
  Check,
  Trophy
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface HomeDashboardProps {
  setCurrentTab: (tab: string) => void;
  levelInfo: LevelInfo;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ setCurrentTab, levelInfo }) => {
  const { user } = useAuth();
  const { enqueueMutation } = useSync();

  const [editingTarget, setEditingTarget] = useState(false);
  const [newTargetMinutes, setNewTargetMinutes] = useState(120);

  // Queries
  const sessions = useLiveQuery(
    () => db.sessions.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const tasks = useLiveQuery(
    () => db.tasks.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const subjects = useLiveQuery(
    () => db.subjects.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const exams = useLiveQuery(
    () => db.exams.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const userSettings = useLiveQuery(
    () => db.user_settings.get(user?.id || ''),
    [user?.id]
  );

  const streakMin = userSettings?.streak_min_minutes || 20;
  const dailyTargetMin = userSettings?.daily_target_minutes || 120;

  const { currentStreak, bestStreak, todayMinutes } = calculateStreaks(sessions, streakMin);

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayDateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  // Today's tasks
  const todayISO = new Date().toISOString().slice(0, 10);
  const activeTasks = tasks.filter(t => !t.deleted_at);
  const todayTasks = activeTasks.filter(t => {
    if (!t.due_at) return false;
    return t.due_at.slice(0, 10) === todayISO;
  });
  // Or all pending tasks if no tasks specifically scheduled today
  const priorityTasks = todayTasks.length > 0 ? todayTasks : activeTasks.filter(t => t.status !== 'Completed').slice(0, 5);

  const completedTodayCount = tasks.filter(t => !t.deleted_at && t.status === 'Completed' && t.completed_at?.slice(0, 10) === todayISO).length;
  const pendingCount = activeTasks.filter(t => t.status !== 'Completed').length;

  // Upcoming exams
  const upcomingExams = exams
    .filter(e => !e.deleted_at && e.exam_at >= todayISO)
    .sort((a, b) => a.exam_at.localeCompare(b.exam_at))
    .slice(0, 3);

  // Recent study sessions
  const recentSessions = sessions
    .filter(s => !s.deleted_at && s.status !== 'Abandoned')
    .sort((a, b) => b.start_at.localeCompare(a.start_at))
    .slice(0, 4);

  // Subject map
  const subjectMap = new Map(subjects.map(s => [s.id, s]));

  // Toggle task completion
  const handleToggleTask = async (task: any) => {
    if (!user) return;
    const isCompleted = task.status === 'Completed';
    const newStatus = isCompleted ? 'To Do' : 'Completed';
    const now = new Date().toISOString();

    const updatedTask = {
      ...task,
      status: newStatus,
      completed_at: isCompleted ? null : now,
      updated_at: now,
      version: (task.version || 1) + 1
    };

    await db.tasks.put(updatedTask);
    await enqueueMutation('tasks', task.id, 'UPSERT', updatedTask);

    if (!isCompleted) {
      // Award 10 XP once
      const awarded = await awardXP(
        user.id,
        'task',
        task.id,
        10,
        `Completed Task: ${task.title}`,
        `task_${task.id}`,
        enqueueMutation
      );

      if (awarded) {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 }
        });
      }
    }
  };

  const handleSaveDailyTarget = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const updatedSettings = {
      ...(userSettings || {
        user_id: user.id,
        timezone: 'UTC',
        theme: 'system' as const,
        timer_focus_min: 25,
        timer_short_break_min: 5,
        timer_long_break_min: 15,
        timer_long_break_interval: 4,
        streak_min_minutes: 20,
        show_xp: true,
      }),
      daily_target_minutes: newTargetMinutes,
      updated_at: now,
      version: ((userSettings?.version || 1) + 1)
    };

    await db.user_settings.put(updatedSettings);
    await enqueueMutation('user_settings', user.id, 'UPSERT', updatedSettings);
    setEditingTarget(false);
  };

  const targetProgressPercent = Math.min(100, Math.round((todayMinutes / dailyTargetMin) * 100));

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{todayDateStr}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {greeting}, {user?.display_name || 'Scholar'}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-md">
            {todayMinutes >= dailyTargetMin 
              ? '🎉 Daily goal reached! Every extra minute builds mastery.' 
              : `You have studied ${todayMinutes} mins today. Keep moving forward!`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentTab('focus')}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md shadow-emerald-500/20 transition"
          >
            <Clock className="w-4 h-4" />
            <span>Start Focus Session</span>
          </button>
        </div>
      </div>

      {/* Primary 3-Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Daily Study Goal */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-500" />
              <span>Daily Target</span>
            </span>
            {editingTarget ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="10"
                  step="5"
                  value={newTargetMinutes}
                  onChange={(e) => setNewTargetMinutes(Number(e.target.value))}
                  className="w-16 px-1.5 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                />
                <button
                  onClick={handleSaveDailyTarget}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setNewTargetMinutes(dailyTargetMin);
                  setEditingTarget(true);
                }}
                title="Change daily target"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {todayMinutes}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              / {dailyTargetMin} mins
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${targetProgressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>{targetProgressPercent}% achieved</span>
            <span>{Math.max(0, dailyTargetMin - todayMinutes)} mins left</span>
          </div>
        </div>

        {/* Study Streak */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>Consistency Streak</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold border border-orange-200 dark:border-orange-900">
              Best: {bestStreak}d
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {currentStreak}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              consecutive days
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {todayMinutes >= streakMin
              ? '🔥 Today qualified! Streak preserved.'
              : `Study ${Math.max(0, streakMin - todayMinutes)} more mins today to maintain streak.`}
          </p>
        </div>

        {/* Level Progression */}
        <div 
          onClick={() => setCurrentTab('achievements')}
          className="cursor-pointer p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-800 transition"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Level Progress</span>
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              Rank {levelInfo.level}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {levelInfo.title}
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>{levelInfo.currentLevelXP} / {levelInfo.nextLevelXP} XP</span>
            <span>{levelInfo.totalXP} total XP</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Priorities / Tasks + Upcoming Exams & Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Priorities & Today's Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Today's Priorities & Tasks</span>
              <span className="text-xs font-normal text-slate-400">
                ({completedTodayCount} done, {pendingCount} pending)
              </span>
            </h3>
            <button
              onClick={() => setCurrentTab('planner')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Planner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
            {priorityTasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  All caught up!
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  No pending tasks for today. Add a new task in the Planner to stay organized.
                </p>
                <button
                  onClick={() => setCurrentTab('planner')}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Task</span>
                </button>
              </div>
            ) : (
              priorityTasks.map((t) => {
                const isDone = t.status === 'Completed';
                const subj = t.subject_id ? subjectMap.get(t.subject_id) : undefined;
                return (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-3 group first:pt-1 last:pb-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleTask(t)}
                        className="text-slate-400 hover:text-emerald-500 transition shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-emerald-500" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {t.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {subj && (
                            <span 
                              className="text-[10px] font-semibold px-2 py-0.2 rounded-full"
                              style={{ backgroundColor: `${subj.colour}20`, color: subj.colour }}
                            >
                              {subj.name}
                            </span>
                          )}
                          {t.priority === 'High' && (
                            <span className="text-[10px] font-bold text-rose-500">
                              High Priority
                            </span>
                          )}
                          {t.due_at && (
                            <span className="text-[10px] text-slate-400">
                              Due: {t.due_at.slice(0, 10)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isDone && (
                      <button
                        onClick={() => {
                          setCurrentTab('focus');
                        }}
                        title="Focus on this task"
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition shrink-0"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Upcoming Exams & Recent Study */}
        <div className="space-y-6">
          {/* Upcoming Exams */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-rose-500" />
                <span>Upcoming Exams</span>
              </h3>
              <button
                onClick={() => setCurrentTab('planner')}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                All Exams
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
              {upcomingExams.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  No upcoming examinations scheduled.
                </div>
              ) : (
                upcomingExams.map((exam) => {
                  const subj = subjectMap.get(exam.subject_id);
                  const examDate = new Date(exam.exam_at);
                  const diffDays = Math.ceil((examDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={exam.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {subj?.name || 'Subject Exam'}
                        </span>
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                          {diffDays <= 0 ? 'Today!' : diffDays === 1 ? 'Tomorrow!' : `in ${diffDays} days`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span>Date: {exam.exam_at}</span>
                        {exam.exam_time && <span>• {exam.exam_time}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Sessions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span>Recent Focus</span>
              </h3>
              <button
                onClick={() => setCurrentTab('progress')}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                Analytics
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-2.5">
              {recentSessions.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  No focus sessions recorded yet. Start one!
                </div>
              ) : (
                recentSessions.map((s) => {
                  const subj = s.subject_id ? subjectMap.get(s.subject_id) : undefined;
                  const mins = Math.round(s.actual_seconds / 60);
                  return (
                    <div key={s.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {subj?.name || s.type}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(s.start_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg text-[11px]">
                        {mins}m
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
