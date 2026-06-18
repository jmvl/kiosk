export const sessionStates = [
  'booting',
  'idle',
  'token_received',
  'session_starting',
  'playing',
  'result_pending',
  'print_requested',
  'printing',
  'completed',
  'resetting',
  'degraded_printer',
  'degraded_token_input',
  'maintenance',
  'package_failed',
  'runtime_error',
] as const;

export type SessionState = (typeof sessionStates)[number];

export interface SessionSnapshot {
  session_id: string;
  kiosk_id: string;
  package_id: string;
  package_version: string;
  state: SessionState;
  session_language?: 'fr-BE' | 'nl-BE';
  quiz_attempts?: number;
  quiz_passed?: boolean;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  last_error?: string;
}
