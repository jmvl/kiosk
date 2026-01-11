import { useCallback, useEffect } from 'react';

/**
 * Hook to handle keyboard events for coin input
 * Coin acceptor sends keyboard events: "1", "2", "5" for coin values
 */
export function useKeyboardEvents(callback: (key: string) => void) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Only process number keys 1, 2, 5
      if (['1', '2', '5'].includes(event.key)) {
        callback(event.key);
      }
    },
    [callback]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
