// Slot Machine Screen - three reel slot game
import { useState, useCallback, useRef } from 'react';
import { WinEngine } from '../services/WinEngine';

export interface SlotMachineScreenProps {
  onComplete: (result: 'win' | 'loss') => void;
}

// Slot symbols - using emoji for MVP, will be replaced with images
const SYMBOLS = ['🍎', '🍊', '🍋', '🍇', '🍒', '⭐', '💎', '7️⃣'];

// Create win engine with 30% win rate and budget of 10 wins per day (MVP defaults)
const winEngine = new WinEngine(30, 10);

// Time delays for sequential stopping (ms)
const REEL_STOP_DELAYS = [1500, 2200, 2900]; // Left, Middle, Right

export function SlotMachineScreen({ onComplete }: SlotMachineScreenProps) {
  const [reels, setReels] = useState<string[][]>([
    [SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]],
    [SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]],
    [SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]],
  ]);
  // Track which reels are still spinning (0 = left, 1 = middle, 2 = right)
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false]);
  const [result, setResult] = useState<'win' | 'loss' | null>(null);
  const [hasSpun, setHasSpun] = useState(false);
  const [buttonActive, setButtonActive] = useState(false);

  // Store final reels for sequential stopping
  const finalReelsRef = useRef<string[][]>([]);

  // Generate random symbols for a reel
  const generateReelSymbols = useCallback(() => {
    return Array(3)
      .fill(null)
      .map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  }, []);

  const isAnySpinning = spinningReels.some((s) => s);

  const startSpin = () => {
    if (isAnySpinning || hasSpun) return; // Prevent multiple spins

    setButtonActive(true);
    setSpinningReels([true, true, true]); // All reels spinning
    setResult(null);

    // Reset button active state after brief animation
    setTimeout(() => setButtonActive(false), 200);

    // Determine outcome upfront
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
      while (finalReels[0][1] === finalReels[1][1] && finalReels[1][1] === finalReels[2][1]) {
        finalReels[2] = generateReelSymbols();
      }
    }
    finalReelsRef.current = finalReels;

    // Simulate spinning animation with intervals for each reel
    const spinIntervals = [
      setInterval(() => {
        setReels((prev) => [generateReelSymbols(), prev[1], prev[2]]);
      }, 80),
      setInterval(() => {
        setReels((prev) => [prev[0], generateReelSymbols(), prev[2]]);
      }, 90),
      setInterval(() => {
        setReels((prev) => [prev[0], prev[1], generateReelSymbols()]);
      }, 100),
    ];

    // Stop reels sequentially left to right
    REEL_STOP_DELAYS.forEach((delay, index) => {
      setTimeout(() => {
        clearInterval(spinIntervals[index]);

        // Set final reel value
        setReels((prev) => {
          const newReels = [...prev];
          newReels[index] = finalReelsRef.current[index];
          return newReels;
        });

        // Mark this reel as stopped
        setSpinningReels((prev) => {
          const newSpinning = [...prev];
          newSpinning[index] = false;
          return newSpinning;
        });

        // After the last reel stops, show result
        if (index === 2) {
          setResult(outcome);
          setHasSpun(true);

          // Delay before transition
          setTimeout(() => {
            onComplete(outcome);
          }, 2000);
        }
      }, delay);
    });
  };

  return (
    <div className="slot-machine-screen">
      <h2 className="slot-title">Spin to Win!</h2>

      <div className="slot-machine-container">
        <div className="reels-container">
          {reels.map((reel, reelIndex) => (
            <div
              key={reelIndex}
              className={`reel ${spinningReels[reelIndex] ? 'spinning' : 'stopped'}`}
              style={{ overflow: 'hidden' }}
            >
              {reel.map((symbol, symbolIndex) => (
                <div
                  key={symbolIndex}
                  className={`symbol ${
                    !spinningReels[reelIndex] && symbolIndex === 1 && result === 'win'
                      ? 'winning'
                      : ''
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
        className={`push-button ${buttonActive ? 'active' : ''} ${isAnySpinning || hasSpun ? 'disabled' : ''}`}
        onClick={startSpin}
        disabled={isAnySpinning || hasSpun}
      >
        {isAnySpinning ? 'Spinning...' : hasSpun ? 'Done!' : 'PUSH'}
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

      {!hasSpun && !isAnySpinning && <p className="instruction-text">Press the button to spin!</p>}
    </div>
  );
}
