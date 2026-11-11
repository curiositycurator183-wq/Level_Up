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
app.post('/api/auth/register', (req, res) => {
  const { email, password, display_name, timezone } = req.body;
  if (!email || !password || !display_name) {
    res.status(400).json({ error: 'Email, password, and display name are required' });
    return;
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(400).json({ error: 'An account with this email already exists' });
      return;
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();
    const tz = timezone || 'UTC';

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, timezone, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, passwordHash, display_name, tz, now);

    // Initialize default settings
    db.prepare(`
      INSERT INTO user_settings (user_id, timezone, daily_target_minutes, theme, updated_at, version)
      VALUES (?, ?, 120, 'system', ?, 1)
    `).run(userId, tz, now);

    const token = generateToken({ id: userId, email, display_name });
    res.json({
      token,
      user: { id: userId, email, display_name, timezone: tz, created_at: now }
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, device_label } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user || !comparePassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const deviceId = crypto.randomUUID();
    const now = new Date().toISOString();
    if (device_label) {
      db.prepare(`
        INSERT INTO devices (id, user_id, label, last_seen_at)
        VALUES (?, ?, ?, ?)
      `).run(deviceId, user.id, device_label, now);
    }

    const token = generateToken({ id: user.id, email: user.email, display_name: user.display_name });
    res.json({
      token,
      deviceId,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        timezone: user.timezone,
        created_at: user.created_at
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const user = db.prepare('SELECT id, email, display_name, timezone, created_at FROM users WHERE id = ?').get(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user });
});

// --- Sync Routes ---
app.post('/api/sync/push', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { mutations, device_id } = req.body;

  if (!Array.isArray(mutations)) {
    res.status(400).json({ error: 'Mutations array required' });
    return;
  }

  try {
    const { acknowledgedOperationIds, cursor } = processMutations(userId, mutations);

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

app.get('/api/sync/pull', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const sinceCursor = parseInt((req.query.cursor as string) || '0', 10);

  try {
    const { cursor, entities } = pullChanges(userId, sinceCursor);
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
app.get('/api/devices', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const devices = db.prepare('SELECT id, label, last_seen_at FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC').all(userId);
  res.json({ devices });
});

// --- Backup & Restore ---
app.get('/api/backup', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const backup = exportFullBackup(userId);
    res.setHeader('Content-Disposition', `attachment; filename="level-up-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Backup export failed' });
  }
});

app.post('/api/backup/restore', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { backup } = req.body;

  try {
    restoreFullBackup(userId, backup);
    broadcastUserSync(userId, { type: 'DATASET_RESTORED', timestamp: Date.now() });
    res.json({ message: 'Backup restored successfully' });
  } catch (err: any) {
    console.error('Restore error:', err);
    res.status(400).json({ error: err.message || 'Backup restore failed' });
  }
});

// --- Destructive Reset ---
app.post('/api/reset', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { confirmation } = req.body;

  if (confirmation !== 'DELETE ALL MY DATA') {
    res.status(400).json({ error: 'Please type "DELETE ALL MY DATA" to confirm' });
    return;
  }

  try {
    resetUserData(userId);
    broadcastUserSync(userId, { type: 'DATASET_RESET', timestamp: Date.now() });
    res.json({ message: 'All user data has been reset' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Reset failed' });
  }
});

export default app;
