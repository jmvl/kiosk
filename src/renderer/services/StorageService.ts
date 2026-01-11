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
      outcome: 'win' | 'loss';
      prizeValue?: number;
      synced: boolean;
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
const DB_VERSION = 1;

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
    outcome: 'win' | 'loss';
    prizeValue?: number;
  }): Promise<string> {
    if (!this.db) await this.init();
    const id = crypto.randomUUID();
    await this.db!.put('gameResults', {
      id,
      timestamp: Date.now(),
      outcome: result.outcome,
      prizeValue: result.prizeValue,
      synced: false,
    });
    return id;
  }

  /**
   * Get unsynced game results
   */
  async getUnsyncedResults(): Promise<
    Array<{
      id: string;
      timestamp: number;
      outcome: 'win' | 'loss';
      prizeValue?: number;
    }>
  > {
    if (!this.db) await this.init();
    const all = await this.db!.getAll('gameResults');
    return all.filter((r) => !r.synced);
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
