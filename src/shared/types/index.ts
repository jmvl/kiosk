// Shared types for Kiosk application

export type GameState = 'idle' | 'coin-inserted' | 'quiz' | 'game' | 'win' | 'loss';

export type CoinValue = 1 | 2 | 5;

export interface GameResult {
  id: string;
  kioskId: string;
  timestamp: number;
  coinValue: CoinValue;
  quizPassed: boolean;
  outcome: 'win' | 'loss';
  prizeValue?: number;
  qrCode?: string;
}

export interface QuizQuestion {
  id: string;
  question: Record<'fr' | 'nl', string>;
  answers: Record<'fr' | 'nl', string[]>;
  correctAnswer: number;
}

export interface SlotSymbol {
  id: string;
  name: string;
  image: string;
  isWinning: boolean;
}

export interface Prize {
  id: string;
  name: Record<'fr' | 'nl', string>;
  value: number;
  expiresAt: number;
  qrCode: string;
}

export interface KioskConfig {
  winRate: number; // 0-100
  dailyBudget: number;
  language: 'fr' | 'nl';
}

export interface SyncStatus = 'pending' | 'synced' | 'failed';

export interface SyncRecord {
  id: string;
  timestamp: number;
  type: 'game-result' | 'ad-impression' | 'health-check';
  status: SyncStatus;
  retryCount: number;
  data: unknown;
}
