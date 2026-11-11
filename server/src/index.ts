import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

import app from './app.js';
import { verifyToken } from './auth.js';
import { userSockets } from './sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// --- WebSocket Realtime Handling ---
wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  const userId = user.id;
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(ws);

  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Realtime sync channel active' }));

  ws.on('close', () => {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        userSockets.delete(userId);
      }
    }
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch {
      // Ignore
    }
  });
});

// Serve frontend static build if client/dist exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`LEVEL UP Backend Server running on http://localhost:${PORT}`);
  console.log(`WebSocket Server active on ws://localhost:${PORT}/ws`);
});
