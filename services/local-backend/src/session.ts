import type { SessionSnapshot, SessionState } from '@retail-kiosk/shared-types';
import { sessionStates } from '@retail-kiosk/shared-types';
import type { LocalDatabase } from './db/sqlite.js';
import { appendEvent } from './events.js';
import { generateUlid } from './ids.js';

export interface CreateSessionInput {
  kioskId: string;
  packageId: string;
  packageVersion: string;
  tokenPayload?: Record<string, unknown>;
}

export interface TransitionSessionOptions {
  resultPayload?: Record<string, unknown>;
  lastError?: string;
}

const stateSet = new Set<SessionState>(sessionStates);

const allowedTransitions: Record<SessionState, readonly SessionState[]> = {
  booting: ['idle', 'maintenance', 'runtime_error'],
  idle: ['token_received', 'maintenance', 'degraded_printer', 'degraded_token_input', 'package_failed', 'runtime_error'],
  token_received: ['session_starting', 'resetting', 'runtime_error'],
  session_starting: ['playing', 'resetting', 'runtime_error'],
  playing: ['result_pending', 'resetting', 'runtime_error'],
  result_pending: ['print_requested', 'completed', 'resetting', 'runtime_error'],
  print_requested: ['printing', 'completed', 'degraded_printer', 'resetting', 'runtime_error'],
  printing: ['completed', 'degraded_printer', 'resetting', 'runtime_error'],
  completed: ['resetting'],
  resetting: ['idle', 'maintenance', 'runtime_error'],
  degraded_printer: ['print_requested', 'resetting', 'maintenance', 'runtime_error'],
  degraded_token_input: ['idle', 'maintenance', 'runtime_error'],
  maintenance: ['idle', 'runtime_error'],
  package_failed: ['idle', 'maintenance', 'runtime_error'],
  runtime_error: ['resetting', 'maintenance'],
};

interface SessionRow {
  session_id: string;
  kiosk_id: string;
  package_id: string;
  package_version: string;
  state: SessionState;
  session_language: 'fr-BE' | 'nl-BE' | null;
  quiz_attempts: number;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  last_error: string | null;
}

const activeSessionStates = new Set<SessionState>([
  'token_received',
  'session_starting',
  'playing',
  'result_pending',
  'print_requested',
  'printing',
  'degraded_printer',
]);

function snapshotFromRow(row: SessionRow): SessionSnapshot {
  return {
    session_id: row.session_id,
    kiosk_id: row.kiosk_id,
    package_id: row.package_id,
    package_version: row.package_version,
    state: row.state,
    ...(row.session_language === null ? {} : { session_language: row.session_language }),
    quiz_attempts: row.quiz_attempts,
    started_at: row.started_at,
    updated_at: row.updated_at,
    ...(row.completed_at === null ? {} : { completed_at: row.completed_at }),
    ...(row.last_error === null ? {} : { last_error: row.last_error }),
  };
}

export function getSession(db: LocalDatabase, sessionId: string): SessionSnapshot {
  const row = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId) as SessionRow | undefined;
  if (!row) throw new Error(`session not found: ${sessionId}`);
  return snapshotFromRow(row);
}

export function createSession(db: LocalDatabase, input: CreateSessionInput): SessionSnapshot {
  const tx = db.transaction(() => {
    const existingActive = db.prepare(
      `SELECT session_id, kiosk_id, package_id, package_version, state, session_language, quiz_attempts, started_at, updated_at, completed_at, last_error
       FROM sessions
       WHERE state IN (${Array.from(activeSessionStates).map(() => '?').join(', ')})
       ORDER BY updated_at DESC
       LIMIT 1`,
    ).get(...activeSessionStates) as SessionRow | undefined;
    if (existingActive) {
      throw new Error(`active session already exists: ${existingActive.session_id} (${existingActive.state})`);
    }

    const runtime = db.prepare('SELECT current_session_id FROM runtime_state WHERE id = 1').get() as { current_session_id: string | null } | undefined;
    if (runtime?.current_session_id) {
      const current = db.prepare(
        `SELECT session_id, kiosk_id, package_id, package_version, state, session_language, quiz_attempts, started_at, updated_at, completed_at, last_error
         FROM sessions
         WHERE session_id = ?`,
      ).get(runtime.current_session_id) as SessionRow | undefined;
      if (current && activeSessionStates.has(current.state)) {
        throw new Error(`active session already exists: ${current.session_id} (${current.state})`);
      }
    }

    const now = new Date().toISOString();
    const sessionId = generateUlid();
    db.prepare(`INSERT INTO sessions (session_id, kiosk_id, package_id, package_version, state, quiz_attempts, token_payload, started_at, updated_at)
      VALUES (?, ?, ?, ?, 'token_received', 0, ?, ?, ?)`).run(
      sessionId,
      input.kioskId,
      input.packageId,
      input.packageVersion,
      input.tokenPayload === undefined ? null : JSON.stringify(input.tokenPayload),
      now,
      now,
    );
    db.prepare(`UPDATE runtime_state SET kiosk_id = ?, current_session_id = ?, mode = 'token_received', active_package_id = ?, active_package_version = ?, updated_at = ? WHERE id = 1`).run(
      input.kioskId,
      sessionId,
      input.packageId,
      input.packageVersion,
      now,
    );
    appendEvent(db, {
      kioskId: input.kioskId,
      sessionId,
      eventType: 'token_received',
      payload: { package_id: input.packageId, package_version: input.packageVersion, token: input.tokenPayload ?? null },
      occurredAt: now,
    });
    if (input.tokenPayload?.token_required !== false) {
      appendEvent(db, {
        kioskId: input.kioskId,
        sessionId,
        eventType: 'token_inserted',
        payload: { package_id: input.packageId, package_version: input.packageVersion, token: input.tokenPayload ?? null },
        occurredAt: now,
      });
    }
    return getSession(db, sessionId);
  });
  return tx();
}

export function transitionSession(db: LocalDatabase, sessionId: string, nextState: SessionState, options: TransitionSessionOptions = {}): SessionSnapshot {
  if (!stateSet.has(nextState)) throw new Error(`unknown session state: ${nextState}`);
  const tx = db.transaction(() => {
    const current = getSession(db, sessionId);
    if (!allowedTransitions[current.state].includes(nextState)) {
      throw new Error(`invalid session transition: ${current.state} -> ${nextState}`);
    }
    const now = new Date().toISOString();
    const completedAt = nextState === 'completed' ? now : current.completed_at ?? null;
    db.prepare(`UPDATE sessions SET state = ?, result_payload = COALESCE(?, result_payload), updated_at = ?, completed_at = ?, last_error = ? WHERE session_id = ?`).run(
      nextState,
      options.resultPayload === undefined ? null : JSON.stringify(options.resultPayload),
      now,
      completedAt,
      options.lastError ?? null,
      sessionId,
    );
    db.prepare('UPDATE runtime_state SET mode = ?, current_session_id = ?, updated_at = ?, last_error = ? WHERE id = 1').run(
      nextState,
      nextState === 'idle' ? null : sessionId,
      now,
      options.lastError ?? null,
    );
    appendEvent(db, {
      kioskId: current.kiosk_id,
      sessionId,
      eventType: `session_${nextState}`,
      payload: { from_state: current.state, to_state: nextState, result: options.resultPayload ?? null, error: options.lastError ?? null },
      occurredAt: now,
    });
    return getSession(db, sessionId);
  });
  return tx();
}

export { allowedTransitions };
