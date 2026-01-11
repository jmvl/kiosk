import { useEffect, useState } from 'react';
import type { KioskConfig } from '@shared/types';

/**
 * Hook to fetch kiosk configuration from Convex
 */
export function useKioskConfig() {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch from Convex in Story 4.1
    // For now, return hardcoded defaults
    const defaultConfig: KioskConfig = {
      winRate: 30, // 30% win rate
      dailyBudget: 50,
      language: 'fr',
    };

    setConfig(defaultConfig);
    setLoading(false);
  }, []);

  return { config, loading };
}
