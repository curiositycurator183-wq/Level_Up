export type Priority = 'Low' | 'Medium' | 'High';

export type ChapterStatus = 'Not Started' | 'In Progress' | 'Revision Required' | 'Needs Practice' | 'Completed';
export type TaskStatus = 'To Do' | 'In Progress' | 'Completed' | 'Cancelled';
export type GoalPeriod = 'daily' | 'weekly';
export type GoalType = 'time' | 'count' | 'completion';
export type GoalStatus = 'In Progress' | 'Completed' | 'Paused';
export type SessionType = 'Study' | 'Revision' | 'Practice' | 'Reading' | 'Custom';
export type SessionStatus = 'Completed' | 'Interrupted' | 'Abandoned';
export type ExamPrepStatus = 'Planning' | 'Underway' | 'Ready' | 'Completed';

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  colour: string;
  icon: string;
  priority: Priority;
  description?: string;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at?: string | null;
}

export interface Chapter {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  status: ChapterStatus;
  notes?: string;
  deadline?: string;
  priority: Priority;
  sort_order: number;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at?: string | null;
}

export interface Topic {
  id: string;
  user_id: string;
  chapter_id: string;
  title: string;
  status: ChapterStatus;
  notes?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at?: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  period: GoalPeriod;
  type: GoalType;
  target: number;
  unit: string;
  subject_id?: string;
  current_progress: number;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at?: string | null;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  subject_id?: string;
  chapter_id?: string;
  due_at?: string;
  priority: Priority;
  status: TaskStatus;
  estimated_minutes?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  version: number;
  deleted_at?: string | null;
}

export interface Exam {
  id: string;
  user_id: string;
  subject_id: string;
  exam_at: string; // YYYY-MM-DD
  exam_time?: string; // HH:mm
  location?: string;
  preparation_status: ExamPrepStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at?: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  subject_id?: string;
  topic_id?: string;
  type: SessionType;
  planned_minutes: number;
  actual_seconds: number;
  start_at: string;
  end_at: string;
  status: SessionStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at?: string | null;
}

export interface XPEvent {
  id: string;
  user_id: string;
  source_type: 'session' | 'chapter' | 'goal' | 'task' | 'subject' | 'achievement';
  source_id: string;
  amount: number;
  reason: string;
  idempotency_key: string;
  created_at: string;
  version: number;
  deleted_at?: string | null;
}

export interface Achievement {
  id: string;
  user_id: string;
  key: string;
  unlocked_at: string;
  metadata?: string;
  created_at: string;
  version: number;
  deleted_at?: string | null;
}

export interface UserSettings {
  user_id: string;
  timezone: string;
  daily_target_minutes: number;
  theme: 'light' | 'dark' | 'system';
  timer_focus_min: number;
  timer_short_break_min: number;
  timer_long_break_min: number;
  timer_long_break_interval: number;
  streak_min_minutes: number;
  show_xp: boolean;
  updated_at: string;
  version: number;
}

export type EntityName = 
  | 'subjects'
  | 'chapters'
  | 'topics'
  | 'goals'
  | 'tasks'
  | 'exams'
  | 'sessions'
  | 'xp_events'
  | 'achievements'
  | 'user_settings';

export interface SyncQueueItem {
  id?: number;
  operation_id: string;
  entity: EntityName;
  entity_id: string;
  operation: 'UPSERT' | 'DELETE';
  data: any;
  version: number;
  created_at: string;
  retry_count: number;
}
