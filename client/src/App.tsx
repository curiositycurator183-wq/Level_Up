import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { ThemeProvider } from './context/ThemeContext';
import { TimerProvider } from './context/TimerContext';
import { Navigation } from './components/Navigation';
import { AuthModal } from './components/AuthModal';
import { calculateLevel, LevelInfo } from './domain/gamification';

import { HomeDashboard } from './pages/HomeDashboard';
import { SubjectsPage } from './pages/SubjectsPage';
import { PlannerPage } from './pages/PlannerPage';
import { FocusTimerPage } from './pages/FocusTimerPage';
import { ProgressAnalyticsPage } from './pages/ProgressAnalyticsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { SettingsPage } from './pages/SettingsPage';
import confetti from 'canvas-confetti';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('home');

  // Reactively query XP ledger
  const xpEvents = useLiveQuery(
    () => db.xp_events.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const totalXP = xpEvents
    .filter(e => !e.deleted_at)
    .reduce((sum, e) => sum + e.amount, 0);

  const levelInfo: LevelInfo = calculateLevel(totalXP);

  // Level up detection
  const prevLevelRef = useRef<number>(levelInfo.level);
  useEffect(() => {
    if (levelInfo.level > prevLevelRef.current) {
      // Level Up celebration!
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.5 }
      });
    }
    prevLevelRef.current = levelInfo.level;
  }, [levelInfo.level]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-xl animate-bounce">
            ▲
          </div>
          <span className="text-xs font-bold tracking-widest uppercase text-slate-400">
            LEVEL UP
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Navigation
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        levelInfo={levelInfo}
      />

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 pt-4 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
        {currentTab === 'home' && (
          <HomeDashboard setCurrentTab={setCurrentTab} levelInfo={levelInfo} />
        )}
        {currentTab === 'study' && <SubjectsPage />}
        {currentTab === 'planner' && <PlannerPage />}
        {currentTab === 'focus' && <FocusTimerPage />}
        {currentTab === 'progress' && <ProgressAnalyticsPage />}
        {currentTab === 'achievements' && <AchievementsPage levelInfo={levelInfo} />}
        {currentTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SyncProvider>
          <TimerProvider>
            <MainApp />
          </TimerProvider>
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
