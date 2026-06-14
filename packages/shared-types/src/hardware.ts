import type { RenderedTicket } from './tickets.js';

export type HardwareHealthStatus = 'online' | 'offline' | 'degraded' | 'unknown';

export interface HardwareHealth {
  status: HardwareHealthStatus;
  code?: string;
  message?: string;
  checked_at: string;
}

export interface TokenEvent {
  token_id: string;
  source: 'fake' | 'serial';
  received_at: string;
  raw_value?: string;
  normalized_value?: string;
}

export interface TokenAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  onToken(callback: (event: TokenEvent) => void): void;
  getHealth(): Promise<HardwareHealth>;
}

export type PrintJobStatus = 'queued' | 'printing' | 'succeeded' | 'failed' | 'cancelled';

export interface PrintJob {
  print_job_id: string;
  ticket_id: string;
  kiosk_id: string;
  session_id: string;
  status: PrintJobStatus;
  requested_at: string;
  started_at?: string;
  completed_at?: string;
  attempt: number;
  printer_name?: string;
  error_code?: string;
  error_message?: string;
}

export interface PrintResult {
  print_job_id: string;
  status: 'succeeded' | 'failed';
  printed_at: string;
  printer_name?: string;
  error_code?: string;
  error_message?: string;
}

export interface PrinterAdapter {
  print(ticket: RenderedTicket): Promise<PrintResult>;
  testPrint(): Promise<PrintResult>;
  getHealth(): Promise<HardwareHealth>;
}
