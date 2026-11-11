import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel 
  ? '/tmp' 
  : (process.env.DATA_DIR || path.resolve(__dirname, '../data'));

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

const DB_PATH = path.join(DATA_DIR, 'level_up.sqlite');

let nativeDb: any = null;
try {
  const sqlite = require('node:sqlite');
  if (sqlite && sqlite.DatabaseSync) {
    nativeDb = new sqlite.DatabaseSync(DB_PATH);
    if (!isVercel) {
      try {
        nativeDb.exec('PRAGMA journal_mode = WAL;');
      } catch {}
    }
    nativeDb.exec('PRAGMA foreign_keys = ON;');
  }
} catch (err: any) {
  console.log('node:sqlite not available, using universal JSON storage fallback:', err.message);
}

// Universal JSON/In-Memory fallback storage for environments lacking node:sqlite
class JsonStore {
  private dataFile: string;
  public tables: Record<string, any[]> = {
    users: [],
    devices: [],
    sync_ledger: [],
    subjects: [],
    chapters: [],
    topics: [],
    goals: [],
    tasks: [],
    exams: [],
    sessions: [],
    xp_events: [],
    achievements: [],
    user_settings: []
  };

  constructor(filePath: string) {
    this.dataFile = filePath;
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const content = fs.readFileSync(this.dataFile, 'utf8');
        const parsed = JSON.parse(content);
        this.tables = { ...this.tables, ...parsed };
      }
    } catch {}
  }

  private save() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.tables, null, 2), 'utf8');
    } catch {}
  }

  public exec(sql: string) {
    // schema creation is handled in memory tables
  }

  public prepare(sql: string) {
    const trimmed = sql.trim().replace(/\s+/g, ' ');
    const self = this;

    return {
      get(...args: any[]) {
        const allResults = self.query(trimmed, args);
        return allResults[0] || null;
      },
      all(...args: any[]) {
        return self.query(trimmed, args);
      },
      run(...args: any[]) {
        self.executeStatement(trimmed, args);
        return { changes: 1 };
      }
    };
  }

  private query(sql: string, params: any[]): any[] {
    const lower = sql.toLowerCase();

    // SELECT id FROM users WHERE email = ?
    if (lower.includes('from users where email = ?')) {
      const email = params[0];
      const u = this.tables.users.find(x => x.email === email);
      return u ? [u] : [];
    }

    // SELECT id, email, display_name, timezone, created_at FROM users WHERE id = ?
    if (lower.includes('from users where id = ?')) {
      const id = params[0];
      const u = this.tables.users.find(x => x.id === id);
      return u ? [u] : [];
    }

    // SELECT version FROM table WHERE ...
    const versionMatch = sql.match(/SELECT version FROM (\w+) WHERE id = \? AND user_id = \?/i);
    if (versionMatch) {
      const table = versionMatch[1];
      const [id, userId] = params;
      const rec = (this.tables[table] || []).find(x => x.id === id && x.user_id === userId);
      return rec ? [{ version: rec.version }] : [];
    }

    // SELECT version FROM user_settings WHERE user_id = ?
    if (lower.includes('from user_settings where user_id = ?')) {
      const userId = params[0];
      const s = (this.tables.user_settings || []).find(x => x.user_id === userId);
      return s ? [s] : [];
    }

    // SELECT MAX(id) as max_id FROM sync_ledger WHERE user_id = ?
    if (lower.includes('from sync_ledger where user_id = ?')) {
      const userId = params[0];
      const ledger = (this.tables.sync_ledger || []).filter(x => x.user_id === userId);
      const maxId = ledger.reduce((max, x) => Math.max(max, x.id || 0), 0);
      return [{ max_id: maxId }];
    }

    // SELECT DISTINCT entity, entity_id FROM sync_ledger WHERE user_id = ? AND id > ?
    if (lower.includes('select distinct entity, entity_id from sync_ledger')) {
      const [userId, cursor] = params;
      const changes = (this.tables.sync_ledger || [])
        .filter(x => x.user_id === userId && x.id > cursor);
      const map = new Map();
      for (const ch of changes) {
        map.set(`${ch.entity}_${ch.entity_id}`, { entity: ch.entity, entity_id: ch.entity_id });
      }
      return Array.from(map.values());
    }

    // SELECT id FROM sync_ledger WHERE operation_id = ?
    if (lower.includes('from sync_ledger where operation_id = ?')) {
      const opId = params[0];
      const item = (this.tables.sync_ledger || []).find(x => x.operation_id === opId);
      return item ? [item] : [];
    }

    // SELECT * FROM entity WHERE user_id = ?
    const allMatch = sql.match(/SELECT ([\w\s,\*]+) FROM (\w+) WHERE user_id = \?/i);
    if (allMatch) {
      const table = allMatch[2];
      const userId = params[0];
      return (this.tables[table] || []).filter(x => x.user_id === userId);
    }

    // SELECT * FROM entity WHERE id = ? AND user_id = ?
    const singleMatch = sql.match(/SELECT ([\w\s,\*]+) FROM (\w+) WHERE id = \? AND user_id = \?/i);
    if (singleMatch) {
      const table = singleMatch[2];
      const [id, userId] = params;
      const item = (this.tables[table] || []).find(x => x.id === id && x.user_id === userId);
      return item ? [item] : [];
    }

    // Fallback: search by table
    for (const tableName of Object.keys(this.tables)) {
      if (lower.includes(`from ${tableName}`)) {
        if (params.length > 0) {
          return (this.tables[tableName] || []).filter(x => x.user_id === params[0] || x.id === params[0]);
        }
        return this.tables[tableName] || [];
      }
    }

    return [];
  }

  private executeStatement(sql: string, params: any[]) {
    const lower = sql.toLowerCase();

    // INSERT INTO users
    if (lower.startsWith('insert into users')) {
      const [id, email, password_hash, display_name, timezone, created_at] = params;
      this.tables.users.push({ id, email, password_hash, display_name, timezone, created_at });
      this.save();
      return;
    }

    // INSERT INTO user_settings
    if (lower.startsWith('insert into user_settings')) {
      const [user_id, timezone, daily_target_minutes, theme, updated_at, version] = params;
      const existingIdx = this.tables.user_settings.findIndex(x => x.user_id === user_id);
      const record = { user_id, timezone, daily_target_minutes, theme, updated_at, version };
      if (existingIdx >= 0) {
        this.tables.user_settings[existingIdx] = record;
      } else {
        this.tables.user_settings.push(record);
      }
      this.save();
      return;
    }

    // INSERT INTO devices
    if (lower.startsWith('insert into devices')) {
      const [id, user_id, label, last_seen_at] = params;
      this.tables.devices.push({ id, user_id, label, last_seen_at });
      this.save();
      return;
    }

    // INSERT INTO sync_ledger
    if (lower.startsWith('insert into sync_ledger')) {
      const [user_id, entity, entity_id, operation, payload, version, created_at, operation_id] = params;
      const maxId = (this.tables.sync_ledger || []).reduce((max, x) => Math.max(max, x.id || 0), 0);
      this.tables.sync_ledger.push({
        id: maxId + 1,
        user_id,
        entity,
        entity_id,
        operation,
        payload,
        version,
        created_at,
        operation_id
      });
      this.save();
      return;
    }

    // UPDATE table SET deleted_at = ...
    const updateDelMatch = sql.match(/UPDATE (\w+) SET deleted_at = \?, version = \?, updated_at = \? WHERE id = \? AND user_id = \?/i);
    if (updateDelMatch) {
      const table = updateDelMatch[1];
      const [deleted_at, version, updated_at, id, user_id] = params;
      const rec = (this.tables[table] || []).find(x => x.id === id && x.user_id === user_id);
      if (rec) {
        rec.deleted_at = deleted_at;
        rec.version = version;
        rec.updated_at = updated_at;
      }
      this.save();
      return;
    }

    // INSERT INTO table (cols) VALUES (...) ON CONFLICT ...
    const insertMatch = sql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const table = insertMatch[1];
      const cols = insertMatch[2].split(',').map(c => c.trim());
      const rec: any = {};
      cols.forEach((col, idx) => {
        rec[col] = params[idx];
      });

      if (!this.tables[table]) this.tables[table] = [];

      const keyField = table === 'user_settings' ? 'user_id' : 'id';
      const existingIdx = this.tables[table].findIndex(x => x[keyField] === rec[keyField]);
      if (existingIdx >= 0) {
        this.tables[table][existingIdx] = { ...this.tables[table][existingIdx], ...rec };
      } else {
        this.tables[table].push(rec);
      }
      this.save();
      return;
    }

    // DELETE FROM table WHERE user_id = ?
    const delMatch = sql.match(/DELETE FROM (\w+) WHERE user_id = \?/i);
    if (delMatch) {
      const table = delMatch[1];
      const userId = params[0];
      if (this.tables[table]) {
        this.tables[table] = this.tables[table].filter(x => x.user_id !== userId);
      }
      this.save();
      return;
    }
  }
}

export const db: any = nativeDb || new JsonStore(path.join(DATA_DIR, 'level_up_store.json'));

// Create tables if nativeDb
if (nativeDb) {
  nativeDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      operation_id TEXT UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_sync_ledger_user_id ON sync_ledger(user_id, id);

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      colour TEXT NOT NULL,
      icon TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium',
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Not Started',
      notes TEXT,
      deadline TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Not Started',
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      period TEXT NOT NULL,
      type TEXT NOT NULL,
      target INTEGER NOT NULL,
      unit TEXT NOT NULL,
      subject_id TEXT,
      current_progress INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'In Progress',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      subject_id TEXT,
      chapter_id TEXT,
      due_at TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'To Do',
      estimated_minutes INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      exam_at TEXT NOT NULL,
      exam_time TEXT,
      location TEXT,
      preparation_status TEXT NOT NULL DEFAULT 'Planning',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT,
      topic_id TEXT,
      type TEXT NOT NULL DEFAULT 'Study',
      planned_minutes INTEGER NOT NULL,
      actual_seconds INTEGER NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Completed',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS xp_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      unlocked_at TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      UNIQUE(user_id, key),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      daily_target_minutes INTEGER NOT NULL DEFAULT 120,
      theme TEXT NOT NULL DEFAULT 'system',
      timer_focus_min INTEGER NOT NULL DEFAULT 25,
      timer_short_break_min INTEGER NOT NULL DEFAULT 5,
      timer_long_break_min INTEGER NOT NULL DEFAULT 15,
      timer_long_break_interval INTEGER NOT NULL DEFAULT 4,
      streak_min_minutes INTEGER NOT NULL DEFAULT 20,
      show_xp INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}
