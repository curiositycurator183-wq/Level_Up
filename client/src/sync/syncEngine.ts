import { db } from '../db';
import { EntityName, SyncQueueItem } from '../types';
import { safeJson } from '../utils/http';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending' | 'error';

export function getServerUrl(): string {
  const custom = localStorage.getItem('level_up_server_url');
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, '');
  }
  // Default to relative or current origin
  return '';
}

export function getWebSocketUrl(token: string): string {
  const custom = localStorage.getItem('level_up_server_url');
  if (custom && custom.trim()) {
    try {
      const u = new URL(custom.trim());
      const wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${u.host}/ws?token=${encodeURIComponent(token)}`;
    } catch {
      // Fallback below
    }
  }

  // If in capacitor native app and no custom server URL set, attempt standard host or localhost
  if (window.location.protocol === 'capacitor:' || window.location.hostname === 'localhost') {
    return `ws://localhost:3000/ws?token=${encodeURIComponent(token)}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;
}

class SyncEngine {
  private ws: WebSocket | null = null;
  private isSyncing = false;
  private syncStatus: SyncStatus = 'synced';
  private statusListeners = new Set<(status: SyncStatus) => void>();
  private pingInterval: any = null;

  public getStatus(): SyncStatus {
    return this.syncStatus;
  }

  public onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.syncStatus);
    return () => this.statusListeners.delete(callback);
  }

  private setStatus(status: SyncStatus) {
    if (this.syncStatus !== status) {
      this.syncStatus = status;
      for (const listener of this.statusListeners) {
        listener(status);
      }
    }
  }

  public init() {
    window.addEventListener('online', () => {
      this.syncNow();
      this.connectWebSocket();
    });

    window.addEventListener('offline', () => {
      this.setStatus('offline');
    });

    // Check online status initially
    if (!navigator.onLine) {
      this.setStatus('offline');
    }

    // Connect WebSocket if token exists
    this.connectWebSocket();

    // Periodic sync check every 25 seconds
    setInterval(() => {
      if (navigator.onLine && localStorage.getItem('level_up_token')) {
        this.syncNow();
      }
    }, 25000);
  }

  public connectWebSocket() {
    const token = localStorage.getItem('level_up_token');
    if (!token || !navigator.onLine) return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const wsUrl = getWebSocketUrl(token);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 20000);

        this.syncNow();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SYNC_UPDATE' || data.type === 'DATASET_RESTORED') {
            this.syncNow();
          }
        } catch {
          // Ignore
        }
      };

      this.ws.onclose = () => {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.ws = null;
        if (navigator.onLine && localStorage.getItem('level_up_token')) {
          setTimeout(() => this.connectWebSocket(), 4000);
        }
      };

      this.ws.onerror = () => {
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch {
      // Ignore
    }
  }

  public disconnectWebSocket() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public async enqueueMutation(entity: EntityName, entityId: string, operation: 'UPSERT' | 'DELETE', data: any) {
    const operationId = crypto.randomUUID();
    const now = new Date().toISOString();

    const queueItem: SyncQueueItem = {
      operation_id: operationId,
      entity,
      entity_id: entityId,
      operation,
      data,
      version: data.version || 1,
      created_at: now,
      retry_count: 0
    };

    await db.sync_queue.add(queueItem);

    if (!navigator.onLine) {
      this.setStatus('offline');
      return;
    }

    this.setStatus('pending');
    this.syncNow();
  }

  public async syncNow() {
    if (this.isSyncing) return;
    const token = localStorage.getItem('level_up_token');
    if (!token) return;

    if (!navigator.onLine) {
      this.setStatus('offline');
      return;
    }

    this.isSyncing = true;
    this.setStatus('syncing');

    const baseUrl = getServerUrl();

    try {
      const deviceId = localStorage.getItem('level_up_device_id') || 'dev_' + crypto.randomUUID();
      localStorage.setItem('level_up_device_id', deviceId);

      // 1. PUSH local outbox mutations to server
      const pendingMutations = await db.sync_queue.toArray();
      if (pendingMutations.length > 0) {
        const res = await fetch(`${baseUrl}/api/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            device_id: deviceId,
            mutations: pendingMutations.map(m => ({
              operation_id: m.operation_id,
              entity: m.entity,
              entity_id: m.entity_id,
              operation: m.operation,
              data: m.data,
              version: m.version
            }))
          })
        });

        if (res.ok) {
          const pushData = await safeJson(res);
          const ackIds: string[] = pushData.acknowledgedOperationIds || [];
          if (ackIds.length > 0) {
            await db.sync_queue.where('operation_id').anyOf(ackIds).delete();
          }
        } else if (res.status === 401) {
          localStorage.removeItem('level_up_token');
          this.disconnectWebSocket();
          this.setStatus('error');
          this.isSyncing = false;
          return;
        } else {
          throw new Error('Sync push server error');
        }
      }

      // 2. PULL remote changes from server
      const cursorMeta = await db.sync_meta.get('last_cursor');
      const cursor = cursorMeta ? Number(cursorMeta.value) || 0 : 0;

      const pullRes = await fetch(`${baseUrl}/api/sync/pull?cursor=${cursor}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (pullRes.ok) {
        const pullData = await safeJson(pullRes);
        const entities = pullData.entities || {};

        for (const [entityName, records] of Object.entries(entities) as [EntityName, any[]][]) {
          const table = (db as any)[entityName];
          if (!table || !Array.isArray(records) || records.length === 0) continue;

          for (const item of records) {
            const local = await table.get(entityName === 'user_settings' ? item.user_id : item.id);
            if (!local || (item.version >= (local.version || 0))) {
              await table.put(item);
            }
          }
        }

        if (pullData.cursor !== undefined) {
          await db.sync_meta.put({ key: 'last_cursor', value: pullData.cursor });
        }
      }

      const remaining = await db.sync_queue.count();
      if (remaining > 0) {
        this.setStatus('pending');
      } else {
        this.setStatus('synced');
      }
    } catch (err) {
      console.warn('Sync attempt failed:', err);
      if (!navigator.onLine) {
        this.setStatus('offline');
      } else {
        this.setStatus('pending');
      }
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncEngine = new SyncEngine();
