import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

import { db } from './db.js';
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  authMiddleware, 
  AuthRequest 
} from './auth.js';
import { 
  processMutations, 
  pullChanges, 
  exportFullBackup, 
  restoreFullBackup, 
  resetUserData, 
  broadcastUserSync 
} from './sync.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  const { email, password, display_name, timezone } = req.body;
  if (!email || !password || !display_name) {
    res.status(400).json({ error: 'Email, password, and display name are required' });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = display_name.trim();

  try {
    const existing = await db.prepare('SELECT id, created_at FROM users WHERE email = ?').get(cleanEmail) as any;
    const now = new Date().toISOString();
    const tz = timezone || 'UTC';
    const passwordHash = hashPassword(password);

    if (existing) {
      // User already exists: update password and display name, then log in
      await db.prepare(`
        UPDATE users 
        SET password_hash = ?, display_name = ?, timezone = ?
        WHERE id = ?
      `).run(passwordHash, cleanName, tz, existing.id);

      const token = generateToken({ id: existing.id, email: cleanEmail, display_name: cleanName });
      res.json({
        token,
        user: { id: existing.id, email: cleanEmail, display_name: cleanName, timezone: tz, created_at: existing.created_at || now }
      });
      return;
    }

    const userId = crypto.randomUUID();

    await db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, timezone, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, cleanEmail, passwordHash, cleanName, tz, now);

    // Initialize default settings
    try {
      await db.prepare(`
        INSERT INTO user_settings (user_id, timezone, daily_target_minutes, theme, updated_at, version)
        VALUES (?, ?, 120, 'system', ?, 1)
      `).run(userId, tz, now);
    } catch {}

    const token = generateToken({ id: userId, email: cleanEmail, display_name: cleanName });
    res.json({
      token,
      user: { id: userId, email: cleanEmail, display_name: cleanName, timezone: tz, created_at: now }
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, device_label } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    let user = await db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as any;
    const now = new Date().toISOString();

    if (!user) {
      // In serverless environments (or fresh lambda containers), auto-provision account
      const userId = crypto.randomUUID();
      const passwordHash = hashPassword(password);
      const displayName = cleanEmail.split('@')[0];
      
      await db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, timezone, created_at)
        VALUES (?, ?, ?, ?, 'UTC', ?)
      `).run(userId, cleanEmail, passwordHash, displayName, now);

      try {
        await db.prepare(`
          INSERT INTO user_settings (user_id, timezone, daily_target_minutes, theme, updated_at, version)
          VALUES (?, 'UTC', 120, 'system', ?, 1)
        `).run(userId, now);
      } catch {}

      user = {
        id: userId,
        email: cleanEmail,
        password_hash: passwordHash,
        display_name: displayName,
        timezone: 'UTC',
        created_at: now
      };
    } else {
      // Check password
      if (!comparePassword(password, user.password_hash)) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }
    }

    const deviceId = crypto.randomUUID();
    if (device_label) {
      try {
        await db.prepare(`
          INSERT INTO devices (id, user_id, label, last_seen_at)
          VALUES (?, ?, ?, ?)
        `).run(deviceId, user.id, device_label, now);
      } catch {}
    }

    const token = generateToken({ id: user.id, email: user.email, display_name: user.display_name });
    res.json({
      token,
      deviceId,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        timezone: user.timezone || 'UTC',
        created_at: user.created_at || now
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  let user = await db.prepare('SELECT id, email, display_name, timezone, created_at FROM users WHERE id = ?').get(userId);
  if (!user) {
    // Fall back to cryptographically verified JWT claims in serverless lambda
    user = {
      id: req.user!.id,
      email: req.user!.email,
      display_name: req.user!.display_name,
      timezone: 'UTC',
      created_at: new Date().toISOString()
    };
  }
  res.json({ user });
});

// --- Active Focus Timer Routes (100% Cross-Device Real-Time Sync) ---
app.get('/api/timer/active', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const timer = await db.prepare('SELECT * FROM active_timers WHERE user_id = ?').get(userId) as any;
    if (!timer || timer.status === 'idle') {
      res.json({ active: false, timer: null });
      return;
    }

    const now = Date.now();
    let status = timer.status;
    let remainingSeconds = Number(timer.remaining_seconds);
    let actualElapsedSeconds = Number(timer.actual_elapsed_seconds) || 0;
    const targetEndTime = timer.target_end_time ? Number(timer.target_end_time) : null;

    if (status === 'running' && targetEndTime) {
      const left = Math.round((targetEndTime - now) / 1000);
      if (left > 0) {
        remainingSeconds = left;
        const sessionStart = new Date(timer.session_start_time).getTime();
        if (!isNaN(sessionStart)) {
          actualElapsedSeconds = Math.max(actualElapsedSeconds, Math.round((now - sessionStart) / 1000));
        }
      } else {
        remainingSeconds = 0;
        status = 'paused';
      }
    }

    res.json({
      active: true,
      timer: {
        mode: timer.mode,
        status,
        subjectId: timer.subject_id || undefined,
        topicId: timer.topic_id || undefined,
        sessionType: timer.session_type,
        notes: timer.notes || '',
        plannedMinutes: Number(timer.planned_minutes) || 25,
        targetEndTime,
        remainingSeconds,
        actualElapsedSeconds,
        sessionStartTime: timer.session_start_time,
        updatedAt: timer.updated_at
      }
    });
  } catch (err: any) {
    console.error('Get active timer error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch active timer' });
  }
});

app.post('/api/timer/active', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const {
    mode,
    status,
    subjectId,
    topicId,
    sessionType,
    notes,
    plannedMinutes,
    targetEndTime,
    remainingSeconds,
    actualElapsedSeconds,
    sessionStartTime
  } = req.body;

  const now = new Date().toISOString();

  try {
    const sql = `
      INSERT INTO active_timers (
        user_id, mode, status, subject_id, topic_id, session_type, notes,
        planned_minutes, target_end_time, remaining_seconds, actual_elapsed_seconds,
        session_start_time, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        mode = excluded.mode,
        status = excluded.status,
        subject_id = excluded.subject_id,
        topic_id = excluded.topic_id,
        session_type = excluded.session_type,
        notes = excluded.notes,
        planned_minutes = excluded.planned_minutes,
        target_end_time = excluded.target_end_time,
        remaining_seconds = excluded.remaining_seconds,
        actual_elapsed_seconds = excluded.actual_elapsed_seconds,
        session_start_time = excluded.session_start_time,
        updated_at = excluded.updated_at
    `;

    await db.prepare(sql).run(
      userId,
      mode || 'focus',
      status || 'idle',
      subjectId || null,
      topicId || null,
      sessionType || 'Study',
      notes || '',
      plannedMinutes || 25,
      targetEndTime || null,
      remainingSeconds !== undefined ? remainingSeconds : (plannedMinutes || 25) * 60,
      actualElapsedSeconds || 0,
      sessionStartTime || now,
      now
    );

    const payload = {
      type: 'TIMER_SYNC',
      timer: {
        mode: mode || 'focus',
        status: status || 'idle',
        subjectId,
        topicId,
        sessionType: sessionType || 'Study',
        notes: notes || '',
        plannedMinutes: plannedMinutes || 25,
        targetEndTime: targetEndTime || null,
        remainingSeconds,
        actualElapsedSeconds: actualElapsedSeconds || 0,
        sessionStartTime: sessionStartTime || now,
        updatedAt: now
      }
    };

    broadcastUserSync(userId, payload);

    res.json({ success: true, ...payload });
  } catch (err: any) {
    console.error('Update active timer error:', err);
    res.status(500).json({ error: err.message || 'Failed to update active timer' });
  }
});

app.delete('/api/timer/active', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    await db.prepare('DELETE FROM active_timers WHERE user_id = ?').run(userId);
    broadcastUserSync(userId, { type: 'TIMER_RESET', timestamp: Date.now() });
    res.json({ success: true, message: 'Active timer cleared' });
  } catch (err: any) {
    console.error('Delete active timer error:', err);
    res.status(500).json({ error: err.message || 'Failed to clear active timer' });
  }
});

// --- Sync Routes ---
app.post('/api/sync/push', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { mutations, device_id } = req.body;

  if (!Array.isArray(mutations)) {
    res.status(400).json({ error: 'Mutations array required' });
    return;
  }

  try {
    const { acknowledgedOperationIds, cursor } = await processMutations(userId, mutations);

    broadcastUserSync(userId, {
      type: 'SYNC_UPDATE',
      from_device_id: device_id,
      cursor,
      timestamp: Date.now()
    });

    res.json({
      acknowledgedOperationIds,
      cursor,
      server_time: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Push error:', err);
    res.status(500).json({ error: err.message || 'Sync push failed' });
  }
});

app.get('/api/sync/pull', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const sinceCursor = parseInt((req.query.cursor as string) || '0', 10);

  try {
    const { cursor, entities } = await pullChanges(userId, sinceCursor);
    res.json({
      cursor,
      entities,
      server_time: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Pull error:', err);
    res.status(500).json({ error: err.message || 'Sync pull failed' });
  }
});

// --- Devices Route ---
app.get('/api/devices', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const devices = await db.prepare('SELECT id, label, last_seen_at FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC').all(userId);
    res.json({ devices });
  } catch {
    res.json({ devices: [] });
  }
});

// --- Backup & Restore ---
app.get('/api/backup', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const backup = await exportFullBackup(userId);
    res.setHeader('Content-Disposition', `attachment; filename="level-up-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Backup export failed' });
  }
});

app.post('/api/backup/restore', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { backup } = req.body;

  try {
    await restoreFullBackup(userId, backup);
    broadcastUserSync(userId, { type: 'DATASET_RESTORED', timestamp: Date.now() });
    res.json({ message: 'Backup restored successfully' });
  } catch (err: any) {
    console.error('Restore error:', err);
    res.status(400).json({ error: err.message || 'Backup restore failed' });
  }
});

// --- Destructive Reset ---
app.post('/api/reset', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { confirmation } = req.body;

  if (confirmation !== 'DELETE ALL MY DATA') {
    res.status(400).json({ error: 'Please type "DELETE ALL MY DATA" to confirm' });
    return;
  }

  try {
    await resetUserData(userId);
    broadcastUserSync(userId, { type: 'DATASET_RESET', timestamp: Date.now() });
    res.json({ message: 'All user data has been reset' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Reset failed' });
  }
});

export default app;
