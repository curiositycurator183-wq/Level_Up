import { db } from '../db';
import { XPEvent, Achievement, Session } from '../types';

export interface LevelInfo {
  level: number;
  title: string;
  totalXP: number;
  currentLevelXP: number;
  nextLevelXP: number;
  progressPercent: number;
}

const LEVEL_TITLES = [
  "Novice Scholar",
  "Dedicated Apprentice",
  "Focused Practitioner",
  "Knowledge Seeker",
  "Academic Warrior",
  "Master of Focus",
  "Sage of Discipline",
  "Grandmaster",
  "Ascendant Scholar",
  "Legendary Paragon"
];

// Returns the total XP required to reach a specific level
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  // Level 2: 100
  // Level 3: 250 (100 + 150)
  // Level 4: 450 (250 + 200)
  // Level 5: 700 (450 + 250)
  return Math.floor(50 * (level - 1) * (level + 2));
}

export function calculateLevel(totalXP: number): LevelInfo {
  let level = 1;
  while (totalXP >= xpRequiredForLevel(level + 1)) {
    level++;
  }

  const baseXP = xpRequiredForLevel(level);
  const nextXP = xpRequiredForLevel(level + 1);
  const span = nextXP - baseXP;
  const currentLevelXP = Math.max(0, totalXP - baseXP);
  const progressPercent = span > 0 ? Math.min(100, Math.round((currentLevelXP / span) * 100)) : 100;
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

  return {
    level,
    title,
    totalXP,
    currentLevelXP,
    nextLevelXP: nextXP - baseXP,
    progressPercent
  };
}

export async function awardXP(
  userId: string,
  sourceType: XPEvent['source_type'],
  sourceId: string,
  amount: number,
  reason: string,
  idempotencyKey: string,
  enqueueMutation: (entity: any, entityId: string, op: any, data: any) => Promise<void>
): Promise<boolean> {
  // Idempotency check: verify if an XP event with this idempotency key already exists
  const existing = await db.xp_events.where('idempotency_key').equals(idempotencyKey).first();
  if (existing) {
    return false; // Already awarded!
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const xpEvent: XPEvent = {
    id,
    user_id: userId,
    source_type: sourceType,
    source_id: sourceId,
    amount,
    reason,
    idempotency_key: idempotencyKey,
    created_at: now,
    version: 1
  };

  await db.xp_events.put(xpEvent);
  await enqueueMutation('xp_events', id, 'UPSERT', xpEvent);
  return true;
}

export function calculateStreaks(sessions: Session[], streakMinMinutes: number = 20): { currentStreak: number; bestStreak: number; todayMinutes: number } {
  const minSeconds = streakMinMinutes * 60;
  
  // Group actual focus seconds by YYYY-MM-DD
  const daysMap = new Map<string, number>();
  for (const s of sessions) {
    if (s.deleted_at || s.status === 'Abandoned') continue;
    const day = s.start_at.slice(0, 10);
    daysMap.set(day, (daysMap.get(day) || 0) + (s.actual_seconds || 0));
  }

  // Today in local YYYY-MM-DD
  const now = new Date();
  const formatDay = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = formatDay(now);

  const todayMinutes = Math.floor((daysMap.get(todayStr) || 0) / 60);

  // Check qualifying days in sorted order
  const qualifyingDays = new Set<string>();
  for (const [day, secs] of daysMap.entries()) {
    if (secs >= minSeconds) {
      qualifyingDays.add(day);
    }
  }

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = new Date();
  
  // If today hasn't met the threshold yet, start checking from yesterday
  if (!qualifyingDays.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dStr = formatDay(checkDate);
    if (qualifyingDays.has(dStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate all-time best streak
  const sortedDays = Array.from(qualifyingDays).sort();
  let bestStreak = 0;
  let runningStreak = 0;
  let lastDate: Date | null = null;

  for (const dStr of sortedDays) {
    const curDate = new Date(dStr);
    if (!lastDate) {
      runningStreak = 1;
    } else {
      const diffMs = curDate.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
    }
    lastDate = curDate;
    if (runningStreak > bestStreak) {
      bestStreak = runningStreak;
    }
  }

  return {
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak),
    todayMinutes
  };
}

export const ACHIEVEMENTS_LIST = [
  {
    key: 'first_session',
    title: 'First Step',
    description: 'Complete your first study session of at least 10 minutes.',
    icon: 'Compass',
    rewardXP: 25
  },
  {
    key: 'first_chapter',
    title: 'Chapter Master',
    description: 'Complete all syllabus items in your first chapter.',
    icon: 'BookOpen',
    rewardXP: 25
  },
  {
    key: 'streak_5',
    title: 'Unstoppable Momentum',
    description: 'Achieve a 5-day continuous study streak.',
    icon: 'Flame',
    rewardXP: 50
  },
  {
    key: 'focus_10h',
    title: 'Deep Work Devotee',
    description: 'Accumulate 10 total hours of focused study time.',
    icon: 'Clock',
    rewardXP: 100
  },
  {
    key: 'complete_subject',
    title: 'Curriculum Conquered',
    description: 'Complete 100% of all chapters in a subject.',
    icon: 'GraduationCap',
    rewardXP: 100
  },
  {
    key: 'weekly_target',
    title: 'Weekly Champion',
    description: 'Hit your total weekly target study hours.',
    icon: 'Trophy',
    rewardXP: 50
  }
];

export async function checkAndUnlockAchievements(
  userId: string,
  enqueueMutation: (entity: any, entityId: string, op: any, data: any) => Promise<void>,
  onUnlock?: (achievement: any) => void
) {
  const unlocked = await db.achievements.where('user_id').equals(userId).toArray();
  const unlockedKeys = new Set(unlocked.filter(a => !a.deleted_at).map(a => a.key));

  const sessions = await db.sessions.where('user_id').equals(userId).toArray();
  const chapters = await db.chapters.where('user_id').equals(userId).toArray();
  const subjects = await db.subjects.where('user_id').equals(userId).toArray();

  const totalFocusSeconds = sessions
    .filter(s => !s.deleted_at && s.status === 'Completed')
    .reduce((sum, s) => sum + s.actual_seconds, 0);

  const { currentStreak, bestStreak } = calculateStreaks(sessions);

  for (const ach of ACHIEVEMENTS_LIST) {
    if (unlockedKeys.has(ach.key)) continue;

    let conditionMet = false;

    if (ach.key === 'first_session') {
      conditionMet = sessions.some(s => !s.deleted_at && s.status === 'Completed' && s.actual_seconds >= 600);
    } else if (ach.key === 'first_chapter') {
      conditionMet = chapters.some(c => !c.deleted_at && c.status === 'Completed');
    } else if (ach.key === 'streak_5') {
      conditionMet = Math.max(currentStreak, bestStreak) >= 5;
    } else if (ach.key === 'focus_10h') {
      conditionMet = totalFocusSeconds >= 36000;
    } else if (ach.key === 'complete_subject') {
      for (const subj of subjects.filter(s => !s.deleted_at)) {
        const subjChapters = chapters.filter(c => !c.deleted_at && c.subject_id === subj.id);
        if (subjChapters.length > 0 && subjChapters.every(c => c.status === 'Completed')) {
          conditionMet = true;
          break;
        }
      }
    }

    if (conditionMet) {
      const achId = crypto.randomUUID();
      const now = new Date().toISOString();
      const newAch: Achievement = {
        id: achId,
        user_id: userId,
        key: ach.key,
        unlocked_at: now,
        created_at: now,
        version: 1
      };
      await db.achievements.put(newAch);
      await enqueueMutation('achievements', achId, 'UPSERT', newAch);
      
      // Award achievement XP
      await awardXP(
        userId,
        'achievement',
        achId,
        ach.rewardXP,
        `Achievement Unlocked: ${ach.title}`,
        `ach_${ach.key}_${userId}`,
        enqueueMutation
      );

      if (onUnlock) {
        onUnlock(ach);
      }
    }
  }
}
