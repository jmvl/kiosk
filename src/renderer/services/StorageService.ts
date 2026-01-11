import { openDB, type IDBPDatabase } from 'idb';

/**
 * Storage Service
 * Manages local IndexedDB storage for:
 * - Inventory tracking
 * - Game results (pending sync)
 * - Configuration cache
 */

interface KioskDB {
  inventory: {
    key: string;
    value: {
      id: string;
      count: number;
      updatedAt: number;
    };
  };
  gameResults: {
    key: string;
    value: {
      id: string;
      timestamp: number;
      kioskId: string;
      coinValue: number;
      outcome: 'win' | 'loss';
      prizeValue?: number;
      synced: boolean;
      syncStatus: 'pending' | 'synced' | 'failed';
      retryCount: number;
    };
  };
  adImpressions: {
    key: string;
    value: {
      id: string;
      adId: string;
      timestamp: number;
      duration: number;
      synced: boolean;
      syncStatus: 'pending' | 'synced' | 'failed';
      retryCount: number;
    };
  };
  config: {
    key: string;
    value: {
      key: string;
      value: unknown;
      updatedAt: number;
    };
  };
}

const DB_NAME = 'kiosk-db';
const DB_VERSION = 3; // Incremented for syncStatus and retryCount fields

class StorageService {
  private db: IDBPDatabase<KioskDB> | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<KioskDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create inventory store
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' });
        }
        // Create game results store
        if (!db.objectStoreNames.contains('gameResults')) {
          db.createObjectStore('gameResults', { keyPath: 'id' });
        }
        // Create ad impressions store
        if (!db.objectStoreNames.contains('adImpressions')) {
          db.createObjectStore('adImpressions', { keyPath: 'id' });
        }
        // Create config store
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }
      },
    });

    // Initialize inventory if not exists
    const inventory = await this.getInventory();
    if (inventory === null) {
      await this.setInventory(100); // Default starting inventory
    }
  }

  /**
   * Get current inventory count
   */
  async getInventory(): Promise<number | null> {
    if (!this.db) await this.init();
    const record = await this.db!.get('inventory', 'tickets');
    return record?.count ?? null;
  }

  /**
   * Set inventory count
   */
  async setInventory(count: number): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('inventory', {
      id: 'tickets',
      count,
      updatedAt: Date.now(),
    });
  }

  /**
   * Decrement inventory by 1 (called on successful print)
   */
  async decrementInventory(): Promise<number> {
    if (!this.db) await this.init();
    const current = (await this.getInventory()) ?? 0;
    const newCount = Math.max(0, current - 1);
    await this.setInventory(newCount);
    return newCount;
  }

  /**
   * Save a game result
   */
  async saveGameResult(result: {
    kioskId: string;
    coinValue: number;
    outcome: 'win' | 'loss';
    prizeValue?: number;
  }): Promise<string> {
    if (!this.db) await this.init();
    const id = crypto.randomUUID();
    await this.db!.put('gameResults', {
      id,
      timestamp: Date.now(),
      kioskId: result.kioskId,
      coinValue: result.coinValue,
      outcome: result.outcome,
      prizeValue: result.prizeValue,
      synced: false,
      syncStatus: 'pending',
      retryCount: 0,
    });
    return id;
  }

  /**
   * Get unsynced game results (pending or failed with retries left)
   */
  async getUnsyncedResults(): Promise<
    Array<{
      id: string;
      timestamp: number;
      kioskId: string;
      coinValue: number;
      outcome: 'win' | 'loss';
      prizeValue?: number;
      retryCount: number;
    }>
  > {
    if (!this.db) await this.init();
    const all = await this.db!.getAll('gameResults');
    // Return pending records and failed records with retries < 5
    return all.filter((r) => r.syncStatus === 'pending' || (r.syncStatus === 'failed' && r.retryCount < 5));
  }

  /**
   * Mark results as synced
   */
  async markResultsSynced(ids: string[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('gameResults', 'readwrite');
    for (const id of ids) {
      const record = await tx.store.get(id);
      if (record) {
        record.synced = true;
        record.syncStatus = 'synced';
        await tx.store.put(record);
      }
    }
    await tx.done;
  }

  /**
   * Mark results as failed (for retry)
   */
  async markResultsFailed(ids: string[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('gameResults', 'readwrite');
    for (const id of ids) {
      const record = await tx.store.get(id);
      if (record) {
        record.syncStatus = 'failed';
        record.retryCount = (record.retryCount || 0) + 1;
        await tx.store.put(record);
      }
    }
    await tx.done;
  }

  /**
   * Log an ad impression
   */
  async logAdImpression(adId: string, duration: number): Promise<string> {
    if (!this.db) await this.init();
    const id = crypto.randomUUID();
    await this.db!.put('adImpressions', {
      id,
      adId,
      timestamp: Date.now(),
      duration,
      synced: false,
      syncStatus: 'pending',
      retryCount: 0,
    });
    return id;
  }

  /**
   * Get unsynced ad impressions (pending or failed with retries left)
   */
  async getUnsyncedImpressions(): Promise<
    Array<{
      id: string;
      adId: string;
      timestamp: number;
      duration: number;
      retryCount: number;
    }>
  > {
    if (!this.db) await this.init();
    const all = await this.db!.getAll('adImpressions');
    // Return pending records and failed records with retries < 5
    return all.filter((r) => r.syncStatus === 'pending' || (r.syncStatus === 'failed' && r.retryCount < 5));
  }

  /**
   * Mark impressions as synced
   */
  async markImpressionsSynced(ids: string[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('adImpressions', 'readwrite');
    for (const id of ids) {
      const record = await tx.store.get(id);
      if (record) {
        record.synced = true;
        record.syncStatus = 'synced';
        await tx.store.put(record);
      }
    }
    await tx.done;
  }

  /**
   * Mark impressions as failed (for retry)
   */
  async markImpressionsFailed(ids: string[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('adImpressions', 'readwrite');
    for (const id of ids) {
      const record = await tx.store.get(id);
      if (record) {
        record.syncStatus = 'failed';
        record.retryCount = (record.retryCount || 0) + 1;
        await tx.store.put(record);
      }
    }
    await tx.done;
  }

  /**
   * Get a config value
   */
  async getConfig<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();
    const record = await this.db!.get('config', key);
    return (record?.value as T) ?? null;
  }

  /**
   * Set a config value
   */
  async setConfig<T>(key: string, value: T): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('config', {
      key,
      value,
      updatedAt: Date.now(),
    });
  }
}

// Singleton instance
export const storageService = new StorageService();
