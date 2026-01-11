import type { SlotSymbol } from '@shared/types';

/**
 * Win Engine Service
 * Determines win/loss outcome using local RNG
 * Enforces budget caps before allowing wins
 */
export class WinEngine {
  private winRate: number; // 0-100
  private remainingBudget: number;

  constructor(winRate: number, initialBudget: number) {
    this.winRate = winRate;
    this.remainingBudget = initialBudget;
  }

  /**
   * Determine if the player wins based on RNG and budget
   */
  determineOutcome(_symbols: SlotSymbol[]): 'win' | 'loss' {
    // Check budget first
    if (this.remainingBudget <= 0) {
      return 'loss'; // Budget exhausted
    }

    // Roll for win
    const roll = Math.random() * 100;
    const isWin = roll < this.winRate;

    if (isWin && this.remainingBudget > 0) {
      this.remainingBudget--;
      return 'win';
    }

    return 'loss';
  }

  /**
   * Generate random slot machine symbols
   */
  generateSymbols(_count: number): SlotSymbol[] {
    // TODO: Implement symbol generation in Story 1.4
    return [];
  }

  /**
   * Update win rate (from remote config)
   */
  setWinRate(rate: number) {
    this.winRate = Math.max(0, Math.min(100, rate));
  }

  /**
   * Update budget (from remote config or daily reset)
   */
  setBudget(budget: number) {
    this.remainingBudget = budget;
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    return this.remainingBudget;
  }
}
