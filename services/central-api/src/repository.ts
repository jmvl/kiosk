import type { Command, CommandResult, EventEnvelope, HeartbeatPayload } from '@retail-kiosk/shared-types';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { commandResults, deviceCommands, events, heartbeats, kiosks, locations } from './db/schema.js';

export interface HeartbeatRecord {
  heartbeat_id: string;
  kiosk_id: string;
  received_at: string;
}

export interface EventIngestResult {
  event_id: string;
  status: 'inserted' | 'duplicate';
}

export interface AdminKioskSummary {
  kiosk_id: string;
  location_id: string;
  name: string;
  status: string;
  runtime_health: string | null;
  player_health: string | null;
  printer_status: string | null;
  token_status: string | null;
  agent_version: string | null;
  runtime_version: string | null;
  player_version: string | null;
  active_package: string | null;
  schedule_version: number;
  queue_length: number | null;
  uptime_seconds: number | null;
  last_heartbeat_at: string | null;
  last_session_at: string | null;
  last_error: string | null;
}

export interface AdminKioskDetail extends AdminKioskSummary {
  last_heartbeat: HeartbeatPayload | null;
}

export interface AdminFleetOverview {
  generated_at: string;
  totals: {
    kiosks: number;
    locations: number;
    healthy: number;
    degraded: number;
    offline: number;
    unknown: number;
  };
  kiosks: AdminKioskSummary[];
}

export interface CentralControlPlaneMetadata {
  ready: boolean;
  source: 'central-control-plane';
  tables_available: boolean;
  message: string;
}

export interface AdminSchedulesReadModel {
  generated_at: string;
  control_plane: CentralControlPlaneMetadata;
  schedules: unknown[];
}

export interface AdminDeploymentsReadModel {
  generated_at: string;
  control_plane: CentralControlPlaneMetadata;
  deployments: unknown[];
}

export interface AdminEventRow {
  event_id: string;
  kiosk_id: string;
  session_id: string | null;
  local_sequence: number;
  event_type: string;
  occurred_at: string;
  ingested_at: string;
  schema_version: number;
  payload: Record<string, unknown>;
}

export interface AdminEventsFilter {
  limit: number;
  kiosk_id: string | null;
  event_type: string | null;
}

export interface AdminEventsReadModel {
  generated_at: string;
  filters: AdminEventsFilter;
  rows: AdminEventRow[];
}

export interface CentralRepository {
  saveHeartbeat(payload: HeartbeatPayload, receivedAt?: Date): Promise<HeartbeatRecord>;
  ingestEvents(kioskId: string, uploadedEvents: EventEnvelope[]): Promise<EventIngestResult[]>;
  pollCommands(kioskId: string, now?: Date, limit?: number): Promise<Command[]>;
  saveCommandResult(result: CommandResult, completedAt?: Date): Promise<void>;
  getFleetOverview(now?: Date): Promise<AdminFleetOverview>;
  listKiosks(): Promise<AdminKioskSummary[]>;
  getKiosk(kioskId: string): Promise<AdminKioskDetail | null>;
  listSchedules(now?: Date): Promise<AdminSchedulesReadModel>;
  listDeployments(now?: Date): Promise<AdminDeploymentsReadModel>;
  listEvents(filters?: Partial<AdminEventsFilter>, now?: Date): Promise<AdminEventsReadModel>;
}

function controlPlaneNotReady(message: string): CentralControlPlaneMetadata {
  return { ready: false, source: 'central-control-plane', tables_available: false, message };
}

function emptySchedules(now = new Date(), message = 'central schedule tables are not available yet'): AdminSchedulesReadModel {
  return { generated_at: now.toISOString(), control_plane: controlPlaneNotReady(message), schedules: [] };
}

function emptyDeployments(now = new Date(), message = 'central deployment tables are not available yet'): AdminDeploymentsReadModel {
  return { generated_at: now.toISOString(), control_plane: controlPlaneNotReady(message), deployments: [] };
}

function normalizeEventFilters(filters: Partial<AdminEventsFilter> = {}): AdminEventsFilter {
  const rawLimit = Number(filters.limit ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.trunc(rawLimit))) : 50;
  return {
    limit,
    kiosk_id: filters.kiosk_id || null,
    event_type: filters.event_type || null,
  };
}

function eventEnvelopeToAdminRow(event: EventEnvelope): AdminEventRow {
  return {
    event_id: event.event_id,
    kiosk_id: event.kiosk_id,
    session_id: event.session_id ?? null,
    local_sequence: event.local_sequence,
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    ingested_at: event.occurred_at,
    schema_version: event.schema_version,
    payload: event.payload,
  };
}

function summarizeFleet(kiosksList: AdminKioskSummary[], now = new Date()): AdminFleetOverview {
  const locationsCount = new Set(kiosksList.map((kiosk) => kiosk.location_id)).size;
  const totals = {
    kiosks: kiosksList.length,
    locations: locationsCount,
    healthy: 0,
    degraded: 0,
    offline: 0,
    unknown: 0,
  };
  for (const kiosk of kiosksList) {
    const status = kiosk.status === 'healthy' ? 'healthy' : kiosk.status === 'degraded' ? 'degraded' : kiosk.status === 'offline' ? 'offline' : 'unknown';
    totals[status] += 1;
  }
  return { generated_at: now.toISOString(), totals, kiosks: kiosksList };
}

function kioskSummaryFromHeartbeat(payload: HeartbeatPayload, receivedAt: Date): AdminKioskSummary {
  return {
    kiosk_id: payload.kiosk_id,
    location_id: payload.location_id,
    name: payload.kiosk_id,
    status: payload.runtime_health ?? 'unknown',
    runtime_health: payload.runtime_health ?? null,
    player_health: payload.player_health ?? null,
    printer_status: payload.printer_status ?? null,
    token_status: payload.token_status ?? null,
    agent_version: payload.agent_version,
    runtime_version: payload.runtime_version,
    player_version: payload.player_version,
    active_package: payload.active_package,
    schedule_version: payload.schedule_version,
    queue_length: payload.queue_length,
    uptime_seconds: payload.uptime_seconds,
    last_heartbeat_at: receivedAt.toISOString(),
    last_session_at: payload.last_session_at ?? null,
    last_error: payload.last_error ?? null,
  };
}

function latestInMemoryKiosks(heartbeatsMap: Map<string, { payload: HeartbeatPayload; receivedAt: Date }>): AdminKioskDetail[] {
  const latest = new Map<string, { payload: HeartbeatPayload; receivedAt: Date }>();
  for (const heartbeat of heartbeatsMap.values()) {
    const existing = latest.get(heartbeat.payload.kiosk_id);
    if (!existing || existing.receivedAt < heartbeat.receivedAt) latest.set(heartbeat.payload.kiosk_id, heartbeat);
  }
  return [...latest.values()]
    .map((heartbeat) => ({ ...kioskSummaryFromHeartbeat(heartbeat.payload, heartbeat.receivedAt), last_heartbeat: heartbeat.payload }))
    .sort((a, b) => a.kiosk_id.localeCompare(b.kiosk_id));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export class InMemoryCentralRepository implements CentralRepository {
  readonly heartbeats = new Map<string, { payload: HeartbeatPayload; receivedAt: Date }>();
  readonly events = new Map<string, EventEnvelope>();
  readonly commands = new Map<string, Command>();
  readonly results = new Map<string, CommandResult>();
  private heartbeatSequence = 0;

  async saveHeartbeat(payload: HeartbeatPayload, receivedAt = new Date()): Promise<HeartbeatRecord> {
    const heartbeatId = `hb_${++this.heartbeatSequence}`;
    this.heartbeats.set(heartbeatId, { payload, receivedAt });
    return { heartbeat_id: heartbeatId, kiosk_id: payload.kiosk_id, received_at: receivedAt.toISOString() };
  }

  async ingestEvents(kioskId: string, uploadedEvents: EventEnvelope[]): Promise<EventIngestResult[]> {
    return uploadedEvents.map((event) => {
      if (event.kiosk_id !== kioskId) throw new Error(`event ${event.event_id} kiosk_id does not match batch kiosk_id`);
      const existing = this.events.get(event.event_id);
      if (existing) {
        if (stableStringify(existing) !== stableStringify(event)) throw new Error(`event ${event.event_id} conflicts with an existing event`);
        return { event_id: event.event_id, status: 'duplicate' as const };
      }
      this.events.set(event.event_id, event);
      return { event_id: event.event_id, status: 'inserted' as const };
    });
  }

  async pollCommands(kioskId: string, now = new Date(), limit = 25): Promise<Command[]> {
    return [...this.commands.values()]
      .filter((command) => command.kiosk_id === kioskId && command.status === 'pending' && new Date(command.expires_at) > now)
      .sort((a, b) => a.issued_at.localeCompare(b.issued_at))
      .slice(0, limit);
  }

  async saveCommandResult(result: CommandResult): Promise<void> {
    this.results.set(result.command_id, result);
    const command = this.commands.get(result.command_id);
    if (command) this.commands.set(result.command_id, { ...command, status: result.status });
  }

  async getFleetOverview(now = new Date()): Promise<AdminFleetOverview> {
    return summarizeFleet(await this.listKiosks(), now);
  }

  async listKiosks(): Promise<AdminKioskSummary[]> {
    return latestInMemoryKiosks(this.heartbeats).map(({ last_heartbeat: _lastHeartbeat, ...summary }) => summary);
  }

  async getKiosk(kioskId: string): Promise<AdminKioskDetail | null> {
    return latestInMemoryKiosks(this.heartbeats).find((kiosk) => kiosk.kiosk_id === kioskId) ?? null;
  }

  async listSchedules(now = new Date()): Promise<AdminSchedulesReadModel> {
    return emptySchedules(now);
  }

  async listDeployments(now = new Date()): Promise<AdminDeploymentsReadModel> {
    return emptyDeployments(now);
  }

  async listEvents(filters = {}, now = new Date()): Promise<AdminEventsReadModel> {
    const normalized = normalizeEventFilters(filters);
    const rows = [...this.events.values()]
      .filter((event) => !normalized.kiosk_id || event.kiosk_id === normalized.kiosk_id)
      .filter((event) => !normalized.event_type || event.event_type === normalized.event_type)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.event_id.localeCompare(a.event_id))
      .slice(0, normalized.limit)
      .map(eventEnvelopeToAdminRow);
    return { generated_at: now.toISOString(), filters: normalized, rows };
  }
}

function postgresEventRowToAdminRow(row: typeof events.$inferSelect): AdminEventRow {
  return {
    event_id: row.eventId,
    kiosk_id: row.kioskId,
    session_id: row.sessionId,
    local_sequence: row.localSequence,
    event_type: row.eventType,
    occurred_at: row.occurredAt.toISOString(),
    ingested_at: row.ingestedAt.toISOString(),
    schema_version: row.schemaVersion,
    payload: row.payload as Record<string, unknown>,
  };
}

function kioskSummaryFromPostgresRow(row: typeof kiosks.$inferSelect, heartbeat?: typeof heartbeats.$inferSelect): AdminKioskDetail {
  const payload = heartbeat?.payload as HeartbeatPayload | undefined;
  return {
    kiosk_id: row.kioskId,
    location_id: row.locationId,
    name: row.name,
    status: row.status,
    runtime_health: payload?.runtime_health ?? row.status ?? null,
    player_health: payload?.player_health ?? null,
    printer_status: payload?.printer_status ?? null,
    token_status: payload?.token_status ?? null,
    agent_version: row.agentVersion,
    runtime_version: row.runtimeVersion,
    player_version: row.playerVersion,
    active_package: row.activePackage,
    schedule_version: row.scheduleVersion,
    queue_length: payload?.queue_length ?? null,
    uptime_seconds: payload?.uptime_seconds ?? null,
    last_heartbeat_at: row.lastHeartbeatAt?.toISOString() ?? heartbeat?.receivedAt.toISOString() ?? null,
    last_session_at: row.lastSessionAt?.toISOString() ?? payload?.last_session_at ?? null,
    last_error: row.lastError,
    last_heartbeat: payload ?? null,
  };
}

export function createPostgresCentralRepository(databaseUrl: string): CentralRepository {
  const client = postgres(databaseUrl, { max: 5 });
  const db = drizzle(client);

  return {
    async saveHeartbeat(payload, receivedAt = new Date()) {
      await db.insert(locations).values({
        locationId: payload.location_id,
        name: payload.location_id,
      }).onConflictDoNothing();

      await db.insert(kiosks).values({
        kioskId: payload.kiosk_id,
        locationId: payload.location_id,
        name: payload.kiosk_id,
        status: payload.runtime_health,
        agentVersion: payload.agent_version,
        runtimeVersion: payload.runtime_version,
        playerVersion: payload.player_version,
        activePackage: payload.active_package,
        scheduleVersion: payload.schedule_version,
        lastHeartbeatAt: receivedAt,
        lastSessionAt: payload.last_session_at ? new Date(payload.last_session_at) : null,
        lastError: payload.last_error,
      }).onConflictDoUpdate({
        target: kiosks.kioskId,
        set: {
          locationId: payload.location_id,
          status: payload.runtime_health,
          agentVersion: payload.agent_version,
          runtimeVersion: payload.runtime_version,
          playerVersion: payload.player_version,
          activePackage: payload.active_package,
          scheduleVersion: payload.schedule_version,
          lastHeartbeatAt: receivedAt,
          lastSessionAt: payload.last_session_at ? new Date(payload.last_session_at) : null,
          lastError: payload.last_error,
          updatedAt: receivedAt,
        },
      });

      const inserted = await db.insert(heartbeats).values({
        kioskId: payload.kiosk_id,
        locationId: payload.location_id,
        receivedAt,
        payload,
      }).returning({ heartbeatId: heartbeats.heartbeatId, kioskId: heartbeats.kioskId, receivedAt: heartbeats.receivedAt });
      const row = inserted[0];
      if (!row) throw new Error('heartbeat insert returned no row');
      return { heartbeat_id: row.heartbeatId, kiosk_id: row.kioskId, received_at: row.receivedAt.toISOString() };
    },

    async ingestEvents(kioskId, uploadedEvents) {
      if (uploadedEvents.length === 0) return [];
      for (const event of uploadedEvents) {
        if (event.kiosk_id !== kioskId) throw new Error(`event ${event.event_id} kiosk_id does not match batch kiosk_id`);
      }
      const eventIds = uploadedEvents.map((event) => event.event_id);
      const existingRows = await db.select({ eventId: events.eventId }).from(events).where(inArray(events.eventId, eventIds));
      const existingIds = new Set(existingRows.map((row) => row.eventId));
      const newEvents = uploadedEvents.filter((event) => !existingIds.has(event.event_id));
      if (newEvents.length > 0) {
        await db.insert(events).values(newEvents.map((event) => ({
          eventId: event.event_id,
          kioskId: event.kiosk_id,
          sessionId: event.session_id ?? null,
          localSequence: event.local_sequence,
          eventType: event.event_type,
          occurredAt: new Date(event.occurred_at),
          payload: event.payload,
          schemaVersion: event.schema_version,
        }))).onConflictDoNothing();
      }
      return uploadedEvents.map((event) => ({ event_id: event.event_id, status: existingIds.has(event.event_id) ? 'duplicate' : 'inserted' }));
    },

    async pollCommands(kioskId, now = new Date(), limit = 25) {
      const rows = await db.select().from(deviceCommands).where(and(
        eq(deviceCommands.kioskId, kioskId),
        eq(deviceCommands.status, 'pending'),
        gt(deviceCommands.expiresAt, now),
      )).orderBy(deviceCommands.issuedAt).limit(limit);
      return rows.map((row) => ({
        command_id: row.commandId,
        kiosk_id: row.kioskId,
        type: row.type as Command['type'],
        status: row.status as Command['status'],
        payload: row.payload as Record<string, unknown>,
        issued_at: row.issuedAt.toISOString(),
        expires_at: row.expiresAt.toISOString(),
        requires_confirmation: row.requiresConfirmation,
        idempotency_key: row.idempotencyKey,
      }));
    },

    async saveCommandResult(result, completedAt = new Date()) {
      const observedAt = result.completed_at ? new Date(result.completed_at) : completedAt;
      await db.insert(commandResults).values({
        commandId: result.command_id,
        kioskId: result.kiosk_id,
        status: result.status,
        startedAt: result.started_at ? new Date(result.started_at) : null,
        completedAt: observedAt,
        message: result.message ?? null,
        errorCode: result.error_code ?? null,
        evidence: result.evidence,
      }).onConflictDoUpdate({
        target: commandResults.commandId,
        set: {
          status: result.status,
          completedAt: observedAt,
          message: result.message ?? null,
          errorCode: result.error_code ?? null,
          evidence: result.evidence,
        },
      });
      await db.update(deviceCommands).set({ status: result.status, updatedAt: observedAt }).where(eq(deviceCommands.commandId, result.command_id));
    },

    async getFleetOverview(now = new Date()) {
      return summarizeFleet(await this.listKiosks(), now);
    },

    async listKiosks() {
      const details = await readPostgresKioskDetails();
      return details.map(({ last_heartbeat: _lastHeartbeat, ...summary }) => summary);
    },

    async getKiosk(kioskId) {
      const details = await readPostgresKioskDetails(kioskId);
      return details[0] ?? null;
    },

    async listSchedules(now = new Date()) {
      return emptySchedules(now);
    },

    async listDeployments(now = new Date()) {
      return emptyDeployments(now);
    },

    async listEvents(filters = {}, now = new Date()) {
      const normalized = normalizeEventFilters(filters);
      const clauses = [
        normalized.kiosk_id ? eq(events.kioskId, normalized.kiosk_id) : undefined,
        normalized.event_type ? eq(events.eventType, normalized.event_type) : undefined,
      ].filter((clause) => clause !== undefined);
      const rows = clauses.length > 0
        ? await db.select().from(events).where(and(...clauses)).orderBy(desc(events.occurredAt)).limit(normalized.limit)
        : await db.select().from(events).orderBy(desc(events.occurredAt)).limit(normalized.limit);
      return { generated_at: now.toISOString(), filters: normalized, rows: rows.map(postgresEventRowToAdminRow) };
    },
  };

  async function readPostgresKioskDetails(kioskId?: string): Promise<AdminKioskDetail[]> {
    const kioskRows = kioskId
      ? await db.select().from(kiosks).where(eq(kiosks.kioskId, kioskId))
      : await db.select().from(kiosks).orderBy(kiosks.kioskId);
    if (kioskRows.length === 0) return [];

    const heartbeatRows = await db.select().from(heartbeats).where(inArray(heartbeats.kioskId, kioskRows.map((row) => row.kioskId))).orderBy(desc(heartbeats.receivedAt));
    const latestHeartbeatByKiosk = new Map<string, typeof heartbeats.$inferSelect>();
    for (const heartbeat of heartbeatRows) {
      if (!latestHeartbeatByKiosk.has(heartbeat.kioskId)) latestHeartbeatByKiosk.set(heartbeat.kioskId, heartbeat);
    }

    return kioskRows.map((row) => kioskSummaryFromPostgresRow(row, latestHeartbeatByKiosk.get(row.kioskId)));
  }
}
