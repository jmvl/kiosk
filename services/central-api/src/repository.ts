import type { Command, CommandResult, EventEnvelope, HeartbeatPayload } from '@retail-kiosk/shared-types';
import { and, eq, gt, inArray } from 'drizzle-orm';
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

export interface CentralRepository {
  saveHeartbeat(payload: HeartbeatPayload, receivedAt?: Date): Promise<HeartbeatRecord>;
  ingestEvents(kioskId: string, uploadedEvents: EventEnvelope[]): Promise<EventIngestResult[]>;
  pollCommands(kioskId: string, now?: Date, limit?: number): Promise<Command[]>;
  saveCommandResult(result: CommandResult, completedAt?: Date): Promise<void>;
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
  };
}
