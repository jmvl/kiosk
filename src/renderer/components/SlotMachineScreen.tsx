// Slot Machine Screen - three reel slot game
import { useState, useCallback } from 'react';
import { WinEngine } from '../services/WinEngine';

export interface SlotMachineScreenProps {
  onComplete: (result: 'win' | 'loss') => void;
}

// Slot symbols - using emoji for MVP, will be replaced with images
const SYMBOLS = ['🍎', '🍊', '🍋', '🍇', '🍒', '⭐', '💎', '7️⃣'];

// Create win engine with 30% win rate and budget of 10 wins per day (MVP defaults)
const winEngine = new WinEngine(30, 10);

export function SlotMachineScreen({ onComplete }: SlotMachineScreenProps) {
  const [reels, setReels] = useState<string[][]>([
    [SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]],
    [SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]],
    [SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]],
  ]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<'win' | 'loss' | null>(null);
  const [hasSpun, setHasSpun] = useState(false);
  const [buttonActive, setButtonActive] = useState(false);

  // Generate random symbols for a reel
  const generateReelSymbols = useCallback(() => {
    return Array(3)
      .fill(null)
      .map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  }, []);

  const startSpin = () => {
    if (spinning || hasSpun) return; // Prevent multiple spins

    setButtonActive(true);
    setSpinning(true);
    setResult(null);

    // Reset button active state after brief animation
    setTimeout(() => setButtonActive(false), 200);

    // Simulate spinning animation with intervals
    const spinInterval = setInterval(() => {
      setReels([generateReelSymbols(), generateReelSymbols(), generateReelSymbols()]);
    }, 100);

    // Stop spinning after 2 seconds
    setTimeout(() => {
      clearInterval(spinInterval);

      // Determine outcome using win engine
      const outcome = winEngine.determineOutcome([]);

      // Generate final symbols based on outcome
      let finalReels: string[][];
      if (outcome === 'win') {
        // For a win, make all middle symbols match
        const winSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        finalReels = [
          [generateReelSymbols()[0], winSymbol, generateReelSymbols()[0]],
          [generateReelSymbols()[0], winSymbol, generateReelSymbols()[0]],
          [generateReelSymbols()[0], winSymbol, generateReelSymbols()[0]],
        ];
      } else {
        // For a loss, ensure middle symbols don't all match
        finalReels = [generateReelSymbols(), generateReelSymbols(), generateReelSymbols()];
        // Make sure they don't accidentally match
        while (
          finalReels[0][1] === finalReels[1][1] &&
          finalReels[1][1] === finalReels[2][1]
        ) {
          finalReels[2] = generateReelSymbols();
        }
      }

      setReels(finalReels);
      setSpinning(false);
      setResult(outcome);
      setHasSpun(true);

      // Delay before transition
      setTimeout(() => {
        onComplete(outcome);
      }, 2000);
    }, 2000);
  };

  return (
    <div className="slot-machine-screen">
      <h2 className="slot-title">Spin to Win!</h2>

      <div className="slot-machine-container">
        <div className="reels-container">
          {reels.map((reel, reelIndex) => (
            <div
              key={reelIndex}
              className={`reel ${spinning ? 'spinning' : ''}`}
              style={{ overflow: 'hidden' }}
            >
              {reel.map((symbol, symbolIndex) => (
                <div
                  key={symbolIndex}
                  className={`symbol ${
                    !spinning && symbolIndex === 1 && result === 'win' ? 'winning' : ''
                  }`}
                >
                  {symbol}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="payline" />
      </div>

      {/* Push Button / Lever */}
      <button
        className={`push-button ${buttonActive ? 'active' : ''} ${spinning || hasSpun ? 'disabled' : ''}`}
        onClick={startSpin}
        disabled={spinning || hasSpun}
      >
        {spinning ? 'Spinning...' : hasSpun ? 'Done!' : 'PUSH'}
      </button>

      {result && (
        <div className={`result-display ${result}`}>
          {result === 'win' ? (
            <p className="win-message">🎉 JACKPOT! 🎉</p>
          ) : (
            <p className="loss-message">Better luck next time!</p>
          )}
        </div>
      )}

      {!hasSpun && !spinning && (
        <p className="instruction-text">Press the button to spin!</p>
      )}
    </div>
  );
}
