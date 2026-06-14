import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const locations = pgTable('locations', {
  locationId: varchar('location_id', { length: 96 }).primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kiosks = pgTable('kiosks', {
  kioskId: varchar('kiosk_id', { length: 96 }).primaryKey(),
  locationId: varchar('location_id', { length: 96 }).notNull().references(() => locations.locationId, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('unknown'),
  agentVersion: text('agent_version'),
  runtimeVersion: text('runtime_version'),
  playerVersion: text('player_version'),
  activePackage: text('active_package'),
  scheduleVersion: integer('schedule_version').notNull().default(0),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  lastSessionAt: timestamp('last_session_at', { withTimezone: true }),
  lastError: text('last_error'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('kiosks_location_idx').on(table.locationId)]);

export const heartbeats = pgTable('heartbeats', {
  heartbeatId: uuid('heartbeat_id').primaryKey().defaultRandom(),
  kioskId: varchar('kiosk_id', { length: 96 }).notNull().references(() => kiosks.kioskId, { onDelete: 'cascade' }),
  locationId: varchar('location_id', { length: 96 }).notNull().references(() => locations.locationId, { onDelete: 'restrict' }),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  payload: jsonb('payload').notNull(),
}, (table) => [index('heartbeats_kiosk_received_idx').on(table.kioskId, table.receivedAt)]);

export const sessions = pgTable('sessions', {
  sessionId: varchar('session_id', { length: 96 }).primaryKey(),
  kioskId: varchar('kiosk_id', { length: 96 }).notNull().references(() => kiosks.kioskId, { onDelete: 'cascade' }),
  packageId: text('package_id'),
  packageVersion: text('package_version'),
  status: varchar('status', { length: 48 }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('sessions_kiosk_created_idx').on(table.kioskId, table.createdAt)]);

export const events = pgTable('events', {
  eventId: varchar('event_id', { length: 128 }).primaryKey(),
  kioskId: varchar('kiosk_id', { length: 96 }).notNull().references(() => kiosks.kioskId, { onDelete: 'cascade' }),
  sessionId: varchar('session_id', { length: 96 }),
  localSequence: integer('local_sequence').notNull(),
  eventType: text('event_type').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  payload: jsonb('payload').notNull().default({}),
  schemaVersion: integer('schema_version').notNull().default(1),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('events_kiosk_local_sequence_uq').on(table.kioskId, table.localSequence),
  index('events_kiosk_occurred_idx').on(table.kioskId, table.occurredAt),
  index('events_session_idx').on(table.sessionId),
]);

export const tickets = pgTable('tickets', {
  ticketId: varchar('ticket_id', { length: 96 }).primaryKey(),
  kioskId: varchar('kiosk_id', { length: 96 }).notNull().references(() => kiosks.kioskId, { onDelete: 'cascade' }),
  sessionId: varchar('session_id', { length: 96 }).references(() => sessions.sessionId, { onDelete: 'set null' }),
  publicTicketId: varchar('public_ticket_id', { length: 64 }).notNull(),
  campaignShortCode: varchar('campaign_short_code', { length: 24 }).notNull(),
  ticketCode: text('ticket_code').notNull(),
  redemptionModel: varchar('redemption_model', { length: 64 }).notNull().default('staff_visual_v1'),
  hmacAlgorithm: varchar('hmac_algorithm', { length: 64 }).notNull(),
  keyVersion: varchar('key_version', { length: 64 }).notNull(),
  checkLength: integer('check_length').notNull(),
  renderPayload: jsonb('render_payload').notNull().default({}),
  printStatus: varchar('print_status', { length: 32 }).notNull().default('unknown'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('tickets_public_ticket_id_uq').on(table.publicTicketId),
  uniqueIndex('tickets_ticket_code_uq').on(table.ticketCode),
  index('tickets_kiosk_created_idx').on(table.kioskId, table.createdAt),
]);

export const deviceCommands = pgTable('device_commands', {
  commandId: varchar('command_id', { length: 96 }).primaryKey(),
  kioskId: varchar('kiosk_id', { length: 96 }).notNull().references(() => kiosks.kioskId, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  payload: jsonb('payload').notNull().default({}),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  requiresConfirmation: boolean('requires_confirmation').notNull().default(false),
  idempotencyKey: text('idempotency_key').notNull(),
  createdBy: text('created_by').notNull().default('system'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('device_commands_kiosk_idempotency_uq').on(table.kioskId, table.idempotencyKey),
  index('device_commands_kiosk_status_idx').on(table.kioskId, table.status, table.expiresAt),
]);

export const commandResults = pgTable('command_results', {
  commandId: varchar('command_id', { length: 96 }).primaryKey().references(() => deviceCommands.commandId, { onDelete: 'cascade' }),
  kioskId: varchar('kiosk_id', { length: 96 }).notNull().references(() => kiosks.kioskId, { onDelete: 'cascade' }),
  status: varchar('status', { length: 32 }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  message: text('message'),
  errorCode: text('error_code'),
  evidence: jsonb('evidence').notNull().default({}),
}, (table) => [index('command_results_kiosk_completed_idx').on(table.kioskId, table.completedAt)]);

export const auditLog = pgTable('audit_log', {
  auditId: uuid('audit_id').primaryKey().defaultRandom(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  subjectType: varchar('subject_type', { length: 64 }).notNull(),
  subjectId: text('subject_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').notNull().default({}),
}, (table) => [
  index('audit_subject_idx').on(table.subjectType, table.subjectId),
  index('audit_occurred_idx').on(table.occurredAt),
]);
