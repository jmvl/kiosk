/**
 * Sync Service
 * Background worker that syncs local data to Convex backend
 * Runs every 30 seconds and handles:
 * - Game results
 * - Ad impressions
 */

import { storageService } from './StorageService';

// Convex API endpoint - will be configured via environment
const CONVEX_SYNC_URL = import.meta.env.VITE_CONVEX_URL || 'https://api.convex.cloud/sync';

class SyncService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private readonly SYNC_INTERVAL = 30000; // 30 seconds

  /**
   * Start the background sync worker
   */
  start(): void {
    if (this.intervalId) {
      console.log('[SyncService] Already running');
      return;
    }

    console.log('[SyncService] Starting background sync worker (30s interval)');

    // Run immediately on start
    this.runSync();

    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      this.runSync();
    }, this.SYNC_INTERVAL);
  }

  /**
   * Stop the background sync worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SyncService] Stopped background sync worker');
    }
  }

  /**
   * Check if the sync worker is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Run a single sync operation
   */
  async runSync(): Promise<void> {
    // Skip sync when offline
    if (!navigator.onLine) {
      console.log('[SyncService] Network unavailable, skipping sync');
      return;
    }

    if (this.isSyncing) {
      console.log('[SyncService] Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    console.log('[SyncService] Running sync...');

    try {
      // Sync game results
      await this.syncGameResults();

      // Sync ad impressions
      await this.syncAdImpressions();

      console.log('[SyncService] Sync completed');
    } catch (error) {
      console.error('[SyncService] Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync game results to Convex
   */
  private async syncGameResults(): Promise<void> {
    const unsyncedResults = await storageService.getUnsyncedResults();

    if (unsyncedResults.length === 0) {
      return;
    }

    console.log(`[SyncService] Syncing ${unsyncedResults.length} game results`);

    try {
      // In production, this would call the Convex mutation
      // For now, simulate the API call
      const response = await this.sendToConvex('gameResults:sync', {
        results: unsyncedResults,
      });

      if (response.success) {
        // Mark as synced
        await storageService.markResultsSynced(unsyncedResults.map((r) => r.id));
        console.log(`[SyncService] Marked ${unsyncedResults.length} game results as synced`);
      }
    } catch (error) {
      console.error('[SyncService] Failed to sync game results:', error);
      // Mark as failed for retry
      await storageService.markResultsFailed(unsyncedResults.map((r) => r.id));
      console.log(`[SyncService] Marked ${unsyncedResults.length} game results as failed for retry`);
    }
  }

  /**
   * Sync ad impressions to Convex
   */
  private async syncAdImpressions(): Promise<void> {
    const unsyncedImpressions = await storageService.getUnsyncedImpressions();

    if (unsyncedImpressions.length === 0) {
      return;
    }

    console.log(`[SyncService] Syncing ${unsyncedImpressions.length} ad impressions`);

    try {
      // In production, this would call the Convex mutation
      // For now, simulate the API call
      const response = await this.sendToConvex('adImpressions:sync', {
        impressions: unsyncedImpressions,
      });

      if (response.success) {
        // Mark as synced
        await storageService.markImpressionsSynced(unsyncedImpressions.map((i) => i.id));
        console.log(`[SyncService] Marked ${unsyncedImpressions.length} ad impressions as synced`);
      }
    } catch (error) {
      console.error('[SyncService] Failed to sync ad impressions:', error);
      // Mark as failed for retry
      await storageService.markImpressionsFailed(unsyncedImpressions.map((i) => i.id));
      console.log(`[SyncService] Marked ${unsyncedImpressions.length} ad impressions as failed for retry`);
    }
  }

  /**
   * Send data to Convex backend
   * In MVP, this is a stub that will be replaced with actual Convex client
   */
  private async sendToConvex(
    _mutation: string,
    _data: Record<string, unknown>
  ): Promise<{ success: boolean }> {
    // TODO: Replace with actual Convex client in Story 2.x
    // For now, simulate network delay and success
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if we have network connectivity (simple check)
    if (!navigator.onLine) {
      throw new Error('No network connectivity');
    }

    // In production:
    // return await convex.mutation(api[mutation], data);

    // For MVP, log and return success
    console.log(`[SyncService] Would sync to ${CONVEX_SYNC_URL}: ${_mutation}`);
    return { success: true };
  }
}

// Singleton instance
export const syncService = new SyncService();
