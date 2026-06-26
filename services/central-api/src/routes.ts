import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { CommandResult, EventEnvelope, HeartbeatPayload } from '@retail-kiosk/shared-types';
import type { AdminEventsFilter, CentralRepository } from './repository.js';

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

function corsHeaders(request: IncomingMessage): Record<string, string> {
  const origin = request.headers.origin;
  return {
    'access-control-allow-origin': typeof origin === 'string' && origin.length > 0 ? origin : '*',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '600',
    vary: 'origin',
  };
}

function writeJson(request: IncomingMessage, response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { ...corsHeaders(request), 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function writeOptions(request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(204, corsHeaders(request));
  response.end();
}

function contentTypeFor(path: string): string {
  const extension = extname(path).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.ico') return 'image/x-icon';
  if (extension === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function safeStaticPath(root: string, pathname: string): string | null {
  const relative = normalize(decodeURIComponent(pathname.replace(/^\/admin\/?/, '')));
  if (relative.startsWith('..') || relative.includes(`${sep}..${sep}`)) return null;
  const candidate = resolve(root, relative || 'index.html');
  const normalizedRoot = resolve(root);
  return candidate === normalizedRoot || candidate.startsWith(`${normalizedRoot}${sep}`) ? candidate : null;
}

function serveAdminStatic(request: IncomingMessage, response: ServerResponse, adminStaticDir: string, pathname: string): boolean {
  if (request.method !== 'GET') return false;
  if (pathname === '/') {
    response.writeHead(302, { location: '/admin/' });
    response.end();
    return true;
  }
  if (pathname === '/admin') {
    response.writeHead(302, { location: '/admin/' });
    response.end();
    return true;
  }
  if (!pathname.startsWith('/admin/')) return false;

  const candidate = safeStaticPath(adminStaticDir, pathname);
  const filePath = candidate && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(resolve(adminStaticDir), 'index.html');
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    writeJson(request, response, 404, { ok: false, error: 'admin_static_not_found' });
    return true;
  }

  response.writeHead(200, {
    ...corsHeaders(request),
    'content-type': contentTypeFor(filePath),
    'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(response);
  return true;
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

export async function getAdminFleetOverview(repository: CentralRepository) {
  return { ok: true, fleet: await repository.getFleetOverview() };
}

export async function listAdminKiosks(repository: CentralRepository) {
  return { ok: true, kiosks: await repository.listKiosks() };
}

export async function getAdminKiosk(repository: CentralRepository, kioskId: string) {
  const kiosk = await repository.getKiosk(kioskId);
  if (!kiosk) return { ok: false, error: 'not_found' };
  return { ok: true, kiosk };
}

export async function listAdminSchedules(repository: CentralRepository) {
  return { ok: true, ...(await repository.listSchedules()) };
}

export async function listAdminDeployments(repository: CentralRepository) {
  return { ok: true, ...(await repository.listDeployments()) };
}

export async function listAdminEvents(repository: CentralRepository, filters: Partial<AdminEventsFilter>) {
  return { ok: true, ...(await repository.listEvents(filters)) };
}

export interface CentralApiServerOptions {
  adminStaticDir?: string;
}

export function createCentralApiServer(repository: CentralRepository, options: CentralApiServerOptions = {}) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (request.method === 'OPTIONS') return writeOptions(request, response);
      if (request.method === 'GET' && url.pathname === '/healthz') return writeJson(request, response, 200, { ok: true });
      if (request.method === 'GET' && url.pathname === '/v1/admin/fleet/overview') return writeJson(request, response, 200, await getAdminFleetOverview(repository));
      if (request.method === 'GET' && url.pathname === '/v1/admin/kiosks') return writeJson(request, response, 200, await listAdminKiosks(repository));
      const adminKioskMatch = url.pathname.match(/^\/v1\/admin\/kiosks\/([^/]+)$/);
      if (request.method === 'GET' && adminKioskMatch?.[1]) {
        const body = await getAdminKiosk(repository, decodeURIComponent(adminKioskMatch[1]));
        return writeJson(request, response, body.ok ? 200 : 404, body);
      }
      if (request.method === 'GET' && url.pathname === '/v1/admin/schedules') return writeJson(request, response, 200, await listAdminSchedules(repository));
      if (request.method === 'GET' && url.pathname === '/v1/admin/deployments') return writeJson(request, response, 200, await listAdminDeployments(repository));
      if (request.method === 'GET' && url.pathname === '/v1/admin/events') {
        return writeJson(request, response, 200, await listAdminEvents(repository, {
          limit: Number(url.searchParams.get('limit') ?? 50),
          kiosk_id: url.searchParams.get('kiosk_id') || null,
          event_type: url.searchParams.get('event_type') || null,
        }));
      }
      if (request.method === 'POST' && url.pathname === '/v1/heartbeats') return writeJson(request, response, 200, await recordHeartbeat(repository, await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/v1/events/batch') return writeJson(request, response, 200, await ingestEventBatch(repository, await readJson(request)));
      const commandPollMatch = url.pathname.match(/^\/v1\/kiosks\/([^/]+)\/commands$/);
      if (request.method === 'GET' && commandPollMatch?.[1]) return writeJson(request, response, 200, await pollDeviceCommands(repository, commandPollMatch[1], Number(url.searchParams.get('limit') ?? 25)));
      const commandResultMatch = url.pathname.match(/^\/v1\/commands\/([^/]+)\/result$/);
      if (request.method === 'POST' && commandResultMatch?.[1]) {
        const body = await readJson(request);
        if (isObject(body) && body.command_id === undefined) body.command_id = commandResultMatch[1];
        return writeJson(request, response, 200, await recordCommandResult(repository, body));
      }
      if (options.adminStaticDir && serveAdminStatic(request, response, options.adminStaticDir, url.pathname)) return;
      return writeJson(request, response, 404, { ok: false, error: 'not_found' });
    } catch (error) {
      const statusCode = error instanceof Error && error.name === 'BadRequestError' ? 400 : 500;
      return writeJson(request, response, statusCode, { ok: false, error: error instanceof Error ? error.message : 'unknown error' });
    }
  });
}
