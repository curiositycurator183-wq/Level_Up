import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../context/AuthContext';
import { ACHIEVEMENTS_LIST, LevelInfo } from '../domain/gamification';
import { 
  Award, 
  Lock, 
  CheckCircle2, 
  Sparkles, 
  Flame, 
  Clock, 
  BookOpen, 
  Trophy, 
  GraduationCap, 
  Compass 
} from 'lucide-react';

interface AchievementsPageProps {
  levelInfo: LevelInfo;
}

export const AchievementsPage: React.FC<AchievementsPageProps> = ({ levelInfo }) => {
  const { user } = useAuth();

  const achievements = useLiveQuery(
    () => db.achievements.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const unlockedMap = new Map(achievements.filter(a => !a.deleted_at).map(a => [a.key, a]));
  const unlockedCount = unlockedMap.size;
  const totalCount = ACHIEVEMENTS_LIST.length;

  const iconMap: Record<string, any> = {
    Compass,
    BookOpen,
    Flame,
    Clock,
    GraduationCap,
    Trophy
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" />
            <span>Achievements & Badges</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Earn permanent accolades and bonus XP for study milestones.
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs font-bold text-amber-700 dark:text-amber-400">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>{unlockedCount} / {totalCount} Badges Unlocked</span>
        </div>
      </div>

      {/* Level Banner Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 text-2xl font-black shrink-0">
            {levelInfo.level}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Rank {levelInfo.level}
              </span>
              <span className="text-xs text-slate-400">• {levelInfo.totalXP} Total XP</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {levelInfo.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {levelInfo.nextLevelXP - levelInfo.currentLevelXP} XP remaining to reach Level {levelInfo.level + 1}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-48">
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
            <span>Progress</span>
            <span>{levelInfo.progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ACHIEVEMENTS_LIST.map((ach) => {
          const unlocked = unlockedMap.get(ach.key);
          const Icon = iconMap[ach.icon] || Trophy;

          return (
            <div
              key={ach.key}
              className={`p-5 rounded-3xl border transition shadow-sm relative overflow-hidden flex flex-col justify-between ${
                unlocked
                  ? 'bg-white dark:bg-slate-900 border-amber-200/80 dark:border-amber-900/50'
                  : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    unlocked
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    unlocked
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    +{ach.rewardXP} XP
                  </span>
                </div>

                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {ach.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {ach.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                {unlocked ? (
                  <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Unlocked {new Date(unlocked.unlocked_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-semibold text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Locked</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
