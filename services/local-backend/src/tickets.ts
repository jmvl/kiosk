import type { Ticket } from '@retail-kiosk/shared-types';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { LocalDatabase } from './db/sqlite.js';
import { appendEvent } from './events.js';
import { crockfordFromBytes, generateUlid } from './ids.js';

export const defaultTicketSecretPath = '/etc/retail-kiosk/secrets/ticket-signing.env';

export interface CreateTicketInput {
  kioskId: string;
  kioskShortId: string;
  sessionId: string;
  packageId: string;
  packageVersion: string;
  campaignShortCode: string;
  renderPayload: Record<string, unknown>;
  redemptionModel?: Ticket['redemption_model'];
  checkLength?: number;
  keyVersion?: string;
  secret?: string;
  secretFilePath?: string;
}

interface TicketSecretConfig {
  secret: string;
  keyVersion: string;
}

interface TicketSessionRow {
  session_id: string;
  kiosk_id: string;
  package_id: string;
  package_version: string;
}

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1] ?? '';
    let value = (match[2] ?? '').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function loadTicketSecret(input: Pick<CreateTicketInput, 'secret' | 'secretFilePath' | 'keyVersion'> = {}): TicketSecretConfig {
  const directSecret = input.secret ?? process.env.TICKET_SIGNING_SECRET;
  if (directSecret && directSecret.length > 0) {
    return { secret: directSecret, keyVersion: input.keyVersion ?? process.env.TICKET_SIGNING_KEY_VERSION ?? 'pilot-v1' };
  }

  const path = input.secretFilePath ?? process.env.TICKET_SIGNING_SECRET_FILE ?? defaultTicketSecretPath;
  if (!existsSync(path)) {
    throw new Error(`ticket signing secret not found at ${path}; set TICKET_SIGNING_SECRET or TICKET_SIGNING_SECRET_FILE`);
  }
  const env = parseEnvFile(readFileSync(path, 'utf8'));
  const secret = env.TICKET_SIGNING_SECRET;
  if (!secret) throw new Error(`ticket signing secret file ${path} is missing TICKET_SIGNING_SECRET`);
  return { secret, keyVersion: input.keyVersion ?? env.TICKET_SIGNING_KEY_VERSION ?? 'pilot-v1' };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
}

export function canonicalTicketPayload(fields: {
  ticketId: string;
  publicTicketId: string;
  kioskId: string;
  sessionId: string;
  packageId: string;
  packageVersion: string;
  campaignShortCode: string;
  redemptionModel: Ticket['redemption_model'];
  renderPayload: Record<string, unknown>;
}): string {
  return stableJson({
    campaign_short_code: fields.campaignShortCode,
    kiosk_id: fields.kioskId,
    package_id: fields.packageId,
    package_version: fields.packageVersion,
    public_ticket_id: fields.publicTicketId,
    redemption_model: fields.redemptionModel,
    render_payload: fields.renderPayload,
    session_id: fields.sessionId,
    ticket_id: fields.ticketId,
  });
}

export function ticketCheck(secret: string, canonicalPayload: string, checkLength = 6): string {
  const digest = createHmac('sha256', secret).update(canonicalPayload).digest();
  return crockfordFromBytes(digest, checkLength);
}

function ticketCodeKioskPrefix(kioskId: string): string {
  const normalized = kioskId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length === 0) throw new Error(`kiosk id cannot form a ticket code prefix: ${kioskId}`);
  return normalized;
}

export function createTicket(db: LocalDatabase, input: CreateTicketInput): Ticket {
  const tx = db.transaction(() => {
    const session = db.prepare('SELECT session_id, kiosk_id, package_id, package_version FROM sessions WHERE session_id = ?').get(input.sessionId) as TicketSessionRow | undefined;
    if (!session) throw new Error(`session not found: ${input.sessionId}`);
    if (input.kioskId !== session.kiosk_id || input.packageId !== session.package_id || input.packageVersion !== session.package_version) {
      throw new Error(`ticket metadata mismatch for session ${input.sessionId}`);
    }

    const now = new Date().toISOString();
    const ticketId = generateUlid();
    const publicTicketId = ticketId.slice(0, 12);
    const redemptionModel = input.redemptionModel ?? 'staff_visual_v1';
    const checkLength = input.checkLength ?? 6;
    const secret = loadTicketSecret(input);
    const canonical = canonicalTicketPayload({
      ticketId,
      publicTicketId,
      kioskId: session.kiosk_id,
      sessionId: session.session_id,
      packageId: session.package_id,
      packageVersion: session.package_version,
      campaignShortCode: input.campaignShortCode,
      redemptionModel,
      renderPayload: input.renderPayload,
    });
    const check = ticketCheck(secret.secret, canonical, checkLength);
    const kioskCodePrefix = ticketCodeKioskPrefix(session.kiosk_id);
    const ticketCode = `${input.campaignShortCode}-${kioskCodePrefix}-${publicTicketId}-${check}`;
    const ticket: Ticket = {
      ticket_id: ticketId,
      ticket_code: ticketCode,
      kiosk_id: session.kiosk_id,
      session_id: session.session_id,
      package_id: session.package_id,
      package_version: session.package_version,
      campaign_short_code: input.campaignShortCode,
      public_ticket_id: publicTicketId,
      key_version: secret.keyVersion,
      hmac_algorithm: 'HMAC-SHA-256',
      check_length: checkLength,
      redemption_model: redemptionModel,
      render_payload: input.renderPayload,
      print_status: 'created',
      created_at: now,
    };
    db.prepare(`INSERT INTO tickets (ticket_id, ticket_code, kiosk_id, session_id, package_id, package_version, campaign_short_code, public_ticket_id, key_version, hmac_algorithm, check_length, redemption_model, render_payload, print_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ticket.ticket_id,
      ticket.ticket_code,
      ticket.kiosk_id,
      ticket.session_id,
      ticket.package_id,
      ticket.package_version,
      ticket.campaign_short_code,
      ticket.public_ticket_id,
      ticket.key_version,
      ticket.hmac_algorithm,
      ticket.check_length,
      ticket.redemption_model,
      JSON.stringify(ticket.render_payload),
      ticket.print_status,
      ticket.created_at,
    );
    appendEvent(db, {
      kioskId: session.kiosk_id,
      sessionId: session.session_id,
      eventType: 'ticket_created',
      payload: {
        ticket_id: ticket.ticket_id,
        ticket_code: ticket.ticket_code,
        public_ticket_id: ticket.public_ticket_id,
        key_version: ticket.key_version,
        hmac_algorithm: ticket.hmac_algorithm,
        check_length: ticket.check_length,
      },
      occurredAt: now,
    });
    return ticket;
  });
  return tx();
}
