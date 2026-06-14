import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { ReadStream } from 'node:fs';
import type { Ticket } from '@retail-kiosk/shared-types';
import type { LocalDatabase } from './db/sqlite.js';
import { appendEvent } from './events.js';
import { generateUlid } from './ids.js';

export type AdapterStatus = 'online' | 'offline' | 'degraded';

export interface AdapterHealth {
  adapter: string;
  status: AdapterStatus;
  fake: boolean;
  last_event_at?: string;
  last_error?: string;
}

export interface NormalizedTokenEvent {
  token_id: string;
  source: 'fake' | 'serial';
  denomination_cents: number;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface TokenAdapter {
  readonly adapter: string;
  readonly fake: boolean;
  health(): AdapterHealth;
  injectToken?(payload?: Record<string, unknown>): NormalizedTokenEvent;
  start?(): Promise<void>;
  stop?(): Promise<void>;
  onToken?(callback: (event: NormalizedTokenEvent) => void): void;
}

export interface PrintResult {
  print_job_id: string;
  status: 'printed' | 'print_submitted' | 'print_failed';
  ticket_id: string;
  ticket_code: string;
  occurred_at: string;
  fake: boolean;
  printer_name?: string;
  cups_job_id?: string;
  error_message?: string;
}

export interface PrinterAdapter {
  readonly adapter: string;
  readonly fake: boolean;
  health(): AdapterHealth;
  printTicket(db: LocalDatabase, ticket: Ticket, requestPayload?: Record<string, unknown>): PrintResult | Promise<PrintResult>;
}

export class FakeTokenAdapter implements TokenAdapter {
  readonly adapter = 'FakeTokenAdapter';
  readonly fake = true;
  #lastEventAt: string | undefined;
  #lastError: string | undefined;

  health(): AdapterHealth {
    return {
      adapter: this.adapter,
      status: this.#lastError ? 'degraded' : 'online',
      fake: true,
      ...(this.#lastEventAt ? { last_event_at: this.#lastEventAt } : {}),
      ...(this.#lastError ? { last_error: this.#lastError } : {}),
    };
  }

  injectToken(payload: Record<string, unknown> = {}): NormalizedTokenEvent {
    const now = new Date().toISOString();
    const denomination = typeof payload.denomination_cents === 'number' ? payload.denomination_cents : 100;
    const event: NormalizedTokenEvent = {
      token_id: generateUlid(),
      source: 'fake',
      denomination_cents: denomination,
      occurred_at: now,
      payload: { ...payload, denomination_cents: denomination },
    };
    this.#lastEventAt = now;
    this.#lastError = undefined;
    return event;
  }
}

export interface SerialTokenAdapterConfig {
  port: string;
  baudRate: number;
  debounceMs: number;
  reconnectMs: number;
}

export interface SerialCommandRunnerResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type SerialCommandRunner = (command: string, args: readonly string[]) => Promise<SerialCommandRunnerResult>;

function defaultCommandRunner(command: string, args: readonly string[]): Promise<SerialCommandRunnerResult> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: 127, stdout, stderr: error.message }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function hexValue(buffer: Buffer): string {
  return [...buffer].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function textValue(buffer: Buffer): string | undefined {
  const text = buffer.toString('utf8').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return text.length > 0 ? text : undefined;
}

export class SerialTokenAdapter implements TokenAdapter {
  readonly adapter = 'SerialTokenAdapter';
  readonly fake = false;
  readonly config: SerialTokenAdapterConfig;
  readonly #commandRunner: SerialCommandRunner;
  readonly #callbacks = new Set<(event: NormalizedTokenEvent) => void>();
  #stream: ReadStream | undefined;
  #reconnectTimer: NodeJS.Timeout | undefined;
  #running = false;
  #lastEventAt: string | undefined;
  #lastError: string | undefined;
  #lastNormalizedValue: string | undefined;
  #lastNormalizedAt = 0;

  constructor(config: SerialTokenAdapterConfig, commandRunner: SerialCommandRunner = defaultCommandRunner) {
    this.config = config;
    this.#commandRunner = commandRunner;
  }

  health(): AdapterHealth {
    return {
      adapter: this.adapter,
      status: this.#lastError ? (this.#running ? 'degraded' : 'offline') : (this.#running ? 'online' : 'offline'),
      fake: false,
      ...(this.#lastEventAt ? { last_event_at: this.#lastEventAt } : {}),
      ...(this.#lastError ? { last_error: this.#lastError } : {}),
    };
  }

  onToken(callback: (event: NormalizedTokenEvent) => void): void {
    this.#callbacks.add(callback);
  }

  async start(): Promise<void> {
    this.#running = true;
    await this.#open();
  }

  async stop(): Promise<void> {
    this.#running = false;
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = undefined;
    this.#stream?.destroy();
    this.#stream = undefined;
  }

  ingestForTest(chunk: Buffer | string, nowMs = Date.now()): NormalizedTokenEvent | null {
    return this.#normalize(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), nowMs);
  }

  async #open(): Promise<void> {
    const stty = await this.#commandRunner('stty', ['-F', this.config.port, String(this.config.baudRate), 'raw', '-echo', '-icanon', 'min', '0', 'time', '1']);
    if (stty.code !== 0) {
      this.#lastError = `stty failed for ${this.config.port}: ${stty.stderr || stty.stdout || `exit ${stty.code}`}`;
      this.#scheduleReconnect();
      return;
    }
    this.#lastError = undefined;
    const stream = createReadStream(this.config.port, { flags: 'r', highWaterMark: 64 });
    this.#stream = stream;
    stream.on('data', (chunk) => {
      const event = this.#normalize(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (!event) return;
      for (const callback of this.#callbacks) callback(event);
    });
    stream.on('error', (error) => {
      this.#lastError = error.message;
      this.#scheduleReconnect();
    });
    stream.on('close', () => {
      if (this.#running) this.#scheduleReconnect();
    });
  }

  #scheduleReconnect(): void {
    if (!this.#running || this.#reconnectTimer) return;
    this.#stream?.destroy();
    this.#stream = undefined;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = undefined;
      void this.#open();
    }, this.config.reconnectMs);
  }

  #normalize(chunk: Buffer, nowMs = Date.now()): NormalizedTokenEvent | null {
    if (chunk.length === 0) return null;
    const hex = hexValue(chunk);
    const text = textValue(chunk);
    const normalized = text ?? hex;
    if (this.#lastNormalizedValue === normalized && nowMs - this.#lastNormalizedAt < this.config.debounceMs) return null;
    this.#lastNormalizedValue = normalized;
    this.#lastNormalizedAt = nowMs;
    const now = new Date(nowMs).toISOString();
    this.#lastEventAt = now;
    this.#lastError = undefined;
    return {
      token_id: generateUlid(),
      source: 'serial',
      denomination_cents: 0,
      occurred_at: now,
      payload: {
        port: this.config.port,
        baud_rate: this.config.baudRate,
        raw_hex: hex,
        ...(text ? { raw_text: text } : {}),
        normalized_value: normalized,
        denomination_mapping: 'unmapped_o0_no_token_pulse_evidence',
      },
    };
  }
}

export class FakePrinterAdapter implements PrinterAdapter {
  readonly adapter = 'FakePrinterAdapter';
  readonly fake = true;
  #lastEventAt: string | undefined;
  #lastError: string | undefined;

  health(): AdapterHealth {
    return {
      adapter: this.adapter,
      status: this.#lastError ? 'degraded' : 'online',
      fake: true,
      ...(this.#lastEventAt ? { last_event_at: this.#lastEventAt } : {}),
      ...(this.#lastError ? { last_error: this.#lastError } : {}),
    };
  }

  printTicket(db: LocalDatabase, ticket: Ticket, requestPayload: Record<string, unknown> = {}): PrintResult {
    const printJobId = generateUlid();
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO print_jobs (print_job_id, ticket_id, session_id, kiosk_id, status, request_payload, result_payload, attempts, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, ?, 'printed', ?, ?, 1, ?, ?, ?)`).run(
        printJobId,
        ticket.ticket_id,
        ticket.session_id,
        ticket.kiosk_id,
        JSON.stringify({ fake: true, ticket_code: ticket.ticket_code, ...requestPayload }),
        JSON.stringify({ fake: true, status: 'printed' }),
        now,
        now,
        now,
      );
      db.prepare("UPDATE tickets SET print_status = 'printed', printed_at = ? WHERE ticket_id = ?").run(now, ticket.ticket_id);
      appendEvent(db, {
        kioskId: ticket.kiosk_id,
        sessionId: ticket.session_id,
        eventType: 'fake_print_completed',
        payload: { print_job_id: printJobId, ticket_id: ticket.ticket_id, ticket_code: ticket.ticket_code, fake: true },
        occurredAt: now,
      });
    });
    tx();
    this.#lastEventAt = now;
    this.#lastError = undefined;
    return { print_job_id: printJobId, status: 'printed', ticket_id: ticket.ticket_id, ticket_code: ticket.ticket_code, occurred_at: now, fake: true };
  }
}

export interface CupsPrinterAdapterConfig {
  printerName: string;
}

export interface CupsCommandRunnerResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CupsCommandRunner = (command: string, args: readonly string[]) => Promise<CupsCommandRunnerResult>;

function ticketText(ticket: Ticket, requestPayload: Record<string, unknown>): string {
  return [
    'Retail Kiosk Ticket',
    `Ticket: ${ticket.ticket_code}`,
    `Campaign: ${ticket.campaign_short_code}`,
    `Kiosk: ${ticket.kiosk_id}`,
    `Package: ${ticket.package_id}@${ticket.package_version}`,
    `Issued: ${ticket.created_at}`,
    `Payload: ${JSON.stringify(requestPayload)}`,
    '',
  ].join('\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCupsJobId(output: string): string | undefined {
  const match = output.match(/request id is\s+(\S+)/i) ?? output.match(/(\S+-\d+)/);
  return match?.[1];
}

export class CupsPrinterAdapter implements PrinterAdapter {
  readonly adapter = 'CupsPrinterAdapter';
  readonly fake = false;
  readonly config: CupsPrinterAdapterConfig;
  readonly #commandRunner: CupsCommandRunner;
  #lastEventAt: string | undefined;
  #lastError: string | undefined;

  constructor(config: CupsPrinterAdapterConfig, commandRunner: CupsCommandRunner = defaultCommandRunner) {
    this.config = config;
    this.#commandRunner = commandRunner;
  }

  health(): AdapterHealth {
    return {
      adapter: this.adapter,
      status: this.#lastError ? 'degraded' : 'online',
      fake: false,
      ...(this.#lastEventAt ? { last_event_at: this.#lastEventAt } : {}),
      ...(this.#lastError ? { last_error: this.#lastError } : {}),
    };
  }

  async printTicket(db: LocalDatabase, ticket: Ticket, requestPayload: Record<string, unknown> = {}): Promise<PrintResult> {
    const printJobId = generateUlid();
    const requestedAt = new Date().toISOString();
    db.prepare(`INSERT INTO print_jobs (print_job_id, ticket_id, session_id, kiosk_id, status, request_payload, result_payload, attempts, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, 'printing', ?, ?, 1, ?, ?, NULL)`).run(
      printJobId,
      ticket.ticket_id,
      ticket.session_id,
      ticket.kiosk_id,
      JSON.stringify({ fake: false, printer_name: this.config.printerName, ticket_code: ticket.ticket_code, ...requestPayload }),
      JSON.stringify({ fake: false, status: 'submitted' }),
      requestedAt,
      requestedAt,
    );

    const dir = await mkdtemp(join(tmpdir(), 'retail-kiosk-print-'));
    const filePath = join(dir, `${printJobId}.txt`);
    try {
      await writeFile(filePath, ticketText(ticket, requestPayload), 'utf8');
      const result = await this.#commandRunner('lp', ['-d', this.config.printerName, '-t', `retail-kiosk-${ticket.ticket_id}`, filePath]);
      const now = new Date().toISOString();
      if (result.code !== 0) {
        const message = result.stderr || result.stdout || `lp exited ${result.code}`;
        this.#lastError = message;
        db.prepare(`UPDATE print_jobs SET status = 'print_failed', result_payload = ?, updated_at = ?, completed_at = ? WHERE print_job_id = ?`).run(
          JSON.stringify({ fake: false, status: 'print_failed', error_message: message }),
          now,
          now,
          printJobId,
        );
        db.prepare("UPDATE tickets SET print_status = 'print_failed' WHERE ticket_id = ?").run(ticket.ticket_id);
        appendEvent(db, {
          kioskId: ticket.kiosk_id,
          sessionId: ticket.session_id,
          eventType: 'cups_print_failed',
          payload: { print_job_id: printJobId, ticket_id: ticket.ticket_id, ticket_code: ticket.ticket_code, printer_name: this.config.printerName, error_message: message },
          occurredAt: now,
        });
        return { print_job_id: printJobId, status: 'print_failed', ticket_id: ticket.ticket_id, ticket_code: ticket.ticket_code, occurred_at: now, fake: false, printer_name: this.config.printerName, error_message: message };
      }

      const cupsJobId = parseCupsJobId(result.stdout || result.stderr || '');
      this.#lastEventAt = now;
      this.#lastError = undefined;
      db.prepare(`UPDATE print_jobs SET status = 'submitted', result_payload = ?, updated_at = ?, completed_at = NULL WHERE print_job_id = ?`).run(
        JSON.stringify({ fake: false, status: 'print_submitted', printer_name: this.config.printerName, cups_job_id: cupsJobId }),
        now,
        printJobId,
      );
      db.prepare("UPDATE tickets SET print_status = 'printing', printed_at = NULL WHERE ticket_id = ?").run(ticket.ticket_id);
      appendEvent(db, {
        kioskId: ticket.kiosk_id,
        sessionId: ticket.session_id,
        eventType: 'cups_print_submitted',
        payload: { print_job_id: printJobId, ticket_id: ticket.ticket_id, ticket_code: ticket.ticket_code, printer_name: this.config.printerName, cups_job_id: cupsJobId },
        occurredAt: now,
      });

      if (cupsJobId) {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          if (attempt > 0) await sleep(1_000);
          const queue = await this.#commandRunner('lpstat', ['-o', this.config.printerName]);
          const queued = queue.code === 0 && queue.stdout.includes(cupsJobId);
          if (!queued) {
            const completedAt = new Date().toISOString();
            db.prepare(`UPDATE print_jobs SET status = 'printed', result_payload = ?, updated_at = ?, completed_at = ? WHERE print_job_id = ?`).run(
              JSON.stringify({ fake: false, status: 'printed', printer_name: this.config.printerName, cups_job_id: cupsJobId }),
              completedAt,
              completedAt,
              printJobId,
            );
            db.prepare("UPDATE tickets SET print_status = 'printed', printed_at = ? WHERE ticket_id = ?").run(completedAt, ticket.ticket_id);
            appendEvent(db, {
              kioskId: ticket.kiosk_id,
              sessionId: ticket.session_id,
              eventType: 'cups_print_completed',
              payload: { print_job_id: printJobId, ticket_id: ticket.ticket_id, ticket_code: ticket.ticket_code, printer_name: this.config.printerName, cups_job_id: cupsJobId },
              occurredAt: completedAt,
            });
            return { print_job_id: printJobId, status: 'printed', ticket_id: ticket.ticket_id, ticket_code: ticket.ticket_code, occurred_at: completedAt, fake: false, printer_name: this.config.printerName, cups_job_id: cupsJobId };
          }
        }
      }

      return { print_job_id: printJobId, status: 'print_submitted', ticket_id: ticket.ticket_id, ticket_code: ticket.ticket_code, occurred_at: now, fake: false, printer_name: this.config.printerName, ...(cupsJobId ? { cups_job_id: cupsJobId } : {}) };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
