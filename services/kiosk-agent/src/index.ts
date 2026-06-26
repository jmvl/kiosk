import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command, CommandResult, CommandType, EventEnvelope, HeartbeatPayload } from '@retail-kiosk/shared-types';

export const allowedAgentCommandTypes = [
  'test_print',
  'enter_maintenance',
  'exit_maintenance',
  'upload_logs',
] as const satisfies readonly CommandType[];

export type AllowedAgentCommandType = (typeof allowedAgentCommandTypes)[number];

const allowedCommandSet = new Set<CommandType>(allowedAgentCommandTypes);

export interface KioskAgentConfig {
  kiosk_id: string;
  location_id: string;
  central_api_base_url: string;
  local_backend_base_url?: string;
  local_backend_auth_token?: string;
  poll_interval_ms: number;
  command_poll_limit: number;
  event_upload_batch_size: number;
  agent_version: string;
  runtime_version: string;
  player_version: string;
  active_package: string;
  schedule_version: number;
  queue_length: number;
  printer_status: HeartbeatPayload['printer_status'];
  token_status: HeartbeatPayload['token_status'];
  runtime_health: HeartbeatPayload['runtime_health'];
  player_health: HeartbeatPayload['player_health'];
  last_session_at?: string;
  last_error: string | null;
  last_uploaded_sequence_path?: string;
  maintenance_state_path?: string;
  log_bundle_path?: string;
}

export interface ConfigLoadOptions {
  env?: NodeJS.ProcessEnv;
  configPath?: string;
}

type PartialConfig = Partial<KioskAgentConfig>;

function numberFromEnv(value: string | undefined): number | undefined {
  if (value === undefined || value.length === 0) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`invalid numeric config value: ${value}`);
  return parsed;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readJsonConfig(path: string | undefined): PartialConfig {
  if (!path) return {};
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('kiosk agent config must be a JSON object');
  return parsed as PartialConfig;
}

export function loadKioskAgentConfig(options: ConfigLoadOptions = {}): KioskAgentConfig {
  const env = options.env ?? process.env;
  const fileConfig = readJsonConfig(options.configPath ?? env.KIOSK_AGENT_CONFIG);
  const envConfig: PartialConfig = {};
  const setIfDefined = <Key extends keyof KioskAgentConfig>(key: Key, value: KioskAgentConfig[Key] | undefined): void => {
    if (value !== undefined) envConfig[key] = value;
  };
  setIfDefined('kiosk_id', env.KIOSK_ID);
  setIfDefined('location_id', env.KIOSK_LOCATION_ID ?? env.LOCATION_ID);
  setIfDefined('central_api_base_url', env.CENTRAL_API_BASE_URL ?? env.CENTRAL_API_URL);
  setIfDefined('local_backend_base_url', env.LOCAL_BACKEND_BASE_URL ?? env.LOCAL_BACKEND_URL);
  setIfDefined('local_backend_auth_token', env.KIOSK_AGENT_LOCAL_BACKEND_AUTH_TOKEN ?? env.LOCAL_BACKEND_AUTH_TOKEN);
  const heartbeatIntervalSeconds = numberFromEnv(env.HEARTBEAT_INTERVAL_SECONDS);
  setIfDefined('poll_interval_ms', numberFromEnv(env.KIOSK_AGENT_POLL_INTERVAL_MS) ?? (heartbeatIntervalSeconds === undefined ? undefined : heartbeatIntervalSeconds * 1000));
  setIfDefined('command_poll_limit', numberFromEnv(env.KIOSK_AGENT_COMMAND_POLL_LIMIT));
  setIfDefined('event_upload_batch_size', numberFromEnv(env.KIOSK_AGENT_EVENT_UPLOAD_BATCH_SIZE));
  setIfDefined('agent_version', env.KIOSK_AGENT_VERSION);
  setIfDefined('runtime_version', env.KIOSK_RUNTIME_VERSION);
  setIfDefined('player_version', env.KIOSK_PLAYER_VERSION);
  setIfDefined('active_package', env.KIOSK_ACTIVE_PACKAGE);
  setIfDefined('schedule_version', numberFromEnv(env.KIOSK_SCHEDULE_VERSION));
  setIfDefined('queue_length', numberFromEnv(env.KIOSK_QUEUE_LENGTH));
  setIfDefined('last_uploaded_sequence_path', env.KIOSK_AGENT_LAST_UPLOADED_SEQUENCE_PATH);
  setIfDefined('maintenance_state_path', env.KIOSK_MAINTENANCE_STATE_PATH);
  setIfDefined('log_bundle_path', env.KIOSK_LOG_BUNDLE_PATH);
  const merged: PartialConfig = { ...envConfig, ...fileConfig };

  const kioskId = stringOrUndefined(merged.kiosk_id);
  const locationId = stringOrUndefined(merged.location_id);
  const centralApiBaseUrl = stringOrUndefined(merged.central_api_base_url);
  if (!kioskId) throw new Error('kiosk_id is required');
  if (!locationId) throw new Error('location_id is required');
  if (!centralApiBaseUrl) throw new Error('central_api_base_url is required');

  return {
    kiosk_id: kioskId,
    location_id: locationId,
    central_api_base_url: centralApiBaseUrl.replace(/\/+$/, ''),
    ...(merged.local_backend_base_url ? { local_backend_base_url: merged.local_backend_base_url.replace(/\/+$/, '') } : {}),
    ...(merged.local_backend_auth_token ? { local_backend_auth_token: merged.local_backend_auth_token } : {}),
    poll_interval_ms: merged.poll_interval_ms ?? 30_000,
    command_poll_limit: merged.command_poll_limit ?? 25,
    event_upload_batch_size: merged.event_upload_batch_size ?? 100,
    agent_version: merged.agent_version ?? '0.0.0',
    runtime_version: merged.runtime_version ?? '0.0.0',
    player_version: merged.player_version ?? '0.0.0',
    active_package: merged.active_package ?? 'none',
    schedule_version: merged.schedule_version ?? 0,
    queue_length: merged.queue_length ?? 0,
    printer_status: merged.printer_status ?? 'unknown',
    token_status: merged.token_status ?? 'unknown',
    runtime_health: merged.runtime_health ?? 'unknown',
    player_health: merged.player_health ?? 'unknown',
    ...(merged.last_session_at ? { last_session_at: merged.last_session_at } : {}),
    last_error: merged.last_error ?? null,
    ...(merged.last_uploaded_sequence_path ? { last_uploaded_sequence_path: merged.last_uploaded_sequence_path } : {}),
    ...(merged.maintenance_state_path ? { maintenance_state_path: merged.maintenance_state_path } : {}),
    ...(merged.log_bundle_path ? { log_bundle_path: merged.log_bundle_path } : {}),
  };
}

export function buildHeartbeatPayload(config: KioskAgentConfig, now = new Date()): HeartbeatPayload {
  return {
    kiosk_id: config.kiosk_id,
    location_id: config.location_id,
    agent_version: config.agent_version,
    runtime_version: config.runtime_version,
    player_version: config.player_version,
    active_package: config.active_package,
    schedule_version: config.schedule_version,
    uptime_seconds: Math.floor(process.uptime()),
    queue_length: config.queue_length,
    printer_status: config.printer_status,
    token_status: config.token_status,
    runtime_health: config.runtime_health,
    player_health: config.player_health,
    ...(config.last_session_at ? { last_session_at: config.last_session_at } : {}),
    last_error: config.last_error,
    clock_skew_seconds: Math.round((Date.now() - now.getTime()) / 1000),
  };
}

export interface CentralAgentClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface EventBatchUploadResult {
  inserted_count: number;
  duplicate_count: number;
  events: Array<{ event_id: string; status: 'inserted' | 'duplicate' }>;
}

export class CentralAgentClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CentralAgentClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async submitHeartbeat(payload: HeartbeatPayload): Promise<void> {
    await this.postJson('/v1/heartbeats', payload);
  }

  async submitEvents(kioskId: string, events: EventEnvelope[]): Promise<EventBatchUploadResult> {
    const body = await this.postJson('/v1/events/batch', { kiosk_id: kioskId, events });
    return body as EventBatchUploadResult;
  }

  async pollCommands(kioskId: string, limit: number): Promise<Command[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/kiosks/${encodeURIComponent(kioskId)}/commands?limit=${limit}`);
    if (!response.ok) throw new Error(`command poll failed with HTTP ${response.status}`);
    const body = await response.json() as { commands?: Command[] };
    return Array.isArray(body.commands) ? body.commands : [];
  }

  async reportCommandResult(result: CommandResult): Promise<void> {
    await this.postJson(`/v1/commands/${encodeURIComponent(result.command_id)}/result`, result);
  }

  private async postJson(path: string, payload: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}`);
    return await response.json();
  }
}

export interface CommandExecutionState {
  resultsByCommandId: Map<string, CommandResult>;
  commandIdByIdempotencyKey: Map<string, string>;
  maintenance: boolean;
}

export function createCommandExecutionState(): CommandExecutionState {
  return {
    resultsByCommandId: new Map(),
    commandIdByIdempotencyKey: new Map(),
    maintenance: false,
  };
}

export interface CommandExecutionContext {
  config: KioskAgentConfig;
  state: CommandExecutionState;
  now?: Date;
}

interface CommandResultFields {
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  message?: string;
  error_code?: string;
  evidence?: Record<string, unknown>;
}

function commandResult(command: Command, status: CommandResult['status'], eventAt: Date, fields: CommandResultFields = {}): CommandResult {
  const timestamp = eventAt.toISOString();
  const base = {
    command_id: command.command_id,
    kiosk_id: command.kiosk_id,
    ...(fields.message ? { message: fields.message } : {}),
    ...(fields.error_code ? { error_code: fields.error_code } : {}),
    evidence: fields.evidence ?? {},
  };
  if (status === 'accepted') {
    return { ...base, status, accepted_at: fields.accepted_at ?? timestamp };
  }
  if (status === 'running') {
    return { ...base, status, started_at: fields.started_at ?? timestamp };
  }
  return {
    ...base,
    status,
    ...(fields.started_at ? { started_at: fields.started_at } : {}),
    completed_at: fields.completed_at ?? timestamp,
  };
}

export async function executeAllowedCommandLifecycle(command: Command, context: CommandExecutionContext): Promise<CommandResult[]> {
  const now = context.now ?? new Date();
  if (command.kiosk_id !== context.config.kiosk_id) {
    return [commandResult(command, 'failed', now, {
      error_code: 'KIOSK_MISMATCH',
      message: 'command kiosk_id does not match this agent identity',
      evidence: { expected_kiosk_id: context.config.kiosk_id },
    })];
  }

  const priorByCommandId = context.state.resultsByCommandId.get(command.command_id);
  if (priorByCommandId) return [priorByCommandId];

  const priorCommandId = context.state.commandIdByIdempotencyKey.get(command.idempotency_key);
  if (priorCommandId) {
    const prior = context.state.resultsByCommandId.get(priorCommandId);
    if (prior) {
      return [commandResult(command, prior.status, now, {
        message: `duplicate idempotency key already handled by ${priorCommandId}`,
        evidence: { duplicate_of_command_id: priorCommandId, original_status: prior.status },
      })];
    }
  }

  if (new Date(command.expires_at) <= now) {
    return [commandResult(command, 'expired', now, {
      error_code: 'COMMAND_EXPIRED',
      message: 'command expired before execution',
      evidence: { expires_at: command.expires_at },
    })];
  }

  if (!allowedCommandSet.has(command.type)) {
    return [commandResult(command, 'failed', now, {
      error_code: 'COMMAND_NOT_ALLOWED',
      message: `command type ${command.type} is not allowlisted for kiosk-agent`,
      evidence: { allowed_types: [...allowedAgentCommandTypes] },
    })];
  }

  if (command.requires_confirmation) {
    return [commandResult(command, 'failed', now, {
      error_code: 'COMMAND_REQUIRES_CONFIRMATION',
      message: 'command requires central/admin confirmation before kiosk-agent execution',
      evidence: { requires_confirmation: true, confirmed: false },
    })];
  }

  const startedAt = now.toISOString();
  const accepted = commandResult(command, 'accepted', now, {
    accepted_at: startedAt,
    message: 'command accepted by kiosk-agent allowlist',
    evidence: { action: command.type },
  });
  const running = commandResult(command, 'running', now, {
    started_at: startedAt,
    message: 'command execution started by kiosk-agent skeleton',
    evidence: { action: command.type },
  });
  let terminal: CommandResult;
  switch (command.type as AllowedAgentCommandType) {
    case 'test_print':
      terminal = commandResult(command, 'succeeded', now, {
        started_at: startedAt,
        message: 'test print accepted by kiosk-agent skeleton',
        evidence: { simulated: true, action: 'test_print' },
      });
      break;
    case 'enter_maintenance':
      context.state.maintenance = true;
      if (context.config.maintenance_state_path) writeFileSync(context.config.maintenance_state_path, 'maintenance\n', 'utf8');
      terminal = commandResult(command, 'succeeded', now, {
        started_at: startedAt,
        message: 'maintenance mode entered',
        evidence: { maintenance: true },
      });
      break;
    case 'exit_maintenance':
      context.state.maintenance = false;
      if (context.config.maintenance_state_path) writeFileSync(context.config.maintenance_state_path, 'normal\n', 'utf8');
      terminal = commandResult(command, 'succeeded', now, {
        started_at: startedAt,
        message: 'maintenance mode exited',
        evidence: { maintenance: false },
      });
      break;
    case 'upload_logs':
      terminal = commandResult(command, 'succeeded', now, {
        started_at: startedAt,
        message: 'log upload skeleton recorded; no external upload performed',
        evidence: { uploaded: false, log_bundle_path: context.config.log_bundle_path ?? null },
      });
      break;
  }
  return [accepted, running, terminal];
}

export async function executeAllowedCommand(command: Command, context: CommandExecutionContext): Promise<CommandResult> {
  const updates = await executeAllowedCommandLifecycle(command, context);
  const result = updates[updates.length - 1];
  if (!result) throw new Error('command lifecycle produced no result');
  return result;
}

export interface AgentCycleOptions {
  config: KioskAgentConfig;
  client?: CentralAgentClient;
  state?: CommandExecutionState;
  now?: Date;
  localBackendFetchImpl?: typeof fetch;
}

export interface LocalEventExportResponse {
  events: EventEnvelope[];
  cursor: {
    after_sequence: number;
    next_after_sequence: number | null;
    count: number;
    limit: number;
  };
}

export interface EventUploadCycleResult {
  attempted: number;
  uploaded: number;
  next_after_sequence: number | null;
}

export interface AgentCycleResult {
  heartbeat: HeartbeatPayload;
  events: EventUploadCycleResult;
  commands_seen: number;
  results: CommandResult[];
}

export function readUploadedSequence(path: string | undefined): number {
  if (!path || !existsSync(path)) return 0;
  const value = Number(readFileSync(path, 'utf8').trim());
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

export function writeUploadedSequence(path: string | undefined, sequence: number): void {
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${Math.max(0, Math.trunc(sequence))}\n`, 'utf8');
}

export async function fetchLocalEvents(config: KioskAgentConfig, afterSequence: number, fetchImpl: typeof fetch = fetch): Promise<LocalEventExportResponse> {
  if (!config.local_backend_base_url) return { events: [], cursor: { after_sequence: afterSequence, next_after_sequence: null, count: 0, limit: config.event_upload_batch_size } };
  const url = new URL('/admin/api/events/export', config.local_backend_base_url);
  url.searchParams.set('after_sequence', String(afterSequence));
  url.searchParams.set('limit', String(config.event_upload_batch_size));
  const response = await fetchImpl(url, {
    headers: config.local_backend_auth_token ? { authorization: `Bearer ${config.local_backend_auth_token}` } : {},
  });
  if (!response.ok) throw new Error(`local event export failed with HTTP ${response.status}`);
  return await response.json() as LocalEventExportResponse;
}

export async function uploadLocalEvents(config: KioskAgentConfig, client: CentralAgentClient, fetchImpl?: typeof fetch): Promise<EventUploadCycleResult> {
  if (!config.local_backend_base_url) return { attempted: 0, uploaded: 0, next_after_sequence: null };
  const afterSequence = readUploadedSequence(config.last_uploaded_sequence_path);
  const exported = await fetchLocalEvents(config, afterSequence, fetchImpl ?? fetch);
  if (exported.events.length === 0) return { attempted: 0, uploaded: 0, next_after_sequence: null };
  const result = await client.submitEvents(config.kiosk_id, exported.events);
  const accepted = result.events.filter((event) => event.status === 'inserted' || event.status === 'duplicate').length;
  if (accepted !== exported.events.length) throw new Error('central event upload returned incomplete acknowledgement');
  const nextSequence = exported.cursor.next_after_sequence ?? exported.events.at(-1)?.local_sequence ?? afterSequence;
  writeUploadedSequence(config.last_uploaded_sequence_path, nextSequence);
  return { attempted: exported.events.length, uploaded: accepted, next_after_sequence: nextSequence };
}

export async function runKioskAgentCycle(options: AgentCycleOptions): Promise<AgentCycleResult> {
  const config = options.config;
  const client = options.client ?? new CentralAgentClient({ baseUrl: config.central_api_base_url });
  const state = options.state ?? createCommandExecutionState();
  const heartbeat = buildHeartbeatPayload(config, options.now);
  await client.submitHeartbeat(heartbeat);
  const eventUpload = await uploadLocalEvents(config, client, options.localBackendFetchImpl);
  const commands = await client.pollCommands(config.kiosk_id, config.command_poll_limit);
  const results: CommandResult[] = [];

  for (const command of commands) {
    const executionContext: CommandExecutionContext = options.now === undefined
      ? { config, state }
      : { config, state, now: options.now };
    const commandResults = await executeAllowedCommandLifecycle(command, executionContext);
    const result = commandResults[commandResults.length - 1];
    if (!result) throw new Error(`command ${command.command_id} produced no lifecycle result`);
    if (!state.resultsByCommandId.has(command.command_id)) {
      state.resultsByCommandId.set(command.command_id, result);
      state.commandIdByIdempotencyKey.set(command.idempotency_key, command.command_id);
    }
    for (const commandResult of commandResults) {
      await client.reportCommandResult(commandResult);
      results.push(commandResult);
    }
  }

  return { heartbeat, events: eventUpload, commands_seen: commands.length, results };
}

export interface AgentDaemonOptions {
  config?: KioskAgentConfig;
  client?: CentralAgentClient;
  state?: CommandExecutionState;
  signal?: AbortSignal;
  logger?: Pick<Console, 'log' | 'error'>;
  maxCycles?: number;
}

function waitForNextCycle(intervalMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, intervalMs);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export async function runKioskAgentDaemon(options: AgentDaemonOptions = {}): Promise<void> {
  const config = options.config ?? loadKioskAgentConfig();
  const client = options.client ?? new CentralAgentClient({ baseUrl: config.central_api_base_url });
  const state = options.state ?? createCommandExecutionState();
  const logger = options.logger ?? console;
  let cycles = 0;

  logger.log(`kiosk-agent daemon started for kiosk ${config.kiosk_id}; polling every ${config.poll_interval_ms}ms`);
  while (!options.signal?.aborted) {
    try {
      const result = await runKioskAgentCycle({ config, client, state });
      logger.log(`kiosk-agent cycle complete: commands_seen=${result.commands_seen} results_reported=${result.results.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      logger.error(`kiosk-agent cycle failed: ${message}`);
    }

    cycles += 1;
    if (options.maxCycles !== undefined && cycles >= options.maxCycles) break;
    await waitForNextCycle(config.poll_interval_ms, options.signal);
  }
  logger.log('kiosk-agent daemon stopped');
}

export const skeletonPackage = {
  name: '@retail-kiosk/kiosk-agent',
  kind: 'service',
} as const;

export type SkeletonPackage = typeof skeletonPackage;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  await runKioskAgentDaemon({ signal: controller.signal });
}
