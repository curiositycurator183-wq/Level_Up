import React, { createContext, useContext, useEffect, useState } from 'react';
import { syncEngine, SyncStatus } from '../sync/syncEngine';
import { EntityName } from '../types';

interface SyncContextType {
  syncStatus: SyncStatus;
  syncNow: () => Promise<void>;
  enqueueMutation: (entity: EntityName, entityId: string, operation: 'UPSERT' | 'DELETE', data: any) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngine.getStatus());

  useEffect(() => {
    const unsubscribe = syncEngine.onStatusChange((newStatus) => {
      setSyncStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const syncNow = async () => {
    await syncEngine.syncNow();
  };

  const enqueueMutation = async (entity: EntityName, entityId: string, operation: 'UPSERT' | 'DELETE', data: any) => {
    await syncEngine.enqueueMutation(entity, entityId, operation, data);
  };

  return (
    <SyncContext.Provider value={{ syncStatus, syncNow, enqueueMutation }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a SyncProvider');
  return context;
};
