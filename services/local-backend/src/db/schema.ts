import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const runtimeState = sqliteTable('runtime_state', {
  id: integer('id').primaryKey(),
  kioskId: text('kiosk_id'),
  currentSessionId: text('current_session_id'),
  localSequence: integer('local_sequence').notNull().default(0),
  mode: text('mode').notNull().default('booting'),
  activePackageId: text('active_package_id'),
  activePackageVersion: text('active_package_version'),
  scheduleVersion: text('schedule_version'),
  lastHeartbeatAt: text('last_heartbeat_at'),
  lastError: text('last_error'),
  updatedAt: text('updated_at').notNull(),
});

export const deviceState = sqliteTable('device_state', {
  id: integer('id').primaryKey(),
  deviceType: text('device_type').notNull(),
  deviceId: text('device_id').notNull(),
  status: text('status').notNull(),
  health: text('health', { mode: 'json' }).notNull().default({}),
  lastSeenAt: text('last_seen_at'),
  lastError: text('last_error'),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  deviceUnique: uniqueIndex('device_state_type_id_unique').on(table.deviceType, table.deviceId),
}));

export const sessions = sqliteTable('sessions', {
  sessionId: text('session_id').primaryKey(),
  kioskId: text('kiosk_id').notNull(),
  packageId: text('package_id').notNull(),
  packageVersion: text('package_version').notNull(),
  state: text('state').notNull(),
  sessionLanguage: text('session_language'),
  quizAttempts: integer('quiz_attempts').notNull().default(0),
  quizPassed: integer('quiz_passed', { mode: 'boolean' }).notNull().default(false),
  tokenPayload: text('token_payload', { mode: 'json' }),
  resultPayload: text('result_payload', { mode: 'json' }),
  startedAt: text('started_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at'),
  lastError: text('last_error'),
}, (table) => ({
  sessionKioskIdx: index('sessions_kiosk_idx').on(table.kioskId),
  sessionStateIdx: index('sessions_state_idx').on(table.state),
}));

export const events = sqliteTable('events', {
  eventId: text('event_id').primaryKey(),
  kioskId: text('kiosk_id').notNull(),
  sessionId: text('session_id').references(() => sessions.sessionId),
  localSequence: integer('local_sequence').notNull(),
  eventType: text('event_type').notNull(),
  occurredAt: text('occurred_at').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  schemaVersion: integer('schema_version').notNull().default(1),
}, (table) => ({
  sequenceUnique: uniqueIndex('events_local_sequence_unique').on(table.localSequence),
  eventSessionIdx: index('events_session_idx').on(table.sessionId),
  eventTypeIdx: index('events_type_idx').on(table.eventType),
}));

export const syncQueue = sqliteTable('sync_queue', {
  syncId: text('sync_id').primaryKey(),
  eventId: text('event_id').notNull().references(() => events.eventId, { onDelete: 'cascade' }),
  localSequence: integer('local_sequence').notNull(),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: text('next_attempt_at'),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  syncEventUnique: uniqueIndex('sync_queue_event_unique').on(table.eventId),
  syncStatusIdx: index('sync_queue_status_idx').on(table.status),
}));

export const tickets = sqliteTable('tickets', {
  ticketId: text('ticket_id').primaryKey(),
  ticketCode: text('ticket_code').notNull(),
  kioskId: text('kiosk_id').notNull(),
  sessionId: text('session_id').notNull().references(() => sessions.sessionId),
  packageId: text('package_id').notNull(),
  packageVersion: text('package_version').notNull(),
  campaignShortCode: text('campaign_short_code').notNull(),
  publicTicketId: text('public_ticket_id').notNull(),
  keyVersion: text('key_version').notNull(),
  hmacAlgorithm: text('hmac_algorithm').notNull(),
  checkLength: integer('check_length').notNull(),
  redemptionModel: text('redemption_model').notNull(),
  renderPayload: text('render_payload', { mode: 'json' }).notNull(),
  printStatus: text('print_status').notNull(),
  createdAt: text('created_at').notNull(),
  printedAt: text('printed_at'),
}, (table) => ({
  ticketCodeUnique: uniqueIndex('tickets_code_unique').on(table.ticketCode),
  ticketPublicUnique: uniqueIndex('tickets_public_unique').on(table.publicTicketId),
  ticketSessionIdx: index('tickets_session_idx').on(table.sessionId),
}));

export const printJobs = sqliteTable('print_jobs', {
  printJobId: text('print_job_id').primaryKey(),
  ticketId: text('ticket_id').references(() => tickets.ticketId),
  sessionId: text('session_id').references(() => sessions.sessionId),
  kioskId: text('kiosk_id').notNull(),
  status: text('status').notNull(),
  requestPayload: text('request_payload', { mode: 'json' }).notNull(),
  resultPayload: text('result_payload', { mode: 'json' }),
  attempts: integer('attempts').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at'),
  lastError: text('last_error'),
}, (table) => ({
  printSessionIdx: index('print_jobs_session_idx').on(table.sessionId),
  printStatusIdx: index('print_jobs_status_idx').on(table.status),
}));

export const schedules = sqliteTable('schedules', {
  scheduleId: text('schedule_id').primaryKey(),
  status: text('status').notNull().default('draft'),
  timezone: text('timezone').notNull(),
  activationMode: text('activation_mode').notNull(),
  packageId: text('package_id').notNull(),
  packageVersion: text('package_version').notNull(),
  moduleId: text('module_id').notNull(),
  moduleVersion: text('module_version').notNull(),
  validationStatus: text('validation_status').notNull().default('draft'),
  cacheStatus: text('cache_status').notNull().default('pending'),
  previousKnownGoodSnapshot: text('previous_known_good_snapshot', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  scheduleStatusIdx: index('schedules_status_idx').on(table.status),
  scheduleUpdatedAtIdx: index('schedules_updated_at_idx').on(table.updatedAt),
}));

export const scheduleSlots = sqliteTable('schedule_slots', {
  slotId: text('slot_id').primaryKey(),
  scheduleId: text('schedule_id').notNull().references(() => schedules.scheduleId, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  startsAt: text('starts_at'),
  endsAt: text('ends_at'),
  packageId: text('package_id').notNull(),
  packageVersion: text('package_version').notNull(),
  moduleId: text('module_id').notNull(),
  moduleVersion: text('module_version').notNull(),
  cacheStatus: text('cache_status').notNull().default('pending'),
  payload: text('payload', { mode: 'json' }).notNull().default({}),
}, (table) => ({
  scheduleSlotScheduleIdx: index('schedule_slots_schedule_idx').on(table.scheduleId),
  scheduleSlotPositionUnique: uniqueIndex('schedule_slots_schedule_position_unique').on(table.scheduleId, table.position),
}));

export const scheduleAuditEvents = sqliteTable('schedule_audit_events', {
  auditId: text('audit_id').primaryKey(),
  scheduleId: text('schedule_id').notNull().references(() => schedules.scheduleId, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  occurredAt: text('occurred_at').notNull(),
  actor: text('actor').notNull(),
  payload: text('payload', { mode: 'json' }).notNull().default({}),
}, (table) => ({
  scheduleAuditScheduleIdx: index('schedule_audit_events_schedule_idx').on(table.scheduleId),
}));
