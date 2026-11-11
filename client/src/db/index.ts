import Dexie, { type Table } from 'dexie';
import { 
  Subject, 
  Chapter, 
  Topic, 
  Goal, 
  Task, 
  Exam, 
  Session, 
  XPEvent, 
  Achievement, 
  UserSettings, 
  SyncQueueItem 
} from '../types';

export interface SyncMeta {
  key: string;
  value: any;
}

export class LevelUpDatabase extends Dexie {
  subjects!: Table<Subject, string>;
  chapters!: Table<Chapter, string>;
  topics!: Table<Topic, string>;
  goals!: Table<Goal, string>;
  tasks!: Table<Task, string>;
  exams!: Table<Exam, string>;
  sessions!: Table<Session, string>;
  xp_events!: Table<XPEvent, string>;
  achievements!: Table<Achievement, string>;
  user_settings!: Table<UserSettings, string>;
  sync_queue!: Table<SyncQueueItem, number>;
  sync_meta!: Table<SyncMeta, string>;

  constructor() {
    super('level_up_local_db');

    this.version(1).stores({
      subjects: 'id, user_id, updated_at, deleted_at, priority',
      chapters: 'id, user_id, subject_id, status, deadline, sort_order, updated_at, deleted_at',
      topics: 'id, user_id, chapter_id, status, sort_order, updated_at, deleted_at',
      goals: 'id, user_id, period, type, status, updated_at, deleted_at',
      tasks: 'id, user_id, subject_id, chapter_id, due_at, priority, status, updated_at, deleted_at',
      exams: 'id, user_id, subject_id, exam_at, updated_at, deleted_at',
      sessions: 'id, user_id, subject_id, type, start_at, status, updated_at, deleted_at',
      xp_events: 'id, user_id, source_type, idempotency_key, created_at, deleted_at',
      achievements: 'id, user_id, key, unlocked_at, deleted_at',
      user_settings: 'user_id, updated_at',
      sync_queue: '++id, operation_id, entity, entity_id, created_at',
      sync_meta: 'key'
    });
  }
}

export const db = new LevelUpDatabase();
