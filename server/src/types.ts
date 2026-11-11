export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  timezone: string;
  created_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  label: string;
  last_seen_at: string;
}

export type EntityType = 
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

export interface Mutation {
  operation_id: string;
  entity: EntityType;
  entity_id: string;
  operation: 'UPSERT' | 'DELETE';
  data: any;
  version: number;
}

export interface SyncPushPayload {
  device_id: string;
  mutations: Mutation[];
}

export interface SyncPullResponse {
  server_time: string;
  cursor: number;
  entities: {
    [key in EntityType]?: any[];
  };
}
