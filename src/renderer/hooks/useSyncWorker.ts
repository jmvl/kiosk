import { useState, useEffect } from 'react';
import type { GameResult, SyncRecord } from '@shared/types';

/**
 * Hook to sync game results to Convex
 * Runs every 30 seconds in the background
 */
export function useSyncWorker() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Sync worker runs every 30 seconds
    const syncInterval = setInterval(async () => {
      try {
        setSyncStatus('syncing');

        // TODO: Get pending records from IndexedDB
        const pendingRecords: SyncRecord[] = await getPendingRecords();

        if (pendingRecords.length === 0) {
          setSyncStatus('idle');
          return;
        }

        // TODO: Upload to Convex
        // await uploadToConvex(pendingRecords);

        setPendingCount(0);
        setSyncStatus('idle');
      } catch (error) {
        console.error('Sync failed:', error);
        setSyncStatus('error');
      }
    }, 30000);

    return () => clearInterval(syncInterval);
  }, []);

  // Helper to queue a game result
  const queueGameResult = async (result: GameResult) => {
    const _record: SyncRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'game-result',
      status: 'pending',
      retryCount: 0,
      data: result,
    };

    // TODO: Store in IndexedDB in Story 3.1
    // await storeRecord(_record);
  };

  return { syncStatus, pendingCount, queueGameResult };
}

// Temporary placeholder - will be implemented in Story 3.1
async function getPendingRecords(): Promise<SyncRecord[]> {
  return [];
}
