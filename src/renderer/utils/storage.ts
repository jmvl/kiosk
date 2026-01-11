/**
 * IndexedDB storage utilities for offline queue
 * Story 3.1: IndexedDB Offline Queue
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface SyncRecord {
  id?: number;
  timestamp: number;
  type: 'game-result' | 'ad-impression' | 'health-check';
  status: SyncStatus;
  retryCount: number;
  data: unknown;
}

export interface InventoryRecord {
  kioskId: string;
  date: string;
  initialBudget: number;
  remainingBudget: number;
  lastUpdated: number;
}

interface KioskDB extends DBSchema {
  syncQueue: {
    key: number;
    value: SyncRecord;
    indexes: {
      'by-status': SyncStatus;
      'by-type': string;
    };
  };
  inventory: {
    key: string;
    value: InventoryRecord;
    indexes: {
      'by-date': string;
    };
  };
}

let dbInstance: IDBPDatabase<KioskDB> | null = null;

/**
 * Get or create database instance
 */
export async function getDB(): Promise<IDBPDatabase<KioskDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<KioskDB>('kiosk-db', 1, {
    upgrade(db) {
      // Sync queue store
      const syncStore = db.createObjectStore('syncQueue', {
        keyPath: 'id',
        autoIncrement: true,
      });
      syncStore.createIndex('by-status', 'status');
      syncStore.createIndex('by-type', 'type');

      // Inventory store
      const inventoryStore = db.createObjectStore('inventory', {
        keyPath: 'kioskId',
      });
      inventoryStore.createIndex('by-date', 'date');
    },
  });

  return dbInstance;
}

/**
 * Add record to sync queue
 */
export async function addToSyncQueue(record: Omit<SyncRecord, 'id'>): Promise<number> {
  const db = await getDB();
  return db.add('syncQueue', record as SyncRecord);
}

/**
 * Get all pending records for sync
 */
export async function getPendingRecords(): Promise<SyncRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-status', 'pending');
}

/**
 * Update record sync status
 */
export async function updateRecordStatus(
  id: number,
  status: SyncStatus,
  retryCount?: number
): Promise<void> {
  const db = await getDB();
  const record = await db.get('syncQueue', id);
  if (record) {
    record.status = status;
    if (retryCount !== undefined) {
      record.retryCount = retryCount;
    }
    await db.put('syncQueue', record);
  }
}

/**
 * Get today's inventory for kiosk
 */
export async function getTodayInventory(kioskId: string): Promise<InventoryRecord | undefined> {
  const db = await getDB();
  const today = new Date().toISOString().split('T')[0];
  const record = await db.get('inventory', kioskId);
  if (record && record.date === today) {
    return record;
  }
  return undefined;
}

/**
 * Update inventory (decrement remaining budget)
 */
export async function decrementInventory(kioskId: string): Promise<boolean> {
  const db = await getDB();
  const record = await getTodayInventory(kioskId);
  if (record && record.remainingBudget > 0) {
    record.remainingBudget -= 1;
    record.lastUpdated = Date.now();
    await db.put('inventory', record);
    return true;
  }
  return false;
}

/**
 * Initialize or reset daily inventory
 */
export async function initializeDailyInventory(
  kioskId: string,
  dailyBudget: number
): Promise<void> {
  const db = await getDB();
  const today = new Date().toISOString().split('T')[0];

  await db.put('inventory', {
    kioskId,
    date: today,
    initialBudget: dailyBudget,
    remainingBudget: dailyBudget,
    lastUpdated: Date.now(),
  });
}

/**
 * Clear synced records older than specified days
 */
export async function cleanupOldRecords(days: number = 7): Promise<void> {
  const db = await getDB();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const tx = db.transaction('syncQueue', 'readwrite');
  const index = tx.store.index('by-status');

  for await (const cursor of index.iterate('synced')) {
    if (cursor.value.timestamp < cutoff) {
      await cursor.delete();
    }
  }
}
