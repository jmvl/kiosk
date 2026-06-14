import type { LocalDatabase } from './db/sqlite.js';

export interface GameRunLogEntry {
  session_id: string;
  kiosk_id: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  package_id: string;
  package_version: string;
  module_id: string | null;
  module_version: string | null;
  state: string;
  token_event: {
    event_id: string;
    occurred_at: string;
    source: string | null;
    denomination_cents: number | null;
    payload: Record<string, unknown> | null;
  } | null;
  result_payload: Record<string, unknown> | null;
  prize: string | null;
  ticket_code: string | null;
  print_status: string | null;
  error: string | null;
}

interface SessionRunRow {
  session_id: string;
  kiosk_id: string;
  package_id: string;
  package_version: string;
  state: string;
  result_payload: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  last_error: string | null;
  ticket_code: string | null;
  ticket_print_status: string | null;
  render_payload: string | null;
  printed_at: string | null;
  print_status: string | null;
  print_error: string | null;
  print_completed_at: string | null;
  print_updated_at: string | null;
}

interface EventRow {
  event_id: string;
  session_id: string;
  event_type: string;
  occurred_at: string;
  payload: string;
}

interface ScheduleSlotRow {
  module_id: string;
  module_version: string;
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberField(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function prizeFromPayload(resultPayload: Record<string, unknown> | null, renderPayload: Record<string, unknown> | null): string | null {
  const candidates = [
    resultPayload?.prize,
    resultPayload?.result,
    renderPayload?.prize,
    renderPayload?.result,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    return typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
  }
  return null;
}

function durationMs(startedAt: string, endedAt: string | null): number | null {
  if (!endedAt) return null;
  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (Number.isNaN(started) || Number.isNaN(ended)) return null;
  return Math.max(0, ended - started);
}

function scheduledModuleForSession(db: LocalDatabase, row: SessionRunRow): ScheduleSlotRow | null {
  return db.prepare(`
    SELECT module_id, module_version
    FROM schedule_slots
    WHERE package_id = ?
      AND package_version = ?
      AND (starts_at IS NULL OR starts_at <= ?)
      AND (ends_at IS NULL OR ends_at > ?)
    ORDER BY starts_at DESC, position ASC
    LIMIT 1
  `).get(row.package_id, row.package_version, row.started_at, row.started_at) as ScheduleSlotRow | undefined ?? null;
}

export function listGameRunLog(db: LocalDatabase, limit = 20): GameRunLogEntry[] {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const rows = db.prepare(`
    SELECT
      s.session_id,
      s.kiosk_id,
      s.package_id,
      s.package_version,
      s.state,
      s.result_payload,
      s.started_at,
      s.updated_at,
      s.completed_at,
      s.last_error,
      t.ticket_code,
      t.print_status AS ticket_print_status,
      t.render_payload,
      t.printed_at,
      pj.status AS print_status,
      pj.last_error AS print_error,
      pj.completed_at AS print_completed_at,
      pj.updated_at AS print_updated_at
    FROM sessions s
    LEFT JOIN tickets t ON t.ticket_id = (
      SELECT ticket_id FROM tickets WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN print_jobs pj ON pj.print_job_id = (
      SELECT print_job_id FROM print_jobs WHERE session_id = s.session_id ORDER BY updated_at DESC LIMIT 1
    )
    ORDER BY s.started_at DESC
    LIMIT ?
  `).all(safeLimit) as SessionRunRow[];

  if (rows.length === 0) return [];
  const sessionIds = rows.map((row) => row.session_id);
  const tokenRows = db.prepare(`
    SELECT event_id, session_id, event_type, occurred_at, payload
    FROM events
    WHERE event_type = 'token_received'
      AND session_id IN (${sessionIds.map(() => '?').join(', ')})
    ORDER BY occurred_at DESC
  `).all(...sessionIds) as EventRow[];
  const tokenBySession = new Map<string, EventRow>();
  for (const event of tokenRows) {
    if (!tokenBySession.has(event.session_id)) tokenBySession.set(event.session_id, event);
  }

  return rows.map((row) => {
    const resultPayload = parseJsonObject(row.result_payload);
    const renderPayload = parseJsonObject(row.render_payload);
    const token = tokenBySession.get(row.session_id);
    const tokenPayload = parseJsonObject(token?.payload);
    const tokenEventPayload = parseJsonObject(JSON.stringify(tokenPayload?.token ?? tokenPayload));
    const endedAt = row.completed_at ?? row.print_completed_at ?? row.printed_at ?? null;
    const module = scheduledModuleForSession(db, row);
    return {
      session_id: row.session_id,
      kiosk_id: row.kiosk_id,
      started_at: row.started_at,
      ended_at: endedAt,
      duration_ms: durationMs(row.started_at, endedAt),
      package_id: row.package_id,
      package_version: row.package_version,
      module_id: module?.module_id ?? null,
      module_version: module?.module_version ?? null,
      state: row.state,
      token_event: token ? {
        event_id: token.event_id,
        occurred_at: token.occurred_at,
        source: stringField(tokenEventPayload?.source),
        denomination_cents: numberField(tokenEventPayload?.denomination_cents),
        payload: tokenEventPayload,
      } : null,
      result_payload: resultPayload,
      prize: prizeFromPayload(resultPayload, renderPayload),
      ticket_code: row.ticket_code,
      print_status: row.print_status ?? row.ticket_print_status,
      error: row.last_error ?? row.print_error,
    };
  });
}
