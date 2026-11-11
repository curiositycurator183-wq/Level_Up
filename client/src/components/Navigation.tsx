import React from 'react';
import { 
  Home, 
  BookOpen, 
  Calendar, 
  Clock, 
  BarChart3, 
  Award, 
  Settings, 
  CloudAlert, 
  CloudOff, 
  RefreshCw,
  Moon,
  Sun,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LevelInfo } from '../domain/gamification';

interface NavigationProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  levelInfo: LevelInfo;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, setCurrentTab, levelInfo }) => {
  const { syncStatus, syncNow } = useSync();
  const { user, logout } = useAuth();
  const { isDark, setTheme, theme } = useTheme();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'study', label: 'Study', icon: BookOpen },
    { id: 'planner', label: 'Planner', icon: Calendar },
    { id: 'focus', label: 'Focus', icon: Clock },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'achievements', label: 'Badges', icon: Award },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderSyncBadge = () => {
    switch (syncStatus) {
      case 'synced':
        return (
          <button 
            onClick={() => syncNow()}
            title="Data synced with server. Click to re-sync."
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800 transition hover:bg-emerald-100"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Synced</span>
          </button>
        );
      case 'syncing':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
            <span>Syncing</span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
            <CloudOff className="w-3 h-3 text-slate-400" />
            <span>Offline (Saved)</span>
          </div>
        );
      case 'pending':
        return (
          <button 
            onClick={() => syncNow()}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Pending Sync</span>
          </button>
        );
      case 'error':
        return (
          <button 
            onClick={() => syncNow()}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800"
          >
            <CloudAlert className="w-3 h-3 text-rose-500" />
            <span>Sync Alert</span>
          </button>
        );
    }
  };

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 font-black text-lg tracking-wider">
            ▲
          </div>
          <div>
            <h1 className="font-extrabold text-base md:text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              LEVEL UP
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-1 hidden sm:block">
              Study & Productivity
            </p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-3">
          {/* Level Pill */}
          <div 
            onClick={() => setCurrentTab('achievements')}
            className="cursor-pointer flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition border border-slate-200/60 dark:border-slate-700/60"
            title={`${levelInfo.currentLevelXP} / ${levelInfo.nextLevelXP} XP to Level ${levelInfo.level + 1}`}
          >
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Lv. {levelInfo.level}
            </span>
            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden hidden sm:block">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                style={{ width: `${levelInfo.progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {levelInfo.totalXP} XP
            </span>
          </div>

          {/* Sync indicator */}
          {renderSyncBadge()}

          {/* Dark mode switch */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Desktop Persistent Left Sidebar */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 hidden md:flex z-20">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  active
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.id === 'focus' && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                )}
              </button>
            );
          })}
        </div>

        {/* User profile footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {user?.display_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {user?.display_name || 'Scholar'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {levelInfo.title}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-2 py-1 md:hidden flex justify-around items-center safe-area-pb">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg text-xs font-medium transition ${
                active
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setCurrentTab('settings')}
          className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg text-xs font-medium transition ${
            currentTab === 'settings'
              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Settings</span>
        </button>
      </nav>
    </>
  );
};
