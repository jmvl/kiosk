import type { SlotSymbol } from '@shared/types';

/**
 * Win Engine Service
 * Determines win/loss outcome using local RNG
 * Enforces budget caps before allowing wins
 * Resets budget at local midnight
 */
export class WinEngine {
  private winRate: number; // 0-100
  private remainingBudget: number;
  private initialBudget: number;
  private lastResetDate: string;

  constructor(winRate: number, initialBudget: number) {
    this.winRate = winRate;
    this.initialBudget = initialBudget;
    this.remainingBudget = initialBudget;
    this.lastResetDate = this.getCurrentDateString();
  }

  /**
   * Get current date as YYYY-MM-DD string
   */
  private getCurrentDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Check if we've crossed midnight since last reset
   */
  private checkMidnightReset(): void {
    const currentDate = this.getCurrentDateString();
    if (currentDate !== this.lastResetDate) {
      // Midnight has passed, reset budget
      this.remainingBudget = this.initialBudget;
      this.lastResetDate = currentDate;
      console.log('[WinEngine] Daily budget reset to', this.initialBudget);
    }
  }

  /**
   * Determine if the player wins based on RNG and budget
   */
  determineOutcome(_symbols: SlotSymbol[]): 'win' | 'loss' {
    // Check for midnight reset first
    this.checkMidnightReset();

    // Check budget
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
    this.initialBudget = budget;
    this.remainingBudget = budget;
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    // Check for midnight reset before returning
    this.checkMidnightReset();
    return this.remainingBudget;
  }

  /**
   * Get current win rate
   */
  getWinRate(): number {
    return this.winRate;
  }

  /**
   * Force a midnight reset (for testing)
   */
  forceReset(): void {
    this.remainingBudget = this.initialBudget;
    this.lastResetDate = this.getCurrentDateString();
  }
}
