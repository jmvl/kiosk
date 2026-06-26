import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, relative } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import websocket from '@fastify/websocket';
import type { EventEnvelope, SessionSnapshot } from '@retail-kiosk/shared-types';
import type { LocalDatabase } from './db/sqlite.js';
import { migrateDatabase } from './db/migrations.js';
import { openLocalDatabase } from './db/sqlite.js';
import { appendEvent } from './events.js';
import { CupsPrinterAdapter, FakePrinterAdapter, FakeTokenAdapter, SerialTokenAdapter, type PrinterAdapter, type TokenAdapter } from './hardware.js';
import { createSession, getSession, transitionSession } from './session.js';
import { activeRuntimeModule, activatePendingScheduleAtSafeBoundary, getSchedule, listSchedules, readRuntimeScheduler, ScheduleConflictError, ScheduleValidationError, updateDraftSchedule } from './schedules.js';
import { createTicket } from './tickets.js';
import { collectAdminTelemetry } from './telemetry.js';
import { listGameRunLog } from './game-runs.js';
import { buildTicketRenderPayload, campaignConfigFromPayload, isSessionLanguage, printRequestPayload, selectWeightedOutcome, submitQuizAnswer } from './game-flow.js';

export interface LocalBackendConfig {
  kioskId: string;
  packageId: string;
  packageVersion: string;
  campaignShortCode: string;
  devRoutesEnabled: boolean;
  authToken?: string;
  allowedOrigins: readonly string[];
  ticketSecret: string;
  host: string;
  port: number;
  playerStaticDir: string;
  adminStaticDir: string;
  hardwareMode: 'fake' | 'real';
  serialTokenPort: string;
  serialTokenBaudRate: number;
  serialTokenDebounceMs: number;
  serialTokenReconnectMs: number;
  cupsPrinterName: string;
}

export interface LocalBackendRuntime {
  db: LocalDatabase;
  tokenAdapter: TokenAdapter;
  printerAdapter: PrinterAdapter;
  config: LocalBackendConfig;
}

interface RuntimeStateRow {
  kiosk_id: string | null;
  current_session_id: string | null;
  local_sequence: number;
  mode: string;
  active_package_id: string | null;
  active_package_version: string | null;
  last_heartbeat_at: string | null;
  last_error: string | null;
  updated_at: string;
}

const defaultTicketSecret = 'local-dev-fake-ticket-secret-change-before-production';

function parseOrigins(value: string | undefined): string[] {
  return (value ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseHardwareMode(value: string | undefined): 'fake' | 'real' {
  return value === 'real' ? 'real' : 'fake';
}

function findWorkspaceRoot(startDir: string): string | null {
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function resolveDefaultStaticDir(envValue: string | undefined, relativePath: string): string {
  if (envValue) return resolve(envValue);
  return resolve(findWorkspaceRoot(process.cwd()) ?? process.cwd(), relativePath);
}

export function localBackendConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LocalBackendConfig {
  return {
    kioskId: env.LOCAL_BACKEND_KIOSK_ID ?? 'HQ001',
    packageId: env.LOCAL_BACKEND_PACKAGE_ID ?? 'chocomel-wheel',
    packageVersion: env.LOCAL_BACKEND_PACKAGE_VERSION ?? '1.0.0',
    campaignShortCode: env.LOCAL_BACKEND_CAMPAIGN_SHORT_CODE ?? 'CHO',
    devRoutesEnabled: env.LOCAL_BACKEND_ENABLE_DEV_ROUTES === 'true',
    ...(env.LOCAL_BACKEND_AUTH_TOKEN ? { authToken: env.LOCAL_BACKEND_AUTH_TOKEN } : {}),
    allowedOrigins: parseOrigins(env.LOCAL_BACKEND_ALLOWED_ORIGINS),
    ticketSecret: env.TICKET_SIGNING_SECRET ?? defaultTicketSecret,
    host: env.LOCAL_BACKEND_HOST ?? '127.0.0.1',
    port: Number(env.LOCAL_BACKEND_PORT ?? 3377),
    playerStaticDir: resolveDefaultStaticDir(env.PLAYER_STATIC_DIR, 'apps/kiosk-player/dist'),
    adminStaticDir: resolveDefaultStaticDir(env.ADMIN_STATIC_DIR, 'apps/admin-dashboard/dist-web'),
    hardwareMode: parseHardwareMode(env.LOCAL_BACKEND_HARDWARE_MODE),
    serialTokenPort: env.SERIAL_TOKEN_PORT ?? '/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0',
    serialTokenBaudRate: parsePositiveInt(env.SERIAL_TOKEN_BAUD, 9600),
    serialTokenDebounceMs: parsePositiveInt(env.SERIAL_TOKEN_DEBOUNCE_MS, 500),
    serialTokenReconnectMs: parsePositiveInt(env.SERIAL_TOKEN_RECONNECT_MS, 2000),
    cupsPrinterName: env.CUPS_PRINTER_NAME ?? 'ICOD-PT80KM',
  };
}

export function createLocalBackendRuntime(options: Partial<LocalBackendRuntime> & { config?: Partial<LocalBackendConfig> } = {}): LocalBackendRuntime {
  const config = { ...localBackendConfigFromEnv(), ...options.config };
  const db = options.db ?? openLocalDatabase();
  migrateDatabase(db);
  const tokenAdapter = options.tokenAdapter ?? (config.hardwareMode === 'real'
    ? new SerialTokenAdapter({
      port: config.serialTokenPort,
      baudRate: config.serialTokenBaudRate,
      debounceMs: config.serialTokenDebounceMs,
      reconnectMs: config.serialTokenReconnectMs,
    })
    : new FakeTokenAdapter());
  const printerAdapter = options.printerAdapter ?? (config.hardwareMode === 'real'
    ? new CupsPrinterAdapter({ printerName: config.cupsPrinterName })
    : new FakePrinterAdapter());
  return {
    db,
    tokenAdapter,
    printerAdapter,
    config,
  };
}

function readRuntimeState(db: LocalDatabase): RuntimeStateRow {
  return db.prepare('SELECT kiosk_id, current_session_id, local_sequence, mode, active_package_id, active_package_version, last_heartbeat_at, last_error, updated_at FROM runtime_state WHERE id = 1').get() as RuntimeStateRow;
}

function latestTicket(db: LocalDatabase): unknown {
  const row = db.prepare(`SELECT ticket_id, ticket_code, kiosk_id, session_id, package_id, package_version, campaign_short_code, public_ticket_id, key_version, hmac_algorithm, check_length, redemption_model, render_payload, print_status, created_at, printed_at
    FROM tickets ORDER BY created_at DESC LIMIT 1`).get() as Record<string, unknown> | undefined;
  if (!row) return null;
  return { ...row, render_payload: JSON.parse(String(row.render_payload)) };
}

interface ExportedEventRow {
  event_id: string;
  kiosk_id: string;
  session_id: string | null;
  local_sequence: number;
  event_type: string;
  occurred_at: string;
  payload: string;
  schema_version: number;
}

function parseEventPayload(payload: string): Record<string, unknown> {
  const parsed = JSON.parse(payload) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

function exportEvents(db: LocalDatabase, options: { afterSequence?: number | undefined; limit?: number | undefined }): { events: EventEnvelope[]; cursor: { after_sequence: number; next_after_sequence: number | null; count: number; limit: number } } {
  const afterSequence = Number.isFinite(options.afterSequence) ? Math.max(0, Math.trunc(options.afterSequence ?? 0)) : 0;
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(500, Math.trunc(options.limit ?? 100))) : 100;
  const rows = db.prepare(`SELECT event_id, kiosk_id, session_id, local_sequence, event_type, occurred_at, payload, schema_version
    FROM events
    WHERE local_sequence > ?
    ORDER BY local_sequence ASC
    LIMIT ?`).all(afterSequence, limit) as ExportedEventRow[];
  const events = rows.map((row) => ({
    event_id: row.event_id,
    kiosk_id: row.kiosk_id,
    ...(row.session_id === null ? {} : { session_id: row.session_id }),
    local_sequence: row.local_sequence,
    event_type: row.event_type,
    occurred_at: row.occurred_at,
    payload: parseEventPayload(row.payload),
    schema_version: row.schema_version,
  }));
  const last = events.at(-1)?.local_sequence ?? null;
  return { events, cursor: { after_sequence: afterSequence, next_after_sequence: last, count: events.length, limit } };
}

function stateSnapshot(runtime: LocalBackendRuntime): Record<string, unknown> {
  const runtimeState = readRuntimeState(runtime.db);
  let currentSession: SessionSnapshot | null = null;
  if (runtimeState.current_session_id) {
    try {
      currentSession = getSession(runtime.db, runtimeState.current_session_id);
    } catch {
      currentSession = null;
    }
  }
  return {
    runtime: {
      kiosk_id: runtimeState.kiosk_id ?? runtime.config.kioskId,
      mode: runtimeState.mode,
      current_session_id: runtimeState.current_session_id,
      active_package_id: runtimeState.active_package_id ?? runtime.config.packageId,
      active_package_version: runtimeState.active_package_version ?? runtime.config.packageVersion,
      local_sequence: runtimeState.local_sequence,
      last_heartbeat_at: runtimeState.last_heartbeat_at,
      last_error: runtimeState.last_error,
      updated_at: runtimeState.updated_at,
    },
    scheduler: readRuntimeScheduler(runtime.db),
    current_session: currentSession,
    latest_ticket: latestTicket(runtime.db),
    adapters: {
      token: runtime.tokenAdapter.health(),
      printer: runtime.printerAdapter.health(),
    },
  };
}

function requestToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length);
  const header = request.headers['x-local-backend-token'];
  if (header) return Array.isArray(header) ? header[0] : header;
  const query = request.query as Record<string, unknown> | undefined;
  return typeof query?.token === 'string' ? query.token : undefined;
}

function assertAuthorized(runtime: LocalBackendRuntime, request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = request.headers.origin;
  if (runtime.config.allowedOrigins.length > 0 && origin && !runtime.config.allowedOrigins.includes(origin)) {
    void reply.code(403).send({ error: 'origin_not_allowed' });
    return false;
  }
  if (runtime.config.authToken && requestToken(request) !== runtime.config.authToken) {
    void reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

function assertDevEnabled(runtime: LocalBackendRuntime, reply: FastifyReply): boolean {
  if (!runtime.config.devRoutesEnabled) {
    void reply.code(404).send({ error: 'dev_routes_disabled' });
    return false;
  }
  return true;
}

function assertLocalSchedulerEnabled(_runtime: LocalBackendRuntime, _reply: FastifyReply): boolean {
  return true;
}

function scheduleIdParam(request: FastifyRequest): string {
  return (request.params as { scheduleId?: string }).scheduleId ?? '';
}

function sendScheduleError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof ScheduleValidationError) {
    return reply.code(400).send({ error: 'schedule_validation_failed', details: error.details });
  }
  if (error instanceof ScheduleConflictError) {
    return reply.code(409).send({ error: 'active_session_in_progress', message: error.message });
  }
  throw error;
}

function setMode(db: LocalDatabase, mode: 'maintenance' | 'idle', kioskId: string): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE runtime_state SET kiosk_id = ?, mode = ?, current_session_id = NULL, updated_at = ?, last_error = NULL WHERE id = 1').run(kioskId, mode, now);
  appendEvent(db, { kioskId, eventType: `maintenance_${mode === 'maintenance' ? 'entered' : 'exited'}`, payload: { mode }, occurredAt: now });
}

function forceResetRuntime(db: LocalDatabase, kioskId: string, reason: string): void {
  const now = new Date().toISOString();
  const runtime = readRuntimeState(db);
  if (runtime.current_session_id) {
    try {
      transitionSession(db, runtime.current_session_id, 'resetting', { lastError: reason });
      transitionSession(db, runtime.current_session_id, 'idle');
    } catch (error) {
      appendEvent(db, {
        kioskId,
        sessionId: runtime.current_session_id,
        eventType: 'admin_reset_force_transition_failed',
        payload: { reason, error: error instanceof Error ? error.message : String(error) },
        occurredAt: now,
      });
      db.prepare('UPDATE runtime_state SET kiosk_id = ?, mode = ?, current_session_id = NULL, updated_at = ?, last_error = NULL WHERE id = 1').run(kioskId, 'idle', now);
    }
  } else {
    db.prepare('UPDATE runtime_state SET kiosk_id = ?, mode = ?, current_session_id = NULL, updated_at = ?, last_error = NULL WHERE id = 1').run(kioskId, 'idle', now);
  }
  appendEvent(db, { kioskId, eventType: 'admin_session_reset', payload: { reason }, occurredAt: now });
}

function startSession(runtime: LocalBackendRuntime, triggerPayload: Record<string, unknown>): SessionSnapshot {
  const activeModule = activeRuntimeModule(runtime.db, { packageId: runtime.config.packageId, packageVersion: runtime.config.packageVersion });
  const session = createSession(runtime.db, {
    kioskId: runtime.config.kioskId,
    packageId: activeModule.package_id,
    packageVersion: activeModule.package_version,
    tokenPayload: triggerPayload,
  });
  const starting = transitionSession(runtime.db, session.session_id, 'session_starting');
  const playing = transitionSession(runtime.db, starting.session_id, 'playing');
  appendEvent(runtime.db, { kioskId: runtime.config.kioskId, sessionId: playing.session_id, eventType: 'session_started', payload: { package_id: playing.package_id, package_version: playing.package_version } });
  return playing;
}

function activeCampaignConfig(runtime: LocalBackendRuntime): ReturnType<typeof campaignConfigFromPayload> {
  const activeModule = activeRuntimeModule(runtime.db, { packageId: runtime.config.packageId, packageVersion: runtime.config.packageVersion });
  return campaignConfigFromPayload(activeModule.payload);
}

function activeCampaignPreview(runtime: LocalBackendRuntime): Record<string, unknown> {
  const activeModule = activeRuntimeModule(runtime.db, { packageId: runtime.config.packageId, packageVersion: runtime.config.packageVersion });
  const payload = activeModule.payload;
  const outcomeStrategy = typeof payload.outcome_strategy === 'object' && payload.outcome_strategy !== null && !Array.isArray(payload.outcome_strategy)
    ? payload.outcome_strategy as Record<string, unknown>
    : {};
  return {
    package_id: activeModule.package_id,
    package_version: activeModule.package_version,
    module_id: activeModule.module_id,
    module_version: activeModule.module_version,
    schedule_id: activeModule.schedule_id,
    slot_id: activeModule.slot_id,
    access: {
      surface: 'local-admin-preview',
      intended_roles: ['superadmin', 'campaign-owner'],
      auth_status: runtime.config.authToken ? 'local-token-only' : 'not-configured',
      editing_supported: false,
      store_operator_editing: 'disabled-read-only-v1',
      boundary_note: 'HQ-only campaign content preview. Production auth, central permissions, and store operator content editing are not implemented in this local bootstrap.',
    },
    campaign_short_code: payload.campaign_short_code ?? runtime.config.campaignShortCode,
    quiz: payload.quiz ?? null,
    outcome_strategy: {
      authority: outcomeStrategy.authority ?? null,
      offline_required: outcomeStrategy.offline_required ?? null,
      selection: outcomeStrategy.selection ?? null,
      outcomes: outcomeStrategy.outcomes ?? [],
    },
    ticket_templates: payload.ticket_templates ?? [],
    bitmap_assets: payload.bitmap_assets ?? [],
    qr_payload_patterns: Array.isArray(outcomeStrategy.outcomes)
      ? outcomeStrategy.outcomes
        .filter((outcome): outcome is Record<string, unknown> => typeof outcome === 'object' && outcome !== null && !Array.isArray(outcome) && typeof outcome.qr_payload_template === 'string')
        .map((outcome) => ({ outcome_id: outcome.outcome_id ?? null, qr_payload_template: outcome.qr_payload_template }))
      : [],
    visual_wheel: payload.visual_wheel ?? null,
  };
}

const staticContentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safeStaticPath(rootDir: string, requestPath: string): string | null {
  const normalizedPath = requestPath === '' || requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const candidate = resolve(rootDir, normalizedPath);
  const rootRelativePath = relative(rootDir, candidate);
  if (rootRelativePath.startsWith('..') || rootRelativePath === '' || rootRelativePath.includes('..')) return null;
  return candidate;
}

async function sendStaticFile(rootDir: string, requestPath: string, reply: FastifyReply, label: 'player' | 'admin'): Promise<FastifyReply> {
  const staticPath = safeStaticPath(rootDir, requestPath);
  if (!staticPath) return reply.code(404).send({ error: `${label}_asset_not_found` });
  try {
    const fileStat = await stat(staticPath);
    if (!fileStat.isFile()) return reply.code(404).send({ error: `${label}_asset_not_found` });
  } catch {
    if (requestPath !== '' && requestPath !== '/') return sendStaticFile(rootDir, '', reply, label);
    return reply.code(404).send({ error: `${label}_build_not_found`, path: rootDir });
  }
  reply.header('Cache-Control', extname(staticPath) === '.html' ? 'no-store' : 'public, max-age=31536000, immutable');
  reply.type(staticContentTypes[extname(staticPath).toLowerCase()] ?? 'application/octet-stream');
  return reply.send(createReadStream(staticPath));
}

async function sendPlayerStaticFile(runtime: LocalBackendRuntime, requestPath: string, reply: FastifyReply): Promise<FastifyReply> {
  return sendStaticFile(runtime.config.playerStaticDir, requestPath, reply, 'player');
}

async function sendAdminStaticFile(runtime: LocalBackendRuntime, requestPath: string, reply: FastifyReply): Promise<FastifyReply> {
  return sendStaticFile(runtime.config.adminStaticDir, requestPath, reply, 'admin');
}

export async function createLocalBackendServer(runtime = createLocalBackendRuntime()): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(websocket);
  const sockets = new Set<{ send: (data: string) => void; readyState?: number }>();

  function broadcastState(): void {
    const message = JSON.stringify({ type: 'state', state: stateSnapshot(runtime) });
    for (const socket of sockets) {
      try {
        socket.send(message);
      } catch {
        sockets.delete(socket);
      }
    }
  }

  runtime.tokenAdapter.onToken?.((token) => {
    try {
      if ((token as { source?: unknown }).source === 'serial') {
        appendEvent(runtime.db, {
          kioskId: runtime.config.kioskId,
          eventType: 'serial_token_detected',
          payload: { token },
        });
      }
      startSession(runtime, token as unknown as Record<string, unknown>);
      broadcastState();
    } catch (error) {
      appendEvent(runtime.db, {
        kioskId: runtime.config.kioskId,
        eventType: 'serial_token_rejected',
        payload: { token, error: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const originAllowed = !origin || runtime.config.allowedOrigins.length === 0 || runtime.config.allowedOrigins.includes(origin);
    if (origin && originAllowed) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Local-Backend-Token');
    }
    if (request.method === 'OPTIONS') {
      if (!originAllowed) return reply.code(403).send({ error: 'origin_not_allowed' });
      return reply.code(204).send();
    }
    if (!assertAuthorized(runtime, request, reply)) return reply;
  });

  app.options('/*', async (_request, reply) => reply.code(204).send());

  app.get('/player', async (_request, reply) => sendPlayerStaticFile(runtime, '', reply));
  app.get('/player/*', async (request, reply) => {
    const params = request.params as { '*': string };
    return sendPlayerStaticFile(runtime, params['*'] ?? '', reply);
  });

  app.get('/admin', async (_request, reply) => sendAdminStaticFile(runtime, '', reply));
  app.get('/admin/api/campaign-preview', async () => activeCampaignPreview(runtime));
  app.get('/admin/api/telemetry', async () => collectAdminTelemetry(runtime.config));
  app.get('/admin/api/game-runs', async () => ({ runs: listGameRunLog(runtime.db, 20) }));
  app.get('/admin/api/events/export', async (request) => {
    const query = request.query as Record<string, unknown>;
    return exportEvents(runtime.db, {
      afterSequence: typeof query.after_sequence === 'string' ? Number(query.after_sequence) : undefined,
      limit: typeof query.limit === 'string' ? Number(query.limit) : undefined,
    });
  });
  app.get('/telemetry', async () => collectAdminTelemetry(runtime.config));
  app.get('/game-runs', async () => ({ runs: listGameRunLog(runtime.db, 20) }));
  app.get('/admin/*', async (request, reply) => {
    const params = request.params as { '*': string };
    return sendAdminStaticFile(runtime, params['*'] ?? '', reply);
  });

  app.get('/health', async () => ({ status: 'ok', runtime: 'local-backend', fake_hardware: runtime.tokenAdapter.fake && runtime.printerAdapter.fake, hardware_mode: runtime.config.hardwareMode, adapters: stateSnapshot(runtime).adapters }));

  app.get('/state', async () => stateSnapshot(runtime));

  app.get('/schedules', async (_request, reply) => {
    if (!assertLocalSchedulerEnabled(runtime, reply)) return reply;
    return { schedules: listSchedules(runtime.db) };
  });

  app.get('/schedules/:scheduleId', async (request, reply) => {
    if (!assertLocalSchedulerEnabled(runtime, reply)) return reply;
    const schedule = getSchedule(runtime.db, scheduleIdParam(request));
    if (!schedule) return reply.code(404).send({ error: 'schedule_not_found' });
    return { schedule };
  });

  app.put('/schedules/:scheduleId/draft', async (request, reply) => {
    if (!assertLocalSchedulerEnabled(runtime, reply)) return reply;
    try {
      const schedule = updateDraftSchedule(runtime.db, {
        scheduleId: scheduleIdParam(request),
        kioskId: runtime.config.kioskId,
        body: request.body,
      });
      activatePendingScheduleAtSafeBoundary(runtime.db, { kioskId: runtime.config.kioskId });
      broadcastState();
      return reply.send({ schedule, state: stateSnapshot(runtime) });
    } catch (error) {
      return sendScheduleError(error, reply);
    }
  });

  app.post('/dev/token', async (request, reply) => {
    if (!assertDevEnabled(runtime, reply)) return reply;
    const body = typeof request.body === 'object' && request.body !== null ? request.body as Record<string, unknown> : {};
    const injectToken = runtime.tokenAdapter.injectToken?.bind(runtime.tokenAdapter);
    if (!injectToken) return reply.code(409).send({ error: 'dev_token_unavailable_for_hardware_mode' });
    const token = injectToken(body);
    const playing = startSession(runtime, token as unknown as Record<string, unknown>);
    broadcastState();
    return reply.code(201).send({ token, session: playing, state: stateSnapshot(runtime) });
  });

  app.post('/dev/session/start', async (request, reply) => {
    if (!assertDevEnabled(runtime, reply)) return reply;
    const body = typeof request.body === 'object' && request.body !== null ? request.body as Record<string, unknown> : {};
    const trigger = typeof body.trigger === 'string' ? body.trigger : 'admin_no_token_start';
    const playing = startSession(runtime, { trigger, token_required: false, source: body.source ?? 'admin-ui', fake: true });
    broadcastState();
    return reply.code(201).send({ session: playing, state: stateSnapshot(runtime) });
  });


  app.post('/quiz/answer', async (request, reply) => {
    const runtimeState = readRuntimeState(runtime.db);
    if (!runtimeState.current_session_id) return reply.code(409).send({ error: 'no_active_session' });
    const body = typeof request.body === 'object' && request.body !== null ? request.body as Record<string, unknown> : {};
    if (!isSessionLanguage(body.language)) return reply.code(400).send({ error: 'invalid_session_language' });
    if (typeof body.choice_id !== 'string') return reply.code(400).send({ error: 'invalid_choice_id' });
    try {
      const result = submitQuizAnswer(runtime.db, { kioskId: runtime.config.kioskId, sessionId: runtimeState.current_session_id, language: body.language, choiceId: body.choice_id, campaign: activeCampaignConfig(runtime) });
      if (result.completed_no_reward) activatePendingScheduleAtSafeBoundary(runtime.db, { kioskId: runtime.config.kioskId });
      broadcastState();
      return reply.send({ quiz: result, state: stateSnapshot(runtime) });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'quiz_answer_failed' });
    }
  });

  app.post('/spin/start', async (_request, reply) => {
    const runtimeState = readRuntimeState(runtime.db);
    if (!runtimeState.current_session_id) return reply.code(409).send({ error: 'no_active_session' });
    const current = getSession(runtime.db, runtimeState.current_session_id);
    if (current.state !== 'playing') return reply.code(409).send({ error: 'session_not_ready_for_spin', state: current.state });
    const language = current.session_language;
    if (!isSessionLanguage(language)) return reply.code(409).send({ error: 'session_language_not_locked' });
    const campaign = activeCampaignConfig(runtime);
    if (campaign.quiz && current.quiz_passed !== true) return reply.code(409).send({ error: 'quiz_not_passed' });
    try {
      appendEvent(runtime.db, { kioskId: runtime.config.kioskId, sessionId: current.session_id, eventType: 'spin_started', payload: { language } });
      const outcome = selectWeightedOutcome(runtime.db, campaign.outcome_strategy?.outcomes ?? []);
      appendEvent(runtime.db, { kioskId: runtime.config.kioskId, sessionId: current.session_id, eventType: 'outcome_selected', payload: { outcome_id: outcome.outcome_id, outcome_type: outcome.outcome_type, weight: outcome.weight } });
      const ready = transitionSession(runtime.db, current.session_id, 'result_pending', { resultPayload: { language, outcome_id: outcome.outcome_id, outcome_type: outcome.outcome_type, print_ticket: outcome.print_ticket } });
      broadcastState();
      return reply.send({ outcome, session: ready, state: stateSnapshot(runtime) });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'spin_start_failed' });
    }
  });

  app.post('/spin/complete', async (_request, reply) => {
    const runtimeState = readRuntimeState(runtime.db);
    if (!runtimeState.current_session_id) return reply.code(409).send({ error: 'no_active_session' });
    const current = getSession(runtime.db, runtimeState.current_session_id);
    if (current.state !== 'result_pending') return reply.code(409).send({ error: 'session_not_ready_for_spin_completion', state: current.state });
    const row = runtime.db.prepare('SELECT result_payload FROM sessions WHERE session_id = ?').get(current.session_id) as { result_payload: string | null } | undefined;
    const resultPayload = row?.result_payload ? JSON.parse(row.result_payload) as Record<string, unknown> : {};
    const language = resultPayload.language;
    const outcomeId = resultPayload.outcome_id;
    if (!isSessionLanguage(language) || typeof outcomeId !== 'string') return reply.code(409).send({ error: 'spin_result_missing' });
    const campaign = activeCampaignConfig(runtime);
    const outcome = (campaign.outcome_strategy?.outcomes ?? []).find((candidate) => candidate.outcome_id === outcomeId);
    if (!outcome) return reply.code(409).send({ error: 'spin_outcome_not_found', outcome_id: outcomeId });
    try {
      appendEvent(runtime.db, { kioskId: runtime.config.kioskId, sessionId: current.session_id, eventType: 'prize_revealed', payload: { outcome_id: outcome.outcome_id, print_deferred_until_wheel_stop: true } });
      if (!outcome.print_ticket) {
        const completed = transitionSession(runtime.db, current.session_id, 'completed');
        transitionSession(runtime.db, completed.session_id, 'resetting');
        const idle = transitionSession(runtime.db, completed.session_id, 'idle');
        appendEvent(runtime.db, { kioskId: runtime.config.kioskId, sessionId: current.session_id, eventType: 'session_reset', payload: { reason: 'spin_completed_no_ticket' } });
        activatePendingScheduleAtSafeBoundary(runtime.db, { kioskId: runtime.config.kioskId });
        broadcastState();
        return reply.send({ outcome, session: idle, state: stateSnapshot(runtime) });
      }
      transitionSession(runtime.db, current.session_id, 'print_requested');
      appendEvent(runtime.db, { kioskId: runtime.config.kioskId, sessionId: current.session_id, eventType: 'ticket_print_requested', payload: { outcome_id: outcome.outcome_id, after_wheel_stop: true } });
      transitionSession(runtime.db, current.session_id, 'printing');
      const basePayload = buildTicketRenderPayload({ sessionId: current.session_id, language, outcome });
      const ticket = createTicket(runtime.db, { kioskId: runtime.config.kioskId, kioskShortId: runtime.config.kioskId, sessionId: current.session_id, packageId: current.package_id, packageVersion: current.package_version, campaignShortCode: campaign.campaign_short_code ?? runtime.config.campaignShortCode, renderPayload: basePayload, secret: runtime.config.ticketSecret });
      ticket.render_payload = buildTicketRenderPayload({ sessionId: current.session_id, language, outcome, ticketCode: ticket.ticket_code });
      runtime.db.prepare('UPDATE tickets SET render_payload = ? WHERE ticket_id = ?').run(JSON.stringify(ticket.render_payload), ticket.ticket_id);
      const print = await runtime.printerAdapter.printTicket(runtime.db, ticket, printRequestPayload(ticket.ticket_code, ticket.render_payload));
      if (print.status === 'print_failed') {
        appendEvent(runtime.db, { kioskId: runtime.config.kioskId, sessionId: current.session_id, eventType: 'ticket_print_failed', payload: { ticket_id: ticket.ticket_id, ticket_code: ticket.ticket_code, error_message: print.error_message ?? null } });
        const degraded = transitionSession(runtime.db, current.session_id, 'degraded_printer', { lastError: print.error_message ?? 'print_failed' });
        broadcastState();
        return reply.send({ outcome, ticket, print, session: degraded, state: stateSnapshot(runtime) });
      }
      appendEvent(runtime.db, { kioskId: runtime.config.kioskId, sessionId: current.session_id, eventType: 'ticket_print_success', payload: { ticket_id: ticket.ticket_id, ticket_code: ticket.ticket_code } });
      const completed = transitionSession(runtime.db, current.session_id, 'completed');
      transitionSession(runtime.db, completed.session_id, 'resetting');
      const idle = transitionSession(runtime.db, completed.session_id, 'idle');
      appendEvent(runtime.db, { kioskId: runtime.config.kioskId, sessionId: current.session_id, eventType: 'session_reset', payload: { reason: 'spin_completed' } });
      activatePendingScheduleAtSafeBoundary(runtime.db, { kioskId: runtime.config.kioskId });
      broadcastState();
      return reply.send({ outcome, ticket, print, session: idle, state: stateSnapshot(runtime) });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'spin_complete_failed' });
    }
  });

  app.post('/session/reset', async (request, reply) => {
    const body = typeof request.body === 'object' && request.body !== null ? request.body as Record<string, unknown> : {};
    const reason = typeof body.reason === 'string' ? body.reason : 'admin_reset';
    forceResetRuntime(runtime.db, runtime.config.kioskId, reason);
    activatePendingScheduleAtSafeBoundary(runtime.db, { kioskId: runtime.config.kioskId });
    broadcastState();
    return reply.send({ state: stateSnapshot(runtime) });
  });

  app.post('/print/test', async (request, reply) => {
    if (!assertDevEnabled(runtime, reply)) return reply;
    const runtimeState = readRuntimeState(runtime.db);
    if (!runtimeState.current_session_id) return reply.code(409).send({ error: 'no_active_session' });
    const body = typeof request.body === 'object' && request.body !== null ? request.body as Record<string, unknown> : {};
    const current = getSession(runtime.db, runtimeState.current_session_id);
    const resultPayload = body.result_payload as Record<string, unknown> | undefined;
    const ready = current.state === 'playing'
      ? (resultPayload === undefined
        ? transitionSession(runtime.db, current.session_id, 'result_pending')
        : transitionSession(runtime.db, current.session_id, 'result_pending', { resultPayload }))
      : current;
    if (ready.state !== 'result_pending') return reply.code(409).send({ error: 'session_not_ready_for_print', state: ready.state });
    transitionSession(runtime.db, ready.session_id, 'print_requested');
    transitionSession(runtime.db, ready.session_id, 'printing');
    const ticket = createTicket(runtime.db, {
      kioskId: runtime.config.kioskId,
      kioskShortId: runtime.config.kioskId,
      sessionId: ready.session_id,
      packageId: current.package_id,
      packageVersion: current.package_version,
      campaignShortCode: runtime.config.campaignShortCode,
      renderPayload: body.render_payload as Record<string, unknown> | undefined ?? { prize: 'TEST', fake: true },
      secret: runtime.config.ticketSecret,
    });
    const print = await runtime.printerAdapter.printTicket(runtime.db, ticket, { endpoint: '/print/test' });
    if (print.status === 'print_failed') {
      const error = print.error_message ?? `printer ${runtime.printerAdapter.adapter} failed to print ticket ${ticket.ticket_id}`;
      const degraded = transitionSession(runtime.db, ready.session_id, 'degraded_printer', { lastError: error });
      broadcastState();
      return reply.send({ ticket, print, session: degraded, state: stateSnapshot(runtime) });
    }
    const completed = transitionSession(runtime.db, ready.session_id, 'completed');
    transitionSession(runtime.db, completed.session_id, 'resetting');
    const idle = transitionSession(runtime.db, completed.session_id, 'idle');
    activatePendingScheduleAtSafeBoundary(runtime.db, { kioskId: runtime.config.kioskId });
    broadcastState();
    return reply.send({ ticket, print, session: idle, state: stateSnapshot(runtime) });
  });

  app.post('/maintenance/enter', async (_request, reply) => {
    setMode(runtime.db, 'maintenance', runtime.config.kioskId);
    broadcastState();
    return reply.send({ state: stateSnapshot(runtime) });
  });

  app.post('/maintenance/exit', async (_request, reply) => {
    setMode(runtime.db, 'idle', runtime.config.kioskId);
    broadcastState();
    return reply.send({ state: stateSnapshot(runtime) });
  });

  app.get('/ws', { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.send(JSON.stringify({ type: 'state', state: stateSnapshot(runtime) }));
    socket.on('close', () => sockets.delete(socket));
  });

  return app;
}

export async function startLocalBackendServer(runtime = createLocalBackendRuntime()): Promise<FastifyInstance> {
  const app = await createLocalBackendServer(runtime);
  await runtime.tokenAdapter.start?.();
  app.addHook('onClose', async () => {
    await runtime.tokenAdapter.stop?.();
  });
  await app.listen({ host: runtime.config.host, port: runtime.config.port });
  return app;
}
