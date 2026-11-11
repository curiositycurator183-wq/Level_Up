import { db } from './db.js';
import { Mutation, EntityType } from './types.js';
import { WebSocket } from 'ws';

// Map of userId -> Set of active WebSockets
export const userSockets = new Map<string, Set<WebSocket>>();

export function broadcastUserSync(userId: string, data: any) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    const payload = JSON.stringify(data);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

const TABLE_COLUMNS: Record<EntityType, string[]> = {
  subjects: ['id', 'user_id', 'name', 'colour', 'icon', 'priority', 'description', 'created_at', 'updated_at', 'version', 'deleted_at'],
  chapters: ['id', 'user_id', 'subject_id', 'title', 'status', 'notes', 'deadline', 'priority', 'sort_order', 'created_at', 'updated_at', 'version', 'deleted_at'],
  topics: ['id', 'user_id', 'chapter_id', 'title', 'status', 'notes', 'sort_order', 'created_at', 'updated_at', 'version', 'deleted_at'],
  goals: ['id', 'user_id', 'period', 'type', 'target', 'unit', 'subject_id', 'current_progress', 'status', 'created_at', 'updated_at', 'version', 'deleted_at'],
  tasks: ['id', 'user_id', 'title', 'description', 'subject_id', 'chapter_id', 'due_at', 'priority', 'status', 'estimated_minutes', 'created_at', 'updated_at', 'completed_at', 'version', 'deleted_at'],
  exams: ['id', 'user_id', 'subject_id', 'exam_at', 'exam_time', 'location', 'preparation_status', 'notes', 'created_at', 'updated_at', 'version', 'deleted_at'],
  sessions: ['id', 'user_id', 'subject_id', 'topic_id', 'type', 'planned_minutes', 'actual_seconds', 'start_at', 'end_at', 'status', 'notes', 'created_at', 'updated_at', 'version', 'deleted_at'],
  xp_events: ['id', 'user_id', 'source_type', 'source_id', 'amount', 'reason', 'idempotency_key', 'created_at', 'version', 'deleted_at'],
  achievements: ['id', 'user_id', 'key', 'unlocked_at', 'metadata', 'created_at', 'version', 'deleted_at'],
  user_settings: ['user_id', 'timezone', 'daily_target_minutes', 'theme', 'timer_focus_min', 'timer_short_break_min', 'timer_long_break_min', 'timer_long_break_interval', 'streak_min_minutes', 'show_xp', 'updated_at', 'version']
};

export async function processMutations(userId: string, mutations: Mutation[]): Promise<{ acknowledgedOperationIds: string[]; cursor: number }> {
  const ackIds: string[] = [];
  const now = new Date().toISOString();

  for (const mut of mutations) {
    const { operation_id, entity, entity_id, operation, data, version } = mut;

    // Check if this operation_id was already processed (idempotency check)
    const existingOp = await db.prepare('SELECT id FROM sync_ledger WHERE operation_id = ?').get(operation_id);
    if (existingOp) {
      ackIds.push(operation_id);
      continue;
    }

    const table = entity;
    const allowedCols = TABLE_COLUMNS[table];
    if (!allowedCols) continue;

    if (operation === 'DELETE') {
      // Soft-delete as tombstone
      if (table === 'user_settings') continue; // Don't delete settings

      const existingRecord = await db.prepare(`SELECT version FROM ${table} WHERE id = ? AND user_id = ?`).get(entity_id, userId) as any;
      if (existingRecord) {
        const nextVersion = Math.max(existingRecord.version + 1, version || 1);
        await db.prepare(`UPDATE ${table} SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
          .run(now, nextVersion, now, entity_id, userId);
      } else {
        // Record deleted item even if not present yet
        await db.prepare(`INSERT INTO ${table} (id, user_id, created_at, updated_at, version, deleted_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(entity_id, userId, now, now, version || 1, now);
      }
    } else {
      // UPSERT
      const existing = await db.prepare(
        table === 'user_settings' 
          ? `SELECT * FROM ${table} WHERE user_id = ?` 
          : `SELECT * FROM ${table} WHERE id = ? AND user_id = ?`
      ).get(table === 'user_settings' ? userId : entity_id, ...(table === 'user_settings' ? [] : [userId])) as any;

      if (existing && existing.version > version) {
        // Conflict: server version is strictly ahead.
        // We still acknowledge the mutation because server has the newer state
        ackIds.push(operation_id);
        continue;
      }

      const record = {
        created_at: now,
        updated_at: now,
        ...(existing || {}),
        ...data,
        user_id: userId
      };

      const colsToInsert = allowedCols.filter(col => record[col] !== undefined);
      const placeholders = colsToInsert.map(() => '?').join(', ');
      const values = colsToInsert.map(col => record[col]);

      const updateClauses = colsToInsert
        .filter(col => col !== 'id' && col !== 'user_id')
        .map(col => `${col} = excluded.${col}`)
        .join(', ');

      const conflictTarget = table === 'user_settings' ? '(user_id)' : '(id)';

      const sql = `
        INSERT INTO ${table} (${colsToInsert.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateClauses};
      `;

      try {
        await db.prepare(sql).run(...values);
      } catch (err: any) {
        console.error(`Error inserting into ${table}:`, err.message, record);
      }
    }

    // Record in sync ledger
    try {
      await db.prepare(`
        INSERT INTO sync_ledger (user_id, entity, entity_id, operation, payload, version, created_at, operation_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, entity, entity_id, operation, JSON.stringify(data || {}), version || 1, now, operation_id);
    } catch (err: any) {
      console.warn('Sync ledger insert error:', err.message);
    }

    ackIds.push(operation_id);
  }

  // Get current max ledger id as cursor
  const maxLedger = await db.prepare('SELECT MAX(id) as max_id FROM sync_ledger WHERE user_id = ?').get(userId) as any;
  const cursor = maxLedger?.max_id || 0;

  return { acknowledgedOperationIds: ackIds, cursor };
}

export async function pullChanges(userId: string, sinceCursor: number): Promise<{ cursor: number; entities: Record<EntityType, any[]> }> {
  const result: Record<EntityType, any[]> = {
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

  const currentMax = await db.prepare('SELECT MAX(id) as max_id FROM sync_ledger WHERE user_id = ?').get(userId) as any;
  const cursor = currentMax?.max_id || 0;

  if (sinceCursor === 0) {
    // Initial sync: fetch all active and tombstoned records
    for (const [entity, cols] of Object.entries(TABLE_COLUMNS) as [EntityType, string[]][]) {
      const records = await db.prepare(`SELECT ${cols.join(', ')} FROM ${entity} WHERE user_id = ?`).all(userId);
      result[entity] = records;
    }
  } else {
    // Delta sync: fetch records affected in ledger since cursor
    const changes = await db.prepare(`
      SELECT DISTINCT entity, entity_id 
      FROM sync_ledger 
      WHERE user_id = ? AND id > ?
    `).all(userId, sinceCursor) as { entity: EntityType; entity_id: string }[];

    for (const change of changes) {
      const cols = TABLE_COLUMNS[change.entity];
      if (!cols) continue;

      const record = await db.prepare(
        change.entity === 'user_settings'
          ? `SELECT ${cols.join(', ')} FROM ${change.entity} WHERE user_id = ?`
          : `SELECT ${cols.join(', ')} FROM ${change.entity} WHERE id = ? AND user_id = ?`
      ).get(change.entity === 'user_settings' ? userId : change.entity_id, ...(change.entity === 'user_settings' ? [] : [userId]));

      if (record) {
        result[change.entity].push(record);
      }
    }
  }

  return { cursor, entities: result };
}

export async function exportFullBackup(userId: string) {
  const user = await db.prepare('SELECT id, email, display_name, timezone, created_at FROM users WHERE id = ?').get(userId);
  const data: Record<string, any> = {
    schema_version: '1.0',
    exported_at: new Date().toISOString(),
    user,
    data: {}
  };

  for (const entity of Object.keys(TABLE_COLUMNS) as EntityType[]) {
    data.data[entity] = await db.prepare(`SELECT * FROM ${entity} WHERE user_id = ?`).all(userId);
  }

  return data;
}

export async function restoreFullBackup(userId: string, backup: any) {
  if (!backup || !backup.schema_version || !backup.data) {
    throw new Error('Invalid backup format');
  }

  // Transactionally restore
  await db.exec('BEGIN TRANSACTION;');
  try {
    for (const entity of Object.keys(TABLE_COLUMNS) as EntityType[]) {
      if (entity === 'user_settings') {
        await db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId);
      } else {
        await db.prepare(`DELETE FROM ${entity} WHERE user_id = ?`).run(userId);
      }

      const records = backup.data[entity] || [];
      const cols = TABLE_COLUMNS[entity];

      for (const rec of records) {
        const item = { ...rec, user_id: userId };
        const validCols = cols.filter(c => item[c] !== undefined);
        const placeholders = validCols.map(() => '?').join(', ');
        const values = validCols.map(c => item[c]);

        await db.prepare(`INSERT INTO ${entity} (${validCols.join(', ')}) VALUES (${placeholders})`).run(...values);
      }
    }

    await db.exec('COMMIT;');
  } catch (err) {
    await db.exec('ROLLBACK;');
    throw err;
  }
}

export async function resetUserData(userId: string) {
  await db.exec('BEGIN TRANSACTION;');
  try {
    for (const entity of Object.keys(TABLE_COLUMNS) as EntityType[]) {
      if (entity !== 'user_settings') {
        await db.prepare(`DELETE FROM ${entity} WHERE user_id = ?`).run(userId);
      }
    }
    await db.prepare('DELETE FROM sync_ledger WHERE user_id = ?').run(userId);
    await db.exec('COMMIT;');
  } catch (err) {
    await db.exec('ROLLBACK;');
    throw err;
  }
}
