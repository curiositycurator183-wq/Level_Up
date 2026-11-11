import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../context/AuthContext';
import { calculateStreaks } from '../domain/gamification';
import { 
  BarChart3, 
  Clock, 
  Calendar, 
  Download, 
  Flame, 
  BookOpen, 
  TrendingUp, 
  CheckCircle2,
  PieChart
} from 'lucide-react';

export const ProgressAnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [reportRange, setReportRange] = useState<'7d' | '30d' | 'all'>('7d');

  // Queries
  const sessions = useLiveQuery(
    () => db.sessions.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const subjects = useLiveQuery(
    () => db.subjects.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const chapters = useLiveQuery(
    () => db.chapters.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const tasks = useLiveQuery(
    () => db.tasks.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const activeSessions = sessions.filter(s => !s.deleted_at && s.status !== 'Abandoned');
  const activeSubjects = subjects.filter(s => !s.deleted_at);
  const activeChapters = chapters.filter(c => !c.deleted_at);
  const activeTasks = tasks.filter(t => !t.deleted_at);

  const subjectMap = new Map(activeSubjects.map(s => [s.id, s]));

  // Streaks
  const { currentStreak, bestStreak } = calculateStreaks(sessions);

  // Focus metrics
  const totalFocusSeconds = activeSessions.reduce((acc, s) => acc + s.actual_seconds, 0);
  const totalFocusHours = (totalFocusSeconds / 3600).toFixed(1);

  const completedSessions = activeSessions.filter(s => s.status === 'Completed');
  const avgSessionMins = completedSessions.length > 0 
    ? Math.round((completedSessions.reduce((sum, s) => sum + s.actual_seconds, 0) / completedSessions.length) / 60)
    : 0;

  // Last 7 days breakdown
  const last7Days: { dateStr: string; label: string; seconds: number; hours: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: 'short' });
    const daySecs = activeSessions
      .filter(s => s.start_at.slice(0, 10) === dateStr)
      .reduce((sum, s) => sum + s.actual_seconds, 0);

    last7Days.push({
      dateStr,
      label,
      seconds: daySecs,
      hours: Number((daySecs / 3600).toFixed(2))
    });
  }

  const maxDayHours = Math.max(1, ...last7Days.map(d => d.hours));

  // Subject-wise distribution
  const subjectDistribution: { id: string; name: string; colour: string; seconds: number; hours: string; percent: number }[] = [];
  for (const subj of activeSubjects) {
    const subjSecs = activeSessions
      .filter(s => s.subject_id === subj.id)
      .reduce((sum, s) => sum + s.actual_seconds, 0);
    
    if (subjSecs > 0) {
      subjectDistribution.push({
        id: subj.id,
        name: subj.name,
        colour: subj.colour,
        seconds: subjSecs,
        hours: (subjSecs / 3600).toFixed(1),
        percent: totalFocusSeconds > 0 ? Math.round((subjSecs / totalFocusSeconds) * 100) : 0
      });
    }
  }
  subjectDistribution.sort((a, b) => b.seconds - a.seconds);

  // Overall syllabus completion
  const totalChaptersCount = activeChapters.length;
  const completedChaptersCount = activeChapters.filter(c => c.status === 'Completed').length;
  const syllabusPercent = totalChaptersCount > 0 
    ? Math.round((completedChaptersCount / totalChaptersCount) * 100) 
    : 0;

  // CSV Report Generator
  const handleExportCSV = () => {
    let cutoffDate = '1970-01-01';
    const now = new Date();
    if (reportRange === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      cutoffDate = d.toISOString().slice(0, 10);
    } else if (reportRange === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      cutoffDate = d.toISOString().slice(0, 10);
    }

    const filteredReportSessions = activeSessions.filter(s => s.start_at.slice(0, 10) >= cutoffDate);

    // Escape CSV values
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'Session ID,Subject,Type,Planned Minutes,Actual Minutes,Start Time,End Time,Status,Notes\n';

    for (const s of filteredReportSessions) {
      const subj = s.subject_id ? subjectMap.get(s.subject_id)?.name : 'General';
      const actualMins = Math.round(s.actual_seconds / 60);
      csv += [
        escapeCsv(s.id),
        escapeCsv(subj),
        escapeCsv(s.type),
        escapeCsv(s.planned_minutes),
        escapeCsv(actualMins),
        escapeCsv(s.start_at),
        escapeCsv(s.end_at),
        escapeCsv(s.status),
        escapeCsv(s.notes || '')
      ].join(',') + '\n';
    }

    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `level-up-report-${reportRange}-${now.toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-500" />
            <span>Progress & Analytics</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Accurate study statistics, weekly trends, and exportable CSV reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={reportRange}
            onChange={(e) => setReportRange(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs shadow-md hover:opacity-90 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Total Focused</span>
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {totalFocusHours}h
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            across {activeSessions.length} sessions
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span>Avg Session</span>
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {avgSessionMins}m
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            completed focus bouts
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-500" />
            <span>Current Streak</span>
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {currentStreak}d
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            best historical: {bestStreak}d
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-purple-500" />
            <span>Syllabus Mastered</span>
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {syllabusPercent}%
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {completedChaptersCount}/{totalChaptersCount} chapters done
          </p>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Focus Time Bar Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              <span>Weekly Study Hours</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Last 7 Days</span>
          </div>

          <div className="h-52 flex items-end justify-between gap-2 pt-6 pb-2 px-2">
            {last7Days.map((day) => {
              const heightPercent = maxDayHours > 0 ? Math.max(8, (day.hours / maxDayHours) * 100) : 8;
              const isToday = day.dateStr === new Date().toISOString().slice(0, 10);

              return (
                <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition">
                    {day.hours}h
                  </span>
                  <div className="w-full max-w-[36px] bg-slate-100 dark:bg-slate-800 rounded-t-xl h-36 flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-t-xl transition-all duration-500 ${
                        isToday ? 'bg-emerald-500' : 'bg-emerald-600/70 dark:bg-emerald-500/50 group-hover:bg-emerald-500'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-semibold ${isToday ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subject-Wise Time Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-500" />
              <span>Subject Time Distribution</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">{subjectDistribution.length} active subjects</span>
          </div>

          {subjectDistribution.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No subject-linked study sessions yet.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {subjectDistribution.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.colour }} />
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      {item.hours}h ({item.percent}%)
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.percent}%`, backgroundColor: item.colour }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
