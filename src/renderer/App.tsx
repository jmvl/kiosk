/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { useKeyboardEvents } from './hooks/useKeyboardEvents';
import { IdleScreen } from './components/IdleScreen';
import { QuizScreen } from './components/QuizScreen';
import { SlotMachineScreen } from './components/SlotMachineScreen';
import { WinScreen } from './components/WinScreen';
import { LossScreen } from './components/LossScreen';
import { storageService } from './services/StorageService';
import { syncService } from './services/SyncService';

type GameState = 'idle' | 'coin-inserted' | 'quiz' | 'game' | 'win' | 'loss';

function App() {
  const [gameState, setGameState] = useState<GameState>('idle');
  // coinValue stored for prize calculation and game result tracking
  const [coinValue, setCoinValue] = useState<number>(0);
  const [lastInteraction, setLastInteraction] = useState<Date>(new Date());

  // Start sync service on mount
  useEffect(() => {
    // Initialize storage first
    storageService.init().catch((err) => {
      console.error('[App] Failed to initialize storage:', err);
    });

    // Start background sync
    syncService.start();

    // Cleanup on unmount
    return () => {
      syncService.stop();
    };
  }, []);

  // Keyboard event handler for coin input
  useKeyboardEvents((key) => {
    if (key === '1' || key === '2' || key === '5') {
      const value = parseInt(key);
      setCoinValue(value);
      setGameState('quiz');
      setLastInteraction(new Date());
    } else {
      setLastInteraction(new Date());
    }
  });

  // Check for idle state (30 seconds of inactivity)
  useEffect(() => {
    const idleTimer = setInterval(() => {
      const secondsSinceInteraction = (new Date().getTime() - lastInteraction.getTime()) / 1000;
      if (secondsSinceInteraction >= 30 && gameState !== 'idle') {
        setGameState('idle');
      }
    }, 1000);

    return () => clearInterval(idleTimer);
  }, [lastInteraction, gameState]);

  // Render current game state
  const renderState = () => {
    switch (gameState) {
      case 'idle':
        return <IdleScreen />;
      case 'quiz':
        return <QuizScreen onComplete={(passed) => setGameState(passed ? 'game' : 'idle')} />;
      case 'game':
        return (
          <SlotMachineScreen
            onComplete={(result) => {
              // Save game result to IndexedDB
              const kioskId = import.meta.env.VITE_KIOSK_ID || 'KIOSK-001';
              storageService
                .saveGameResult({
                  kioskId,
                  coinValue,
                  outcome: result,
                  prizeValue: result === 'win' ? coinValue * 2 : undefined,
                })
                .catch((err) => console.error('[App] Failed to save game result:', err));

              setGameState(result === 'win' ? 'win' : 'loss');
            }}
          />
        );
      case 'win':
        return <WinScreen onComplete={() => setGameState('idle')} />;
      case 'loss':
        return <LossScreen onComplete={() => setGameState('idle')} />;
      default:
        return <IdleScreen />;
    }
  };

  return (
    <div className="app">
      <div className="status-bar">
        <span>State: {gameState}</span>
        <span>Kiosk: {import.meta.env.VITE_KIOSK_ID}</span>
      </div>
      {renderState()}
    </div>
  );
}

export default App;
