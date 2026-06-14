import type { HardwareHealthStatus } from './hardware.js';

export interface HeartbeatPayload {
  kiosk_id: string;
  location_id: string;
  agent_version: string;
  runtime_version: string;
  player_version: string;
  active_package: string;
  schedule_version: number;
  uptime_seconds: number;
  queue_length: number;
  printer_status: HardwareHealthStatus;
  token_status: HardwareHealthStatus;
  runtime_health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  player_health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  last_session_at?: string;
  last_error: string | null;
  clock_skew_seconds?: number;
}
