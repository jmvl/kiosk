import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { CommandResult, EventEnvelope, HeartbeatPayload } from '@retail-kiosk/shared-types';
import type { CentralRepository } from './repository.js';

export interface EventBatchRequest {
  kiosk_id: string;
  events: EventEnvelope[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function badRequest(message: string): never {
  const error = new Error(message);
  error.name = 'BadRequestError';
  throw error;
}

export function parseHeartbeatPayload(value: unknown): HeartbeatPayload {
  if (!isObject(value)) badRequest('heartbeat payload must be an object');
  for (const field of ['kiosk_id', 'location_id', 'agent_version', 'runtime_version', 'player_version', 'active_package'] as const) {
    if (typeof value[field] !== 'string' || value[field].length === 0) badRequest(`${field} is required`);
  }
  if (typeof value.schedule_version !== 'number') badRequest('schedule_version is required');
  if (typeof value.uptime_seconds !== 'number') badRequest('uptime_seconds is required');
  if (typeof value.queue_length !== 'number') badRequest('queue_length is required');
  return value as unknown as HeartbeatPayload;
}

export function parseEventBatch(value: unknown): EventBatchRequest {
  if (!isObject(value)) badRequest('event batch payload must be an object');
  if (typeof value.kiosk_id !== 'string' || value.kiosk_id.length === 0) badRequest('kiosk_id is required');
  if (!Array.isArray(value.events)) badRequest('events must be an array');
  for (const event of value.events) {
    if (!isObject(event)) badRequest('each event must be an object');
    for (const field of ['event_id', 'kiosk_id', 'event_type', 'occurred_at'] as const) {
      if (typeof event[field] !== 'string' || event[field].length === 0) badRequest(`event ${field} is required`);
    }
    if (typeof event.local_sequence !== 'number') badRequest('event local_sequence is required');
    if (typeof event.schema_version !== 'number') badRequest('event schema_version is required');
    if (!isObject(event.payload)) badRequest('event payload must be an object');
  }
  return value as unknown as EventBatchRequest;
}

export async function recordHeartbeat(repository: CentralRepository, payload: unknown) {
  const heartbeat = parseHeartbeatPayload(payload);
  const saved = await repository.saveHeartbeat(heartbeat);
  return { ok: true, heartbeat: saved };
}

export async function ingestEventBatch(repository: CentralRepository, payload: unknown) {
  const batch = parseEventBatch(payload);
  const results = await repository.ingestEvents(batch.kiosk_id, batch.events);
  const inserted = results.filter((result) => result.status === 'inserted').length;
  const duplicates = results.length - inserted;
  return { ok: true, inserted_count: inserted, duplicate_count: duplicates, events: results };
}

export async function pollDeviceCommands(repository: CentralRepository, kioskId: string, limit = 25) {
  const commands = await repository.pollCommands(kioskId, new Date(), limit);
  return { ok: true, commands };
}

export async function recordCommandResult(repository: CentralRepository, payload: unknown) {
  if (!isObject(payload)) badRequest('command result payload must be an object');
  const result = payload as unknown as CommandResult;
  if (typeof result.command_id !== 'string' || typeof result.kiosk_id !== 'string' || typeof result.status !== 'string') {
    badRequest('command_id, kiosk_id, and status are required');
  }
  await repository.saveCommandResult(result);
  return { ok: true };
}

export function createCentralApiServer(repository: CentralRepository) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/healthz') return writeJson(response, 200, { ok: true });
      if (request.method === 'POST' && url.pathname === '/v1/heartbeats') return writeJson(response, 200, await recordHeartbeat(repository, await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/v1/events/batch') return writeJson(response, 200, await ingestEventBatch(repository, await readJson(request)));
      const commandPollMatch = url.pathname.match(/^\/v1\/kiosks\/([^/]+)\/commands$/);
      if (request.method === 'GET' && commandPollMatch?.[1]) return writeJson(response, 200, await pollDeviceCommands(repository, commandPollMatch[1], Number(url.searchParams.get('limit') ?? 25)));
      const commandResultMatch = url.pathname.match(/^\/v1\/commands\/([^/]+)\/result$/);
      if (request.method === 'POST' && commandResultMatch?.[1]) {
        const body = await readJson(request);
        if (isObject(body) && body.command_id === undefined) body.command_id = commandResultMatch[1];
        return writeJson(response, 200, await recordCommandResult(repository, body));
      }
      return writeJson(response, 404, { ok: false, error: 'not_found' });
    } catch (error) {
      const statusCode = error instanceof Error && error.name === 'BadRequestError' ? 400 : 500;
      return writeJson(response, statusCode, { ok: false, error: error instanceof Error ? error.message : 'unknown error' });
    }
  });
}
