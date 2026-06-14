import type { LocalDatabase } from './db/sqlite.js';
import { appendEvent } from './events.js';
import { generateUlid } from './ids.js';

export const activationModes = ['immediate', 'next-safe-boundary', 'scheduled'] as const;
export const validationStatuses = ['draft', 'valid', 'invalid'] as const;
export const cacheStatuses = ['pending', 'cached', 'failed'] as const;

type ActivationMode = (typeof activationModes)[number];
type ValidationStatus = (typeof validationStatuses)[number];
type CacheStatus = (typeof cacheStatuses)[number];

export interface ScheduleSlotDraft {
  slot_id?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  package_id?: string;
  package_version?: string;
  module_id?: string;
  module_version?: string;
  cache_status?: CacheStatus;
  payload?: Record<string, unknown>;
}

export interface ScheduleDraftInput {
  timezone?: string;
  activation_mode?: ActivationMode;
  package_id?: string;
  package_version?: string;
  module_id?: string;
  module_version?: string;
  validation_status?: ValidationStatus;
  cache_status?: CacheStatus;
  slots?: ScheduleSlotDraft[];
}

export interface ScheduleSlotSnapshot {
  slot_id: string;
  position: number;
  starts_at: string | null;
  ends_at: string | null;
  package_id: string;
  package_version: string;
  module_id: string;
  module_version: string;
  cache_status: CacheStatus;
  payload: Record<string, unknown>;
}

export interface ScheduleSnapshot {
  schedule_id: string;
  status: 'draft';
  timezone: string;
  activation_mode: ActivationMode;
  package_id: string;
  package_version: string;
  module_id: string;
  module_version: string;
  validation_status: ValidationStatus;
  cache_status: CacheStatus;
  previous_known_good_schedule: ScheduleSnapshot | null;
  created_at: string;
  updated_at: string;
  slots: ScheduleSlotSnapshot[];
}

export interface RuntimeModuleSnapshot {
  schedule_id: string;
  slot_id: string | null;
  package_id: string;
  package_version: string;
  module_id: string;
  module_version: string;
  starts_at: string | null;
  ends_at: string | null;
  activation_mode: ActivationMode;
}

export interface RuntimeSchedulerSnapshot {
  active_schedule: ScheduleSnapshot | null;
  pending_schedule: ScheduleSnapshot | null;
  current_module: RuntimeModuleSnapshot | null;
  next_module: RuntimeModuleSnapshot | null;
}

export class ScheduleValidationError extends Error {
  readonly statusCode = 400;
  readonly details: string[];

  constructor(details: string[]) {
    super(details.join('; '));
    this.name = 'ScheduleValidationError';
    this.details = details;
  }
}

export class ScheduleConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'ScheduleConflictError';
  }
}

interface ScheduleRow {
  schedule_id: string;
  status: 'draft';
  timezone: string;
  activation_mode: ActivationMode;
  package_id: string;
  package_version: string;
  module_id: string;
  module_version: string;
  validation_status: ValidationStatus;
  cache_status: CacheStatus;
  previous_known_good_snapshot: string | null;
  created_at: string;
  updated_at: string;
}

interface ScheduleSlotRow {
  slot_id: string;
  position: number;
  starts_at: string | null;
  ends_at: string | null;
  package_id: string;
  package_version: string;
  module_id: string;
  module_version: string;
  cache_status: CacheStatus;
  payload: string;
}

interface ActiveSessionRow {
  session_id: string;
  state: string;
}

interface RuntimeStateScheduleRow {
  schedule_version: string | null;
  active_package_id: string | null;
  active_package_version: string | null;
}

const activeSessionStates = ['token_received', 'session_starting', 'playing', 'result_pending', 'print_requested', 'printing', 'degraded_printer'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, errors: string[]): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  errors.push(`${field} is required`);
  return '';
}

function optionalString(value: unknown, field: string, fallback: string, errors: string[]): string {
  if (value === undefined) return fallback;
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  errors.push(`${field} must be a non-empty string`);
  return fallback;
}

function optionalNullableString(value: unknown, field: string, errors: string[]): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  errors.push(`${field} must be null or a non-empty string`);
  return null;
}

function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[], fallback: T, errors: string[]): T {
  if (value === undefined) return fallback;
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  errors.push(`${field} must be one of: ${allowed.join(', ')}`);
  return fallback;
}

function assertActiveSessionAbsent(db: LocalDatabase): void {
  const active = db.prepare(
    `SELECT session_id, state FROM sessions WHERE state IN (${activeSessionStates.map(() => '?').join(', ')}) ORDER BY updated_at DESC LIMIT 1`,
  ).get(...activeSessionStates) as ActiveSessionRow | undefined;
  if (active) throw new ScheduleConflictError(`active session already exists: ${active.session_id} (${active.state})`);
}

function snapshotFromRow(db: LocalDatabase, row: ScheduleRow): ScheduleSnapshot {
  const slots = db.prepare(`SELECT slot_id, position, starts_at, ends_at, package_id, package_version, module_id, module_version, cache_status, payload
    FROM schedule_slots WHERE schedule_id = ? ORDER BY position ASC`).all(row.schedule_id) as ScheduleSlotRow[];
  return {
    schedule_id: row.schedule_id,
    status: row.status,
    timezone: row.timezone,
    activation_mode: row.activation_mode,
    package_id: row.package_id,
    package_version: row.package_version,
    module_id: row.module_id,
    module_version: row.module_version,
    validation_status: row.validation_status,
    cache_status: row.cache_status,
    previous_known_good_schedule: row.previous_known_good_snapshot ? JSON.parse(row.previous_known_good_snapshot) as ScheduleSnapshot : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    slots: slots.map((slot) => ({
      slot_id: slot.slot_id,
      position: slot.position,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      package_id: slot.package_id,
      package_version: slot.package_version,
      module_id: slot.module_id,
      module_version: slot.module_version,
      cache_status: slot.cache_status,
      payload: JSON.parse(slot.payload) as Record<string, unknown>,
    })),
  };
}

function getScheduleRow(db: LocalDatabase, scheduleId: string): ScheduleRow | undefined {
  return db.prepare(`SELECT schedule_id, status, timezone, activation_mode, package_id, package_version, module_id, module_version,
    validation_status, cache_status, previous_known_good_snapshot, created_at, updated_at FROM schedules WHERE schedule_id = ?`).get(scheduleId) as ScheduleRow | undefined;
}

function validateScheduleDraft(body: unknown): ScheduleDraftInput & { slots: ScheduleSlotDraft[] } {
  const errors: string[] = [];
  if (!isRecord(body)) throw new ScheduleValidationError(['body must be an object']);

  const timezone = optionalString(body.timezone, 'timezone', 'UTC', errors);
  const activationMode = enumValue(body.activation_mode, 'activation_mode', activationModes, 'scheduled', errors);
  const packageId = requiredString(body.package_id, 'package_id', errors);
  const packageVersion = requiredString(body.package_version, 'package_version', errors);
  const moduleId = requiredString(body.module_id, 'module_id', errors);
  const moduleVersion = requiredString(body.module_version, 'module_version', errors);
  const validationStatus = enumValue(body.validation_status, 'validation_status', validationStatuses, 'draft', errors);
  const cacheStatus = enumValue(body.cache_status, 'cache_status', cacheStatuses, 'pending', errors);

  if (!Array.isArray(body.slots) || body.slots.length === 0) {
    errors.push('slots must be a non-empty array');
  }

  const slots = Array.isArray(body.slots) ? body.slots.map((rawSlot, index): ScheduleSlotDraft => {
    if (!isRecord(rawSlot)) {
      errors.push(`slots[${index}] must be an object`);
      return { package_id: packageId, package_version: packageVersion, module_id: moduleId, module_version: moduleVersion, cache_status: 'pending' };
    }
    const startsAt = optionalNullableString(rawSlot.starts_at, `slots[${index}].starts_at`, errors);
    const endsAt = optionalNullableString(rawSlot.ends_at, `slots[${index}].ends_at`, errors);
    const startsAtMs = startsAt ? Date.parse(startsAt) : null;
    const endsAtMs = endsAt ? Date.parse(endsAt) : null;
    if (startsAt && Number.isNaN(startsAtMs)) errors.push(`slots[${index}].starts_at must be an ISO date-time`);
    if (endsAt && Number.isNaN(endsAtMs)) errors.push(`slots[${index}].ends_at must be an ISO date-time`);
    if (startsAtMs !== null && endsAtMs !== null && !Number.isNaN(startsAtMs) && !Number.isNaN(endsAtMs) && startsAtMs >= endsAtMs) errors.push(`slots[${index}].starts_at must be before ends_at`);
    const payload = rawSlot.payload === undefined ? {} : rawSlot.payload;
    if (!isRecord(payload)) errors.push(`slots[${index}].payload must be an object`);
    return {
      slot_id: optionalString(rawSlot.slot_id, `slots[${index}].slot_id`, generateUlid(), errors),
      starts_at: startsAt,
      ends_at: endsAt,
      package_id: optionalString(rawSlot.package_id, `slots[${index}].package_id`, packageId, errors),
      package_version: optionalString(rawSlot.package_version, `slots[${index}].package_version`, packageVersion, errors),
      module_id: optionalString(rawSlot.module_id, `slots[${index}].module_id`, moduleId, errors),
      module_version: optionalString(rawSlot.module_version, `slots[${index}].module_version`, moduleVersion, errors),
      cache_status: enumValue(rawSlot.cache_status, `slots[${index}].cache_status`, cacheStatuses, 'pending', errors),
      payload: isRecord(payload) ? payload : {},
    };
  }) : [];

  if (activationMode === 'scheduled' && slots.some((slot) => !slot.starts_at)) errors.push('scheduled activation requires starts_at on every slot');
  if (errors.length > 0) throw new ScheduleValidationError(errors);

  return {
    timezone,
    activation_mode: activationMode,
    package_id: packageId,
    package_version: packageVersion,
    module_id: moduleId,
    module_version: moduleVersion,
    validation_status: validationStatus,
    cache_status: cacheStatus,
    slots,
  };
}

export function listSchedules(db: LocalDatabase): ScheduleSnapshot[] {
  const rows = db.prepare(`SELECT schedule_id, status, timezone, activation_mode, package_id, package_version, module_id, module_version,
    validation_status, cache_status, previous_known_good_snapshot, created_at, updated_at FROM schedules ORDER BY updated_at DESC`).all() as ScheduleRow[];
  return rows.map((row) => snapshotFromRow(db, row));
}

export function getSchedule(db: LocalDatabase, scheduleId: string): ScheduleSnapshot | null {
  const row = getScheduleRow(db, scheduleId);
  return row ? snapshotFromRow(db, row) : null;
}

function activeSession(db: LocalDatabase): ActiveSessionRow | null {
  return db.prepare(
    `SELECT session_id, state FROM sessions WHERE state IN (${activeSessionStates.map(() => '?').join(', ')}) ORDER BY updated_at DESC LIMIT 1`,
  ).get(...activeSessionStates) as ActiveSessionRow | undefined ?? null;
}

function listValidCachedSchedules(db: LocalDatabase): ScheduleSnapshot[] {
  return listSchedules(db).filter((schedule) => schedule.validation_status === 'valid' && schedule.cache_status === 'cached');
}

function runtimeModuleFromSchedule(schedule: ScheduleSnapshot, slot: ScheduleSlotSnapshot | null): RuntimeModuleSnapshot {
  return {
    schedule_id: schedule.schedule_id,
    slot_id: slot?.slot_id ?? null,
    package_id: slot?.package_id ?? schedule.package_id,
    package_version: slot?.package_version ?? schedule.package_version,
    module_id: slot?.module_id ?? schedule.module_id,
    module_version: slot?.module_version ?? schedule.module_version,
    starts_at: slot?.starts_at ?? null,
    ends_at: slot?.ends_at ?? null,
    activation_mode: schedule.activation_mode,
  };
}

function currentSlot(schedule: ScheduleSnapshot, nowMs: number): ScheduleSlotSnapshot | null {
  return schedule.slots.find((slot) => {
    const start = slot.starts_at ? Date.parse(slot.starts_at) : Number.NEGATIVE_INFINITY;
    const end = slot.ends_at ? Date.parse(slot.ends_at) : Number.POSITIVE_INFINITY;
    return !Number.isNaN(start) && !Number.isNaN(end) && start <= nowMs && nowMs < end;
  }) ?? schedule.slots[0] ?? null;
}

function nextSlot(schedule: ScheduleSnapshot, nowMs: number): ScheduleSlotSnapshot | null {
  return [...schedule.slots]
    .filter((slot) => slot.starts_at && Date.parse(slot.starts_at) > nowMs)
    .sort((a, b) => Date.parse(a.starts_at ?? '') - Date.parse(b.starts_at ?? ''))[0] ?? null;
}

export function readRuntimeScheduler(db: LocalDatabase, now = new Date()): RuntimeSchedulerSnapshot {
  const runtime = db.prepare('SELECT schedule_version, active_package_id, active_package_version FROM runtime_state WHERE id = 1').get() as RuntimeStateScheduleRow | undefined;
  const validCached = listValidCachedSchedules(db);
  const active = runtime?.schedule_version ? getSchedule(db, runtime.schedule_version) : null;
  const activeSchedule = active?.validation_status === 'valid' && active.cache_status === 'cached'
    ? active
    : validCached.find((schedule) => schedule.package_id === runtime?.active_package_id && schedule.package_version === runtime?.active_package_version) ?? null;
  const activeUpdatedMs = activeSchedule ? Date.parse(activeSchedule.updated_at) : Number.NEGATIVE_INFINITY;
  const pendingSchedule = validCached.find((schedule) => {
    if (schedule.activation_mode !== 'next-safe-boundary' || schedule.schedule_id === activeSchedule?.schedule_id) return false;
    const updatedMs = Date.parse(schedule.updated_at);
    return Number.isNaN(updatedMs) || updatedMs >= activeUpdatedMs;
  }) ?? null;
  const nowMs = now.getTime();
  const activeCurrentSlot = activeSchedule ? currentSlot(activeSchedule, nowMs) : null;
  const activeNextSlot = activeSchedule ? nextSlot(activeSchedule, nowMs) : null;
  const currentModule = activeSchedule ? runtimeModuleFromSchedule(activeSchedule, activeCurrentSlot) : null;
  const nextModule = pendingSchedule
    ? runtimeModuleFromSchedule(pendingSchedule, currentSlot(pendingSchedule, nowMs))
    : activeSchedule && activeNextSlot ? runtimeModuleFromSchedule(activeSchedule, activeNextSlot) : null;
  return { active_schedule: activeSchedule, pending_schedule: pendingSchedule, current_module: currentModule, next_module: nextModule };
}

export function activatePendingScheduleAtSafeBoundary(db: LocalDatabase, input: { kioskId: string; now?: Date }): ScheduleSnapshot | null {
  if (activeSession(db)) return null;
  const now = input.now ?? new Date();
  const snapshot = readRuntimeScheduler(db, now);
  const pending = snapshot.pending_schedule;
  if (!pending) return null;
  const tx = db.transaction(() => {
    db.prepare('UPDATE runtime_state SET kiosk_id = ?, active_package_id = ?, active_package_version = ?, schedule_version = ?, updated_at = ?, last_error = NULL WHERE id = 1').run(
      input.kioskId,
      pending.package_id,
      pending.package_version,
      pending.schedule_id,
      now.toISOString(),
    );
    db.prepare(`INSERT INTO schedule_audit_events (audit_id, schedule_id, action, occurred_at, actor, payload)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      generateUlid(),
      pending.schedule_id,
      'schedule_activated_at_safe_boundary',
      now.toISOString(),
      'local-backend',
      JSON.stringify({ schedule_id: pending.schedule_id, package_id: pending.package_id, package_version: pending.package_version, module_id: pending.module_id, module_version: pending.module_version }),
    );
    appendEvent(db, {
      kioskId: input.kioskId,
      eventType: 'schedule_activated_at_safe_boundary',
      payload: { schedule_id: pending.schedule_id, package_id: pending.package_id, package_version: pending.package_version, module_id: pending.module_id, module_version: pending.module_version },
      occurredAt: now.toISOString(),
    });
  });
  tx();
  return pending;
}

export function activeRuntimeModule(db: LocalDatabase, fallback: { packageId: string; packageVersion: string }): RuntimeModuleSnapshot {
  const scheduler = readRuntimeScheduler(db);
  return scheduler.current_module ?? {
    schedule_id: 'runtime-config',
    slot_id: null,
    package_id: fallback.packageId,
    package_version: fallback.packageVersion,
    module_id: fallback.packageId,
    module_version: fallback.packageVersion,
    starts_at: null,
    ends_at: null,
    activation_mode: 'immediate',
  };
}

export function updateDraftSchedule(db: LocalDatabase, input: { scheduleId: string; kioskId: string; body: unknown }): ScheduleSnapshot {
  const draft = validateScheduleDraft(input.body);
  const tx = db.transaction(() => {
    const now = new Date().toISOString();
    const existingRow = getScheduleRow(db, input.scheduleId);
    const existingSnapshot = existingRow ? snapshotFromRow(db, existingRow) : null;
    const previousKnownGood = existingSnapshot?.validation_status === 'valid'
      ? JSON.stringify({ ...existingSnapshot, previous_known_good_schedule: null })
      : existingRow?.previous_known_good_snapshot ?? null;

    if (existingRow) {
      db.prepare(`UPDATE schedules SET timezone = ?, activation_mode = ?, package_id = ?, package_version = ?, module_id = ?, module_version = ?,
        validation_status = ?, cache_status = ?, previous_known_good_snapshot = ?, updated_at = ? WHERE schedule_id = ?`).run(
        draft.timezone,
        draft.activation_mode,
        draft.package_id,
        draft.package_version,
        draft.module_id,
        draft.module_version,
        draft.validation_status,
        draft.cache_status,
        previousKnownGood,
        now,
        input.scheduleId,
      );
      db.prepare('DELETE FROM schedule_slots WHERE schedule_id = ?').run(input.scheduleId);
    } else {
      db.prepare(`INSERT INTO schedules (schedule_id, status, timezone, activation_mode, package_id, package_version, module_id, module_version,
        validation_status, cache_status, previous_known_good_snapshot, created_at, updated_at)
        VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`).run(
        input.scheduleId,
        draft.timezone,
        draft.activation_mode,
        draft.package_id,
        draft.package_version,
        draft.module_id,
        draft.module_version,
        draft.validation_status,
        draft.cache_status,
        now,
        now,
      );
    }

    for (const [position, slot] of draft.slots.entries()) {
      db.prepare(`INSERT INTO schedule_slots (slot_id, schedule_id, position, starts_at, ends_at, package_id, package_version, module_id, module_version, cache_status, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        slot.slot_id ?? generateUlid(),
        input.scheduleId,
        position,
        slot.starts_at ?? null,
        slot.ends_at ?? null,
        slot.package_id,
        slot.package_version,
        slot.module_id,
        slot.module_version,
        slot.cache_status,
        JSON.stringify(slot.payload ?? {}),
      );
    }

    const snapshot = getSchedule(db, input.scheduleId);
    if (!snapshot) throw new Error(`failed to persist schedule ${input.scheduleId}`);
    db.prepare(`INSERT INTO schedule_audit_events (audit_id, schedule_id, action, occurred_at, actor, payload)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      generateUlid(),
      input.scheduleId,
      existingRow ? 'draft_schedule_updated' : 'draft_schedule_created',
      now,
      'local-backend',
      JSON.stringify({ schedule_id: input.scheduleId, validation_status: snapshot.validation_status, cache_status: snapshot.cache_status }),
    );
    appendEvent(db, {
      kioskId: input.kioskId,
      eventType: existingRow ? 'draft_schedule_updated' : 'draft_schedule_created',
      payload: { schedule_id: input.scheduleId, validation_status: snapshot.validation_status, cache_status: snapshot.cache_status },
      occurredAt: now,
    });
    return snapshot;
  });
  return tx();
}
