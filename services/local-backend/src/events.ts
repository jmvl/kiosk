import type { EventEnvelope } from '@retail-kiosk/shared-types';
import type { LocalDatabase } from './db/sqlite.js';
import { generateUlid } from './ids.js';

export interface AppendEventInput<Payload extends Record<string, unknown> = Record<string, unknown>> {
  kioskId: string;
  sessionId?: string;
  eventType: string;
  payload: Payload;
  occurredAt?: string;
  schemaVersion?: number;
  simulateFailureAfterEventInsert?: boolean;
}

interface SequenceRow { local_sequence: number }

export function appendEvent<Payload extends Record<string, unknown> = Record<string, unknown>>(
  db: LocalDatabase,
  input: AppendEventInput<Payload>,
): EventEnvelope<Payload> {
  const tx = db.transaction(() => {
    db.prepare('UPDATE runtime_state SET local_sequence = local_sequence + 1, updated_at = ? WHERE id = 1').run(new Date().toISOString());
    const sequence = db.prepare('SELECT local_sequence FROM runtime_state WHERE id = 1').get() as SequenceRow | undefined;
    if (!sequence) throw new Error('runtime_state singleton missing; run migrations first');

    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const envelope: EventEnvelope<Payload> = {
      event_id: generateUlid(),
      kiosk_id: input.kioskId,
      ...(input.sessionId === undefined ? {} : { session_id: input.sessionId }),
      local_sequence: sequence.local_sequence,
      event_type: input.eventType,
      occurred_at: occurredAt,
      payload: input.payload,
      schema_version: input.schemaVersion ?? 1,
    };

    db.prepare(`INSERT INTO events (event_id, kiosk_id, session_id, local_sequence, event_type, occurred_at, payload, schema_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      envelope.event_id,
      envelope.kiosk_id,
      envelope.session_id ?? null,
      envelope.local_sequence,
      envelope.event_type,
      envelope.occurred_at,
      JSON.stringify(envelope.payload),
      envelope.schema_version,
    );

    if (input.simulateFailureAfterEventInsert) {
      throw new Error('simulated transaction failure');
    }

    db.prepare(`INSERT INTO sync_queue (sync_id, event_id, local_sequence, status, attempts, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', 0, ?, ?)`).run(generateUlid(), envelope.event_id, envelope.local_sequence, occurredAt, occurredAt);

    return envelope;
  });
  return tx();
}
